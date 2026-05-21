import type { FileFormat, FileData, ConvertPathNode } from "@/core/format-handler.ts";
import type { TraversionGraph } from "@/core/traversion-graph.ts";

declare global {
  interface Window {
    supportedFormatCache: Map<string, FileFormat[]>;
    traversionGraph: TraversionGraph;
    printSupportedFormatCache: () => string;
    showPopup: (html: string) => void;
    hidePopup: () => void;
    tryConvertByTraversing: (files: FileData[], from: ConvertPathNode, to: ConvertPathNode) => Promise<{
      files: FileData[];
      path: ConvertPathNode[];
    } | null>;
  }
}

export { };
