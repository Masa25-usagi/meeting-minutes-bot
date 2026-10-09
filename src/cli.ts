#!/usr/bin/env node
import fs from "node:fs";
import { parseGoogleMeetNote } from "./parser.ts";
import { formatMeetingDiscordPayload, sendDiscordWebhook } from "./discord.ts";
import { loadWatcherState, saveWatcherState, scanForNewMeetingFiles } from "./watcher.ts";

function printUsage() {
  console.log(`
minutes-bot - Google Meet Minutes Discord Notifier

Usage:
  minutes-bot parse <file.txt> [--json]
  minutes-bot notify --file <file.txt> [--webhook <url>] [--dry-run]
  minutes-bot sync-dir --dir <path> [--webhook <url>] [--state <path>] [--dry-run]
`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  const command = args[0];

  if (command === "parse") {
    const file = args[1];
    if (!file) {
      console.error("Error: Please specify minutes file.");
      process.exit(1);
    }
    const content = fs.readFileSync(file, "utf-8");
    const note = parseGoogleMeetNote(content);
    if (args.includes("--json")) {
      console.log(JSON.stringify(note, null, 2));
    } else {
      console.log(`=== ${note.title} (${note.date}) ===\n`);
      console.log(`【概要】\n${note.overview}\n`);
      if (note.decisions.length > 0) {
        console.log("【決定事項】");
        for (const d of note.decisions) console.log(`・${d.title}: ${d.description}`);
        console.log("");
      }
      if (note.nextSteps.length > 0) {
        console.log("【次のステップ（ToDo）】");
        for (const s of note.nextSteps) console.log(`・[${s.assignee}] ${s.title}: ${s.task}`);
        console.log("");
      }
    }
    return;
  }

  if (command === "notify") {
    let filePath = "";
    let webhookUrl = process.env.DISCORD_WEBHOOK_URL || "";
    let dryRun = false;

    for (let i = 1; i < args.length; i++) {
      if (args[i] === "--file" && args[i + 1]) filePath = args[++i];
      else if (args[i] === "--webhook" && args[i + 1]) webhookUrl = args[++i];
      else if (args[i] === "--dry-run") dryRun = true;
    }

    if (!filePath) {
      console.error("Error: --file argument is required.");
      process.exit(1);
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const note = parseGoogleMeetNote(content);
    const payload = formatMeetingDiscordPayload(note);

    if (dryRun || !webhookUrl) {
      console.log("=== Dry Run (Discord Payload) ===");
      console.log(JSON.stringify(payload, null, 2));
      return;
    }

    const ok = await sendDiscordWebhook(webhookUrl, payload);
    console.log(ok ? "Successfully sent to Discord!" : "Failed to send to Discord.");
    return;
  }

  if (command === "sync-dir") {
    let dirPath = "";
    let webhookUrl = process.env.DISCORD_WEBHOOK_URL || "";
    let statePath = ".synced-meetings.json";
    let dryRun = false;

    for (let i = 1; i < args.length; i++) {
      if (args[i] === "--dir" && args[i + 1]) dirPath = args[++i];
      else if (args[i] === "--webhook" && args[i + 1]) webhookUrl = args[++i];
      else if (args[i] === "--state" && args[i + 1]) statePath = args[++i];
      else if (args[i] === "--dry-run") dryRun = true;
    }

    if (!dirPath) {
      console.error("Error: --dir argument is required.");
      process.exit(1);
    }

    const state = loadWatcherState(statePath);
    const newFiles = scanForNewMeetingFiles(dirPath, state);
    console.log(`Found ${newFiles.length} new/updated meeting files in ${dirPath}.`);

    for (const f of newFiles) {
      console.log(`Processing: ${f}`);
      const content = fs.readFileSync(f, "utf-8");
      const note = parseGoogleMeetNote(content);
      const payload = formatMeetingDiscordPayload(note);

      if (!dryRun && webhookUrl) {
        await sendDiscordWebhook(webhookUrl, payload);
      } else {
        console.log(`[DryRun] Prepared message for: ${note.title}`);
      }

      state.processedFiles[f] = {
        mtimeMs: fs.statSync(f).mtimeMs,
        processedAt: new Date().toISOString()
      };
    }

    if (!dryRun) {
      saveWatcherState(statePath, state);
    }
    return;
  }

  console.error(`Unknown command: ${command}`);
  printUsage();
  process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
