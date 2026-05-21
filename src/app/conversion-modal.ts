import { createIcons, icons } from 'lucide';

export type LogLevel = 'info' | 'step' | 'success' | 'error' | 'warn' | 'path';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
}

// ─── Robustness constants ──────────────────────────────
/** Maximum visible DOM lines before we start pruning the oldest */
const MAX_DOM_LINES = 200;
/** How many DOM lines to remove in one prune batch */
const PRUNE_BATCH = 60;
/** Maximum characters per log message before truncation */
const MAX_MSG_LENGTH = 300;
/** Minimum ms between forced scroll-to-bottom calls to avoid layout thrashing */
const SCROLL_THROTTLE_MS = 50;
/** Maximum in-memory log entries kept for the full session history */
const MAX_MEMORY_LOGS = 2000;

/**
 * Escape HTML entities in user-provided strings to prevent XSS
 * and rendering issues with angle brackets in format names, etc.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Truncate a string to `max` characters, appending an ellipsis if trimmed.
 */
function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max) + '…';
}

const PREFIX_MAP: Record<LogLevel, string> = {
  info:    '○',
  step:    '▸',
  success: '✓',
  error:   '✗',
  warn:    '⚠',
  path:    '◇',
};

/**
 * A beautiful, terminal-style conversion progress modal.
 * Shows real-time logs of what the conversion engine is doing
 * with a themed terminal panel + progress header.
 *
 * Robustness guarantees:
 * - DOM line cap: only the last MAX_DOM_LINES are kept in the DOM.
 *   Older lines are pruned in batches to avoid per-line layout thrash.
 * - Memory cap: only the last MAX_MEMORY_LOGS entries are kept in JS.
 * - Long messages are truncated to MAX_MSG_LENGTH characters.
 * - All text is HTML-escaped to prevent injection / rendering glitches.
 * - Scroll-to-bottom is throttled so rapid-fire logging won't jank.
 * - Duplicate consecutive messages are collapsed into a counter badge.
 * - Timer element is cached to avoid querySelector on every tick.
 */
export class ConversionModal {
  private backdrop: HTMLDivElement;
  private modal: HTMLDivElement;
  private logs: LogEntry[] = [];
  private startTime: number = 0;
  private terminalBody: HTMLDivElement | null = null;
  private progressDots: HTMLSpanElement | null = null;
  private dotInterval: ReturnType<typeof setInterval> | null = null;
  private timerEl: Element | null = null;

  // Scroll throttle state
  private scrollPending = false;
  private lastScrollTime = 0;
  private scrollRAF: number | null = null;

  // DOM line count tracking (cheaper than querySelectorAll().length)
  private domLineCount = 0;

  // Duplicate collapse tracking
  private lastLogKey: string = '';
  private lastLogLine: HTMLDivElement | null = null;
  private lastLogDupCount = 0;

  constructor() {
    this.backdrop = document.querySelector('#popup-bg') as HTMLDivElement;
    this.modal = document.querySelector('#popup') as HTMLDivElement;
  }

  /** Show the modal in "loading" state with terminal log panel */
  showLoading(fromFormat: string, toFormat: string) {
    this.logs = [];
    this.domLineCount = 0;
    this.lastLogKey = '';
    this.lastLogLine = null;
    this.lastLogDupCount = 0;
    this.startTime = performance.now();

    const fromSafe = escapeHtml(truncate(fromFormat, 30));
    const toSafe = escapeHtml(truncate(toFormat, 30));

    this.modal.innerHTML = `
      <div class="cvt-modal">
        <div class="cvt-modal-header">
          <div class="cvt-pulse-ring">
            <div class="cvt-pulse-dot"></div>
          </div>
          <div class="cvt-header-text">
            <h2 class="cvt-title">Converting<span class="cvt-dots"></span></h2>
            <p class="cvt-subtitle">
              <span class="cvt-badge-from">${fromSafe.toUpperCase()}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              <span class="cvt-badge-to">${toSafe.toUpperCase()}</span>
            </p>
          </div>
        </div>
        <div class="cvt-terminal">
          <div class="cvt-terminal-header">
            <div class="cvt-terminal-dots">
              <span></span><span></span><span></span>
            </div>
            <span class="cvt-terminal-title">Conversion Log</span>
            <span class="cvt-terminal-time">0.0s</span>
          </div>
          <div class="cvt-terminal-body"></div>
        </div>
      </div>
    `;

    this.terminalBody = this.modal.querySelector('.cvt-terminal-body');
    this.progressDots = this.modal.querySelector('.cvt-dots');
    this.timerEl = this.modal.querySelector('.cvt-terminal-time');

    this._show();
    this._startDots();
    this.log('info', 'Conversion engine started');
    this.log('info', `Target: ${fromFormat} → ${toFormat}`);
  }

  /** Append a log line to the terminal */
  log(level: LogLevel, message: string) {
    const safemsg = truncate(message, MAX_MSG_LENGTH);
    const entry: LogEntry = { level, message: safemsg, timestamp: performance.now() - this.startTime };

    // Cap memory logs
    this.logs.push(entry);
    if (this.logs.length > MAX_MEMORY_LOGS) {
      this.logs.splice(0, this.logs.length - MAX_MEMORY_LOGS);
    }

    this._appendLogLine(entry);
    this._updateTimer();
  }

  /** Show that a specific path is being tried */
  logPath(path: string[]) {
    this.log('path', path.join(' → '));
  }

  /** Show that a specific handler step is running */
  logStep(handlerName: string, from: string, to: string) {
    this.log('step', `${handlerName}: ${from} → ${to}`);
  }

  /** Show a dead-end / retry */
  logRetry(reason: string) {
    this.log('warn', `Retrying — ${reason}`);
  }

  /** Show the success state */
  showSuccess(pathUsed: string[], elapsedMs: number) {
    this._stopDots();
    this.log('success', `Done in ${(elapsedMs / 1000).toFixed(1)}s`);

    const header = this.modal.querySelector('.cvt-modal-header');
    if (header) {
      const chips = pathUsed
        .map(f => `<span class="cvt-path-chip">${escapeHtml(truncate(f, 20))}</span>`)
        .join('<span class="cvt-path-arrow">→</span>');

      header.innerHTML = `
        <div class="cvt-success-icon">
          <i data-lucide="check-circle-2"></i>
        </div>
        <div class="cvt-header-text">
          <h2 class="cvt-title" style="color: var(--success);">Conversion Complete</h2>
          <p class="cvt-subtitle" style="margin-top: 0.25rem;">${chips}</p>
        </div>
      `;
      createIcons({ icons, nameAttr: 'data-lucide' });
    }

    this._addCloseButton();
  }

  /** Show an error state */
  showError(message: string) {
    this._stopDots();
    this.log('error', message);

    const header = this.modal.querySelector('.cvt-modal-header');
    if (header) {
      header.innerHTML = `
        <div class="cvt-error-icon">
          <i data-lucide="x-circle"></i>
        </div>
        <div class="cvt-header-text">
          <h2 class="cvt-title" style="color: var(--danger);">Conversion Failed</h2>
          <p class="cvt-subtitle">${escapeHtml(truncate(message, 120))}</p>
        </div>
      `;
      createIcons({ icons, nameAttr: 'data-lucide' });
    }

    this._addCloseButton();
  }

  /** Hide modal */
  hide() {
    this._stopDots();
    this._cancelPendingScroll();
    this.modal.style.opacity = '0';
    this.modal.style.transform = 'scale(0.95)';
    this.backdrop.style.opacity = '0';
    setTimeout(() => {
      this.modal.style.display = 'none';
      this.backdrop.style.display = 'none';
    }, 300);
  }

  // ─── Private helpers ───────────────────────────────────

  private _show() {
    this.modal.style.display = 'flex';
    this.backdrop.style.display = 'block';
    void this.modal.offsetWidth; // force reflow
    this.modal.style.opacity = '1';
    this.modal.style.transform = 'scale(1)';
    this.backdrop.style.opacity = '1';
  }

  private _appendLogLine(entry: LogEntry) {
    if (!this.terminalBody) return;

    // ── Duplicate collapse ─────────────────────────────
    const logKey = `${entry.level}::${entry.message}`;
    if (logKey === this.lastLogKey && this.lastLogLine) {
      this.lastLogDupCount++;
      let badge = this.lastLogLine.querySelector('.cvt-dup-badge') as HTMLSpanElement;
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'cvt-dup-badge';
        this.lastLogLine.appendChild(badge);
      }
      badge.textContent = `×${this.lastLogDupCount}`;
      this._scheduleScroll();
      return;
    }

    this.lastLogKey = logKey;
    this.lastLogDupCount = 1;

    // ── Build DOM node ────────────────────────────────
    const line = document.createElement('div');
    line.className = `cvt-log-line cvt-log-${entry.level}`;

    const ts = (entry.timestamp / 1000).toFixed(1);
    const tsSpan = document.createElement('span');
    tsSpan.className = 'cvt-log-ts';
    tsSpan.textContent = `${ts}s`;

    const prefixSpan = document.createElement('span');
    prefixSpan.className = 'cvt-log-prefix';
    prefixSpan.textContent = PREFIX_MAP[entry.level];

    const msgSpan = document.createElement('span');
    msgSpan.className = 'cvt-log-msg';
    msgSpan.textContent = entry.message; // textContent = auto-escaped

    line.appendChild(tsSpan);
    line.appendChild(prefixSpan);
    line.appendChild(msgSpan);

    this.terminalBody.appendChild(line);
    this.lastLogLine = line;
    this.domLineCount++;

    // ── Prune old DOM lines ──────────────────────────
    if (this.domLineCount > MAX_DOM_LINES) {
      this._pruneOldLines();
    }

    this._scheduleScroll();
  }

  /**
   * Remove the oldest PRUNE_BATCH lines from the DOM in one shot.
   * Inserting a "... N lines hidden ..." divider after pruning.
   */
  private _pruneOldLines() {
    if (!this.terminalBody) return;

    // Remove existing pruned-notice if any
    const oldNotice = this.terminalBody.querySelector('.cvt-pruned-notice');
    if (oldNotice) {
      this.terminalBody.removeChild(oldNotice);
      this.domLineCount--;
    }

    // Batch remove
    let removed = 0;
    while (removed < PRUNE_BATCH && this.terminalBody.firstChild) {
      this.terminalBody.removeChild(this.terminalBody.firstChild);
      removed++;
    }
    this.domLineCount -= removed;

    // Calculate how many total lines have been pruned (total logs - current DOM lines)
    const totalPruned = this.logs.length - this.domLineCount;

    // Insert a notice at the top
    const notice = document.createElement('div');
    notice.className = 'cvt-pruned-notice';
    notice.textContent = `── ${totalPruned} earlier entries hidden ──`;
    this.terminalBody.insertBefore(notice, this.terminalBody.firstChild);
    this.domLineCount++;
  }

  /**
   * Throttled scroll-to-bottom.  At most once per SCROLL_THROTTLE_MS,
   * and always via rAF so we never force synchronous layout.
   */
  private _scheduleScroll() {
    if (this.scrollPending) return;
    const now = performance.now();
    const wait = Math.max(0, SCROLL_THROTTLE_MS - (now - this.lastScrollTime));

    this.scrollPending = true;
    if (wait === 0) {
      this.scrollRAF = requestAnimationFrame(() => this._doScroll());
    } else {
      setTimeout(() => {
        this.scrollRAF = requestAnimationFrame(() => this._doScroll());
      }, wait);
    }
  }

  private _doScroll() {
    this.scrollPending = false;
    this.lastScrollTime = performance.now();
    this.scrollRAF = null;
    if (this.terminalBody) {
      this.terminalBody.scrollTop = this.terminalBody.scrollHeight;
    }
  }

  private _cancelPendingScroll() {
    this.scrollPending = false;
    if (this.scrollRAF !== null) {
      cancelAnimationFrame(this.scrollRAF);
      this.scrollRAF = null;
    }
  }

  private _updateTimer() {
    if (this.timerEl) {
      const elapsed = ((performance.now() - this.startTime) / 1000).toFixed(1);
      this.timerEl.textContent = `${elapsed}s`;
    }
  }

  private _startDots() {
    let dotCount = 0;
    this.dotInterval = setInterval(() => {
      dotCount = (dotCount + 1) % 4;
      if (this.progressDots) {
        this.progressDots.textContent = '.'.repeat(dotCount);
      }
      this._updateTimer();
    }, 400);
  }

  private _stopDots() {
    if (this.dotInterval) {
      clearInterval(this.dotInterval);
      this.dotInterval = null;
    }
  }

  private _addCloseButton() {
    // Prevent duplicate close buttons
    if (this.modal.querySelector('.cvt-close-row')) return;

    const closeRow = document.createElement('div');
    closeRow.className = 'cvt-close-row';
    const btn = document.createElement('button');
    btn.className = 'cvt-close-btn';
    btn.textContent = 'Close';
    btn.addEventListener('click', () => window.hidePopup());
    closeRow.appendChild(btn);
    this.modal.querySelector('.cvt-modal')?.appendChild(closeRow);
  }
}
