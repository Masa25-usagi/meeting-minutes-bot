import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { loadWatcherState, saveWatcherState, scanForNewMeetingFiles } from "../src/watcher.ts";

test("watcher state load/save and file scanning", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "minutes-watcher-test-"));
  const statePath = path.join(tmpDir, "state.json");
  const meetingFile = path.join(tmpDir, "sample_meeting.txt");

  fs.writeFileSync(meetingFile, "概要\nテスト会議", "utf-8");

  const state1 = loadWatcherState(statePath);
  const found = scanForNewMeetingFiles(tmpDir, state1);
  assert.equal(found.length, 1);
  assert.equal(found[0], meetingFile);

  // Update state
  state1.processedFiles[meetingFile] = {
    mtimeMs: fs.statSync(meetingFile).mtimeMs,
    processedAt: new Date().toISOString()
  };
  saveWatcherState(statePath, state1);

  // Re-scan with updated state
  const state2 = loadWatcherState(statePath);
  const foundAgain = scanForNewMeetingFiles(tmpDir, state2);
  assert.equal(foundAgain.length, 0);

  // Verify atomic save left no stray .tmp files
  const tmpEntries = fs.readdirSync(tmpDir).filter(f => f.endsWith(".tmp"));
  assert.equal(tmpEntries.length, 0, "No leftover .tmp files should exist after atomic rename");

  // Save to non-existent nested directory works atomically
  const nestedStatePath = path.join(tmpDir, "sub", "dir", "state.json");
  saveWatcherState(nestedStatePath, state2);
  const nestedLoaded = loadWatcherState(nestedStatePath);
  assert.deepEqual(nestedLoaded, state2);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("loadWatcherState handles state file without processedFiles without throwing", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "minutes-corrupt-test-"));
  const corruptStatePath = path.join(tmpDir, "corrupted_state.json");
  fs.writeFileSync(corruptStatePath, JSON.stringify({ version: 1, lastCheck: 12345 }), "utf-8");

  const loaded = loadWatcherState(corruptStatePath);
  assert.deepEqual(loaded.processedFiles, {});

  // Scanning with this state should not throw TypeError
  assert.doesNotThrow(() => {
    scanForNewMeetingFiles(tmpDir, loaded);
  });

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

