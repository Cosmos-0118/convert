import type { FileFormat, FileData, FormatHandler, ConvertPathNode } from "@/core/format-handler.ts";
import normalizeMimeType from "@/core/normalize-mime-type.ts";
import handlers from "@/handlers/registry.ts";
import { TraversionGraph } from "@/core/traversion-graph.ts";
import { createIcons, icons } from 'lucide';
import { ConversionModal } from './conversion-modal.ts';
import './conversion-modal.css';

// Initialize icons immediately
createIcons({ icons });

/** Singleton modal for conversion progress */
const conversionModal = new ConversionModal();

/** Files currently selected for conversion */
let selectedFiles: File[] = [];
/**
 * Whether to use "simple" mode.
 * - In **simple** mode, the input/output lists are grouped by file format.
 * - In **advanced** mode, these lists are grouped by format handlers, which
 *   requires the user to manually select the tool that processes the output.
 */
let simpleMode: boolean = true;

const ui = {
  fileInput: document.querySelector("#file-input") as HTMLInputElement,
  fileSelectArea: document.querySelector("#file-area") as HTMLDivElement,
  convertButton: document.querySelector("#convert-button") as HTMLButtonElement,
  modeToggleButton: document.querySelector("#mode-button") as HTMLButtonElement,
  inputList: document.querySelector("#from-list") as HTMLDivElement,
  outputList: document.querySelector("#to-list") as HTMLDivElement,
  inputSearch: document.querySelector("#search-from") as HTMLInputElement,
  outputSearch: document.querySelector("#search-to") as HTMLInputElement,
  popupBox: document.querySelector("#popup") as HTMLDivElement,
  popupBackground: document.querySelector("#popup-bg") as HTMLDivElement,
  formatContainers: document.querySelector("#format-containers") as HTMLDivElement,
  
  // Steps
  stepUpload: document.querySelector("#step-upload") as HTMLDivElement,
  stepFormats: document.querySelector("#step-formats") as HTMLDivElement,
  heroHeader: document.querySelector("#hero-header") as HTMLElement,
  selectedFileName: document.querySelector("#selected-file-name") as HTMLDivElement,
  selectedFileCount: document.querySelector("#selected-file-count") as HTMLDivElement,
  btnChangeFile: document.querySelector("#btn-change-file") as HTMLButtonElement,
};

// Ensure popup is visible initially if needed
ui.popupBackground.style.display = "block";
ui.popupBackground.style.opacity = "1";
ui.popupBox.style.display = "flex";
ui.popupBox.style.opacity = "1";
ui.popupBox.style.transform = "scale(1)";

/**
 * Filters a list of butttons to exclude those not matching a substring.
 * @param list Button list (div) to filter.
 * @param string Substring for which to search.
 */
const filterButtonList = (list: HTMLDivElement, string: string) => {
  const lower = string.toLowerCase();
  for (const button of Array.from(list.children)) {
    if (!(button instanceof HTMLButtonElement)) continue;
    const formatIndex = button.getAttribute("format-index");
    let hasExtension = false;
    if (formatIndex) {
      const format = allOptions[parseInt(formatIndex)];
      hasExtension = format?.format.extension.toLowerCase().includes(lower);
    }
    // Search across all visible text in the button's inner structure
    const fullText = button.textContent?.toLowerCase() || '';
    if (!hasExtension && !fullText.includes(lower)) {
      button.style.display = "none";
    } else {
      button.style.display = "";
    }
  }
}

/**
 * Handles search box input by filtering its parent container.
 * @param event Input event from an {@link HTMLInputElement}
 */
const searchHandler = (event: Event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;

  const targetContainer = target.closest('.format-container');
  const targetParentList = targetContainer?.querySelector(".format-list");
  if (!(targetParentList instanceof HTMLDivElement)) return;

  const string = target.value.toLowerCase();
  filterButtonList(targetParentList, string);
};

// Assign search handler to both search boxes
ui.inputSearch.oninput = searchHandler;
ui.outputSearch.oninput = searchHandler;

// Map clicks in the file selection area to the file input element
ui.fileSelectArea.onclick = () => {
  ui.fileInput.click();
};

/**
 * Validates and stores user selected files. Works for both manual
 * selection and file drag-and-drop.
 * @param event Either a file input element's "change" event,
 * or a "drop" event.
 */
const fileSelectHandler = (event: Event) => {

  let inputFiles;

  if (event instanceof DragEvent) {
    inputFiles = event.dataTransfer?.files;
    if (inputFiles) event.preventDefault();
  } else if (event instanceof ClipboardEvent) {
    inputFiles = event.clipboardData?.files;
  } else {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    inputFiles = target.files;
  }

  if (!inputFiles) return;
  const files = Array.from(inputFiles);
  if (files.length === 0) return;

  if (files.some(c => c.type !== files[0].type)) {
    return alert("All input files must be of the same type.");
  }
  files.sort((a, b) => a.name === b.name ? 0 : (a.name < b.name ? -1 : 1));
  selectedFiles = files;

  // Switch Steps
  ui.stepUpload.style.display = "none";
  ui.stepFormats.style.display = "flex";
  ui.heroHeader.style.display = "none";
  const card = document.querySelector(".converter-card");
  if (card) card.classList.add("expanded");

  if (files.length === 1) {
    ui.selectedFileName.textContent = files[0].name;
    ui.selectedFileCount.textContent = "1 file selected";
  } else {
    ui.selectedFileName.textContent = `Batch Conversion`;
    ui.selectedFileCount.textContent = `${files.length} files selected`;
  }

  // Common MIME type adjustments (to match "mime" library)
  let mimeType = normalizeMimeType(files[0].type);

  const fileExtension = files[0].name.split(".").pop()?.toLowerCase();

  // Find all buttons matching the input MIME type.
  const buttonsMatchingMime = Array.from(ui.inputList.children).filter(button => {
    if (!(button instanceof HTMLButtonElement)) return false;
    return button.getAttribute("mime-type") === mimeType;
  }) as HTMLButtonElement[];
  // If there are multiple, find one with a matching extension too
  let inputFormatButton: HTMLButtonElement;
  if (buttonsMatchingMime.length > 1) {
    inputFormatButton = buttonsMatchingMime.find(button => {
      const formatIndex = button.getAttribute("format-index");
      if (!formatIndex) return;
      const format = allOptions[parseInt(formatIndex)];
      return format.format.extension === fileExtension;
    }) || buttonsMatchingMime[0];
  } else {
    inputFormatButton = buttonsMatchingMime[0];
  }
  // Click button with matching MIME type.
  if (mimeType && inputFormatButton instanceof HTMLButtonElement) {
    inputFormatButton.click();
    ui.inputSearch.value = mimeType;
    filterButtonList(ui.inputList, ui.inputSearch.value);
    return;
  }

  // Fall back to matching format by file extension if MIME type wasn't found.
  const buttonExtension = Array.from(ui.inputList.children).find(button => {
    if (!(button instanceof HTMLButtonElement)) return false;
    const formatIndex = button.getAttribute("format-index");
    if (!formatIndex) return;
    const format = allOptions[parseInt(formatIndex)];
    return format.format.extension.toLowerCase() === fileExtension;
  });
  if (buttonExtension instanceof HTMLButtonElement) {
    buttonExtension.click();
    ui.inputSearch.value = buttonExtension.getAttribute("mime-type") || "";
  } else {
    ui.inputSearch.value = fileExtension || "";
  }

  filterButtonList(ui.inputList, ui.inputSearch.value);

};

// Add the file selection handler to both the file input element and to
// the window as a drag-and-drop event, and to the clipboard paste event.
ui.fileInput.addEventListener("change", fileSelectHandler);
window.addEventListener("drop", fileSelectHandler);
window.addEventListener("dragover", e => e.preventDefault());
window.addEventListener("paste", fileSelectHandler);

// Handle "Change Files" button click
ui.btnChangeFile.addEventListener("click", () => {
  selectedFiles = [];
  ui.stepUpload.style.display = "block";
  ui.stepFormats.style.display = "none";
  ui.heroHeader.style.display = "block";
  ui.fileInput.value = "";
  
  // Remove expanded class
  const card = document.querySelector(".converter-card");
  if (card) card.classList.remove("expanded");
  
  // Deselect format buttons
  const allSelected = document.querySelectorAll('.format-list .selected');
  allSelected.forEach(el => el.classList.remove('selected'));
  ui.convertButton.className = "btn-primary disabled";
});

/**
 * Display an on-screen popup.
 * @param html HTML content of the popup box.
 */
window.showPopup = function (html: string) {
  ui.popupBox.innerHTML = `<div class="modal-content">${html}</div>`;
  ui.popupBox.style.display = "flex";
  ui.popupBackground.style.display = "block";
  // Force reflow
  void ui.popupBox.offsetWidth;
  ui.popupBox.style.opacity = "1";
  ui.popupBox.style.transform = "scale(1)";
  ui.popupBackground.style.opacity = "1";
}
/**
 * Hide the on-screen popup.
 */
window.hidePopup = function () {
  ui.popupBox.style.opacity = "0";
  ui.popupBox.style.transform = "scale(0.95)";
  ui.popupBackground.style.opacity = "0";
  setTimeout(() => {
    ui.popupBox.style.display = "none";
    ui.popupBackground.style.display = "none";
  }, 300);
}

const allOptions: Array<{ format: FileFormat, handler: FormatHandler }> = [];

window.supportedFormatCache = new Map();
window.traversionGraph = new TraversionGraph();

window.printSupportedFormatCache = () => {
  const entries = [];
  for (const entry of window.supportedFormatCache) {
    entries.push(entry);
  }
  return JSON.stringify(entries, null, 2);
}


async function buildOptionList () {

  allOptions.length = 0;
  ui.inputList.innerHTML = "";
  ui.outputList.innerHTML = "";

  for (const handler of handlers) {
    if (!window.supportedFormatCache.has(handler.name)) {
      console.warn(`Cache miss for formats of handler "${handler.name}".`);
      try {
        await handler.init();
      } catch (_) { continue; }
      if (handler.supportedFormats) {
        window.supportedFormatCache.set(handler.name, handler.supportedFormats);
        console.info(`Updated supported format cache for "${handler.name}".`);
      }
    }
    const supportedFormats = window.supportedFormatCache.get(handler.name);
    if (!supportedFormats) {
      console.warn(`Handler "${handler.name}" doesn't support any formats.`);
      continue;
    }
    for (const format of supportedFormats) {

      if (!format.mime) continue;

      allOptions.push({ format, handler });

      // In simple mode, display each input/output format only once
      let addToInputs = true, addToOutputs = true;
      if (simpleMode) {
        addToInputs = !Array.from(ui.inputList.children).some(c => {
          const currFormat = allOptions[parseInt(c.getAttribute("format-index") || "")]?.format;
          return currFormat?.mime === format.mime && currFormat?.format === format.format;
        });
        addToOutputs = !Array.from(ui.outputList.children).some(c => {
          const currFormat = allOptions[parseInt(c.getAttribute("format-index") || "")]?.format;
          return currFormat?.mime === format.mime && currFormat?.format === format.format;
        });
        if ((!format.from || !addToInputs) && (!format.to || !addToOutputs)) continue;
      }

      const newOption = document.createElement("button");
      newOption.setAttribute("format-index", (allOptions.length - 1).toString());
      newOption.setAttribute("mime-type", format.mime);

      // Determine category for color dot
      const category = Array.isArray(format.category)
        ? format.category[0]
        : (format.category || format.mime.split("/")[0]);
      newOption.setAttribute("data-category", category);

      const formatDescriptor = format.format.toUpperCase();
      const ext = format.extension ? `.${format.extension}` : '';

      if (simpleMode) {
        const cleanName = format.name
          .split("(").join(")").split(")")
          .filter((_, i) => i % 2 === 0)
          .filter(c => c != "")
          .join(" ")
          .trim();
        newOption.innerHTML = `
          <span class="fmt-cat-dot" data-cat="${category}"></span>
          <span class="fmt-ext">${formatDescriptor}</span>
          <span class="fmt-info">
            <span class="fmt-name">${cleanName}</span>
            <span class="fmt-mime">${format.mime}${ext ? ` · ${ext}` : ''}</span>
          </span>
        `;
      } else {
        newOption.innerHTML = `
          <span class="fmt-cat-dot" data-cat="${category}"></span>
          <span class="fmt-ext">${formatDescriptor}</span>
          <span class="fmt-info">
            <span class="fmt-name">${format.name}</span>
            <span class="fmt-mime">${format.mime}${ext ? ` · ${ext}` : ''} · ${handler.name}</span>
          </span>
        `;
      }

      const clickHandler = (event: Event) => {
        const btn = (event.target as HTMLElement).closest('button');
        if (!btn) return;
        const targetParent = btn.parentElement;
        const previous = targetParent?.querySelector('.selected');
        if (previous) previous.classList.remove('selected');
        btn.classList.add('selected');
        const allSelected = document.querySelectorAll('.format-list .selected');
        if (allSelected.length === 2) {
          ui.convertButton.className = "btn-primary";
        } else {
          ui.convertButton.className = "btn-primary disabled";
        }
      };

      if (format.from && addToInputs) {
        const clone = newOption.cloneNode(true) as HTMLButtonElement;
        clone.onclick = clickHandler;
        ui.inputList.appendChild(clone);
      }
      if (format.to && addToOutputs) {
        const clone = newOption.cloneNode(true) as HTMLButtonElement;
        clone.onclick = clickHandler;
        ui.outputList.appendChild(clone);
      }

    }
  }
  window.traversionGraph.init(window.supportedFormatCache, handlers);
  filterButtonList(ui.inputList, ui.inputSearch.value);
  filterButtonList(ui.outputList, ui.outputSearch.value);

  window.hidePopup();

}

(async () => {
  try {
    const cacheJSON = await fetch("cache.json").then(r => r.json());
    window.supportedFormatCache = new Map(cacheJSON);
  } catch {
    console.warn(
      "Missing supported format precache.\n\n" +
      "Consider saving the output of printSupportedFormatCache() to cache.json."
    );
  } finally {
    // Yield to the browser render loop before running heavy initialization tasks
    await new Promise(resolve => setTimeout(resolve, 100));
    await buildOptionList();
    console.log("Built initial format list.");
  }
})();

ui.modeToggleButton.addEventListener("click", () => {
  simpleMode = !simpleMode;
  const span = ui.modeToggleButton.querySelector("span");
  if (simpleMode) {
    if (span) span.textContent = "Basic";
    document.body.classList.remove("advanced-mode");
  } else {
    if (span) span.textContent = "Advanced";
    document.body.classList.add("advanced-mode");
  }
  buildOptionList();
});

const themePicker = document.getElementById("theme-picker");
const themeBtn = document.getElementById("theme-btn");
const currentThemeName = document.getElementById("current-theme-name");
const themeOptions = document.querySelectorAll(".theme-option");

if (themePicker && themeBtn && currentThemeName) {
  // Toggle menu open/close
  themeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    themePicker.classList.toggle("open");
  });

  // Close menu when clicking outside
  document.addEventListener("click", (e) => {
    if (!themePicker.contains(e.target as Node)) {
      themePicker.classList.remove("open");
    }
  });

  // Handle theme selection
  themeOptions.forEach(option => {
    option.addEventListener("click", () => {
      const val = option.getAttribute("data-theme-val");
      const name = option.textContent?.trim() || "";
      if (!val) return;

      // Update UI state
      themeOptions.forEach(opt => opt.classList.remove("active"));
      option.classList.add("active");
      currentThemeName.textContent = name;
      themePicker.classList.remove("open");

      // Apply theme
      document.documentElement.setAttribute("data-theme", val);
      
      // Update theme-color meta tag
      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) {
        if (val === 'dark') {
          metaThemeColor.setAttribute("content", "#0f172a");
        } else if (val === 'black-red') {
          metaThemeColor.setAttribute("content", "#000000");
        } else {
          metaThemeColor.setAttribute("content", "#f8fafc");
        }
      }
    });
  });
}

let deadEndAttempts: ConvertPathNode[][];

async function attemptConvertPath (files: FileData[], path: ConvertPathNode[]) {

  const pathString = path.map(c => c.format.format).join(" → ");

  // Exit early if we've encountered a known dead end
  for (const deadEnd of deadEndAttempts) {
    let isDeadEnd = true;
    for (let i = 0; i < deadEnd.length; i++) {
      if (path[i] === deadEnd[i]) continue;
      isDeadEnd = false;
      break;
    }
    if (isDeadEnd) {
      const deadEndString = deadEnd.slice(-2).map(c => c.format.format).join(" → ");
      console.warn(`Skipping ${pathString} due to dead end near ${deadEndString}.`);
      return null;
    }
  }

  conversionModal.logPath(path.map(c => c.format.format));

  for (let i = 0; i < path.length - 1; i ++) {
    const handler = path[i + 1].handler;
    try {
      let supportedFormats = window.supportedFormatCache.get(handler.name);
      if (!handler.ready) {
        conversionModal.log('info', `Initializing ${handler.name}...`);
        await handler.init();
        if (!handler.ready) throw `Handler "${handler.name}" not ready after init.`;
        if (handler.supportedFormats) {
          window.supportedFormatCache.set(handler.name, handler.supportedFormats);
          supportedFormats = handler.supportedFormats;
        }
      }
      if (!supportedFormats) throw `Handler "${handler.name}" doesn't support any formats.`;
      const inputFormat = supportedFormats.find(c =>
        c.from
        && c.mime === path[i].format.mime
        && c.format === path[i].format.format
      ) || (handler.supportAnyInput ? path[i].format : undefined);
      if (!inputFormat) throw `Handler "${handler.name}" doesn't support the "${path[i].format.format}" format.`;
      
      conversionModal.logStep(handler.name, path[i].format.format, path[i + 1].format.format);

      // Force the browser to paint the terminal log before synchronous WebAssembly blocks the thread
      await new Promise(resolve => setTimeout(resolve, 50));
      
      files = (await Promise.all([
        handler.doConvert(files, inputFormat, path[i + 1].format),
        // Ensure that we wait long enough for the UI to update
        new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      ]))[0];
      if (files.some(c => !c.bytes.length)) throw "Output is empty.";

      conversionModal.log('success', `${path[i].format.format} → ${path[i + 1].format.format} done`);
    } catch (e) {

      console.log(path.map(c => c.format.format));
      console.error(handler.name, `${path[i].format.format} → ${path[i + 1].format.format}`, e);

      // Dead ends are added both to the graph and to the attempt system.
      // The graph may still have old paths queued from before they were
      // marked as dead ends, so we catch that here.
      const deadEndPath = path.slice(0, i + 2);
      deadEndAttempts.push(deadEndPath);
      window.traversionGraph.addDeadEndPath(path.slice(0, i + 2));

      conversionModal.logRetry(`${path[i].format.format} → ${path[i + 1].format.format} failed via ${handler.name}`);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      return null;

    }
  }

  return { files, path };

}

window.tryConvertByTraversing = async function (
  files: FileData[],
  from: ConvertPathNode,
  to: ConvertPathNode
) {
  deadEndAttempts = [];
  window.traversionGraph.clearDeadEndPaths();
  for await (const path of window.traversionGraph.searchPath(from, to, simpleMode)) {
    // Use exact output format if the target handler supports it
    if (path.at(-1)?.handler === to.handler) {
      path[path.length - 1] = to;
    }
    const attempt = await attemptConvertPath(files, path);
    if (attempt) return attempt;
  }
  return null;
}

function downloadFile (bytes: Uint8Array, name: string) {
  const blob = new Blob([bytes as BlobPart], { type: "application/octet-stream" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
}

ui.convertButton.onclick = async function () {

  const inputFiles = selectedFiles;

  if (inputFiles.length === 0) {
    return alert("Select an input file.");
  }

  const inputButton = document.querySelector("#from-list .selected");
  if (!inputButton) return alert("Specify input file format.");

  const outputButton = document.querySelector("#to-list .selected");
  if (!outputButton) return alert("Specify output file format.");

  const inputOption = allOptions[Number(inputButton.getAttribute("format-index"))];
  const outputOption = allOptions[Number(outputButton.getAttribute("format-index"))];

  const inputFormat = inputOption.format;
  const outputFormat = outputOption.format;

  const conversionStart = performance.now();

  try {

    const inputFileData = [];
    for (const inputFile of inputFiles) {
      const inputBuffer = await inputFile.arrayBuffer();
      const inputBytes = new Uint8Array(inputBuffer);
      if (
        inputFormat.mime === outputFormat.mime
        && inputFormat.format === outputFormat.format
      ) {
        downloadFile(inputBytes, inputFile.name);
        continue;
      }
      inputFileData.push({ name: inputFile.name, bytes: inputBytes });
    }

    conversionModal.showLoading(inputFormat.format, outputFormat.format);
    // Delay for a bit to give the browser time to render
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    conversionModal.log('info', `Reading ${inputFiles.length} file(s)...`);

    const output = await window.tryConvertByTraversing(inputFileData, inputOption, outputOption);
    if (!output) {
      conversionModal.showError('No valid conversion route found.');
      return;
    }

    for (const file of output.files) {
      downloadFile(file.bytes, file.name);
    }

    const elapsed = performance.now() - conversionStart;
    conversionModal.showSuccess(
      output.path.map(c => c.format.format),
      elapsed
    );

  } catch (e) {

    conversionModal.showError(String(e));
    console.error(e);

  }

};

// Display the current git commit SHA in the UI, if available
{
  const commitElement = document.querySelector("#commit-id .commit-text");
  if (commitElement) {
    commitElement.textContent = import.meta.env.VITE_COMMIT_SHA ?? "unknown";
  }
}
