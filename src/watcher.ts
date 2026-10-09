import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { WatcherState } from "./types.ts";

export function loadWatcherState(stateFilePath: string): WatcherState {
  if (fs.existsSync(stateFilePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(stateFilePath, "utf-8"));
      if (parsed && typeof parsed === "object" && typeof parsed.processedFiles === "object" && parsed.processedFiles !== null) {
        return parsed as WatcherState;
      }
      return { processedFiles: {} };
    } catch {
      return { processedFiles: {} };
    }
  }
  return { processedFiles: {} };
}

/**
 * Saves watcher state atomically using a temporary file and renameSync
 * to prevent corruption during unexpected crashes or concurrent executions.
 */
export function saveWatcherState(stateFilePath: string, state: WatcherState): void {
  const dir = path.dirname(stateFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tmpFile = `${stateFilePath}.${process.pid}.${randomUUID().slice(0, 8)}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), "utf-8");
  fs.renameSync(tmpFile, stateFilePath);
}

export function scanForNewMeetingFiles(
  directoryPath: string,
  state: WatcherState
): string[] {
  if (!fs.existsSync(directoryPath)) return [];

  const processed = state?.processedFiles || {};
  const newFiles: string[] = [];

  function traverse(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith(".")) {
          traverse(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (ext === ".txt" || ext === ".md") {
          const stat = fs.statSync(fullPath);
          const lastProcessed = processed[fullPath];
          if (!lastProcessed || stat.mtimeMs > lastProcessed.mtimeMs) {
            newFiles.push(fullPath);
          }
        }
      }
    }
  }

  traverse(directoryPath);
  return newFiles;
}
