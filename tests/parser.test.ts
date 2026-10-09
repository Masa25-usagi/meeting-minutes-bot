import test from "node:test";
import assert from "node:assert/strict";
import { parseGoogleMeetNote } from "../src/parser.ts";

const sampleNote = `
📝 メモ
9月 14, 2026
会議 2026年9月14日 22:30 JST
会議の記録 文字起こし 

概要
富山訪問の計画策定とDiscordボットの設定作業および翌日の対応確認を行った

富山旅行の移動と観光
富山や高岡での移動手段や観光地を検討し、高岡駅周辺でラーメンを食べてから富山市へ移動する計画に合意した。

Discordボットの導入
Discordサーバーにヘルメスエージェントを導入するための設定や権限の付与作業を実施した。

決定事項
さらなる議論が必要
* 千葉ヒアリングと政策案策定の進め方 メンバーは千葉での現地ヒアリングの準備方針を保留した。

調整済み
* 千葉での災害対応現地ヒアリング実施 メンバーは現地ヒアリングを実施することに合意した。

次のステップ
* [pta, なむ] 10月12日の予定調整: 10月12日に高岡市に集合してカフェを巡る計画を確定させる。
* [pta] ブラックラーメン店調査: 高岡駅周辺の食べやすいブラックラーメン店をリサーチする。
* [なむ] 選挙制度改革案作成: 野党の役割に基づいた選挙制度改革の施策案を作成する。
`;

test("parseGoogleMeetNote extracts date, overview, topics, decisions, and nextSteps", () => {
  const note = parseGoogleMeetNote(sampleNote);
  assert.equal(note.date, "2026年9月14日 22:30 JST");
  assert.equal(note.overview.includes("富山訪問の計画策定"), true);
  assert.equal(note.topics.length, 2);
  assert.equal(note.topics[0].title, "富山旅行の移動と観光");

  assert.equal(note.decisions.length, 2);
  assert.equal(note.decisions[0].title, "千葉ヒアリングと政策案策定の進め方");
  assert.equal(note.decisions[0].category, "さらなる議論が必要");
  assert.equal(note.decisions[1].category, "調整済み");

  assert.equal(note.nextSteps.length, 3);
  assert.equal(note.nextSteps[0].assignee, "pta, なむ");
  assert.equal(note.nextSteps[0].title, "10月12日の予定調整");
  assert.equal(note.nextSteps[1].assignee, "pta");
  assert.equal(note.nextSteps[2].assignee, "なむ");
});

test("parseGoogleMeetNote correctly parses short date format and untitled meeting title", () => {
  const noteContent = `
📝 メモ
9月 29, 2026
無題の会議
会議の記録 文字起こし

概要
サポートされている言語での会話量が不足しているため、この会議の要約は生成されませんでした。
会議の文字起こしが行われた場合は、このドキュメント内にある会議記録セクションのリンクから文字起こしを確認できます。
`;
  const note = parseGoogleMeetNote(noteContent);
  assert.equal(note.date, "2026年9月29日");
  assert.equal(note.title, "無題の会議");
});
