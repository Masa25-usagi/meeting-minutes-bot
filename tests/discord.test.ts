import test from "node:test";
import assert from "node:assert/strict";
import { formatMeetingDiscordPayload } from "../src/discord.ts";
import type { MeetingNote } from "../src/types.ts";

const sampleNote: MeetingNote = {
  title: "富山訪問とDiscordボット設定",
  date: "2026年9月14日 22:30 JST",
  rawDate: "2026-09-14",
  overview: "富山訪問の計画策定とDiscordボットの設定作業を行った。",
  topics: [
    { title: "富山旅行の移動", summary: "高岡駅で集合" }
  ],
  decisions: [
    { category: "決定", title: "千葉ヒアリング", description: "実施決定" }
  ],
  nextSteps: [
    { assignee: "なむ", title: "ボット設定", task: "トークン設定" }
  ],
  rawContent: ""
};

test("formatMeetingDiscordPayload generates Discord Webhook structure with fields", () => {
  const payload = formatMeetingDiscordPayload(sampleNote);
  assert.equal(payload.embeds.length, 1);
  const embed = payload.embeds[0];
  assert.equal(embed.title.includes("富山訪問とDiscordボット設定"), true);
  assert.equal(embed.description.includes("富山訪問の計画策定"), true);
  assert.equal(embed.fields.length, 3);
  assert.equal(embed.fields[0].name.includes("次のステップ"), true);
  assert.equal(embed.fields[0].value.includes("なむ"), true);
  assert.equal(embed.fields[1].name.includes("決定事項"), true);
  assert.equal(embed.fields[2].name.includes("主な議題"), true);
});

test("formatMeetingDiscordPayload chunks long list of next steps into multiple fields", () => {
  const manyStepsNote: MeetingNote = {
    title: "長期タスク会議",
    date: "2026年9月18日 15:58 JST",
    rawDate: "2026-09-18",
    overview: "多くの次のステップを含む会議メモのテスト。",
    topics: [],
    decisions: [],
    nextSteps: Array.from({ length: 15 }, (_, i) => ({
      assignee: `担当者${i + 1}`,
      title: `タスク詳細項目${i + 1}`,
      task: `長文のタスク内容説明文${i + 1}。`.repeat(5)
    })),
    rawContent: ""
  };

  const payload = formatMeetingDiscordPayload(manyStepsNote);
  const embed = payload.embeds[0];
  const stepFields = embed.fields.filter(f => f.name.includes("次のステップ"));
  assert.equal(stepFields.length >= 2, true);
  for (const f of stepFields) {
    assert.equal(f.value.length <= 1024, true);
    assert.notEqual(f.value.length, 0);
  }
});

test("formatMeetingDiscordPayload enforces Discord 25 fields maximum limit", () => {
  const hugeNote: MeetingNote = {
    title: "超多数議題会議",
    date: "2026年9月20日",
    rawDate: "2026-09-20",
    overview: "合計30件以上の項目を持つ会議メモ",
    topics: Array.from({ length: 30 }, (_, i) => ({
      title: `議題${i + 1}`,
      summary: `議題詳細説明${i + 1}`
    })),
    decisions: [],
    nextSteps: [],
    rawContent: ""
  };

  const payload = formatMeetingDiscordPayload(hugeNote);
  const embed = payload.embeds[0];
  assert.equal(embed.fields.length <= 25, true, "Discord embed fields must never exceed 25");
});

