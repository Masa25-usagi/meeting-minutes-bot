import type { MeetingNote, DiscordWebhookPayload, DiscordEmbed, DiscordEmbedField } from "./types.ts";

const discordSegmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  let result = "";
  let count = 0;
  const target = maxLen - 3;
  for (const item of discordSegmenter.segment(str)) {
    if (count + item.segment.length > target) break;
    result += item.segment;
    count += item.segment.length;
  }
  return result + "...";
}

function addChunkedFields(
  fields: DiscordEmbedField[],
  baseName: string,
  lines: string[],
  maxFieldLen = 1000
) {
  if (lines.length === 0) return;

  const chunks: string[] = [];
  let cur = "";

  for (const line of lines) {
    const candidate = cur ? `${cur}\n${line}` : line;
    if (candidate.length <= maxFieldLen) {
      cur = candidate;
    } else {
      if (cur) chunks.push(cur);
      cur = truncate(line, maxFieldLen);
    }
  }
  if (cur) chunks.push(cur);

  if (chunks.length === 1) {
    fields.push({
      name: baseName,
      value: chunks[0] || "-",
      inline: false
    });
  } else {
    for (let i = 0; i < chunks.length; i++) {
      fields.push({
        name: `${baseName} (${i + 1}/${chunks.length})`,
        value: chunks[i] || "-",
        inline: false
      });
    }
  }
}

export function formatMeetingDiscordPayload(note: MeetingNote): DiscordWebhookPayload {
  const fields: DiscordEmbedField[] = [];

  // 1. Next Steps (most actionable first)
  if (note.nextSteps.length > 0) {
    const stepLines = note.nextSteps.map(s => {
      return `・**[${s.assignee}] ${s.title}**: ${s.task}`;
    });
    addChunkedFields(fields, "🚀 次のステップ（担当・宿題）", stepLines);
  }

  // 2. Decisions
  if (note.decisions.length > 0) {
    const decisionLines = note.decisions.map(d => {
      const cat = d.category ? `[${d.category}] ` : "";
      return `・${cat}**${d.title}**: ${d.description}`;
    });
    addChunkedFields(fields, "📌 決定事項・合意内容", decisionLines);
  }

  // 3. Topics
  if (note.topics.length > 0) {
    const topicLines = note.topics.map(t => {
      return `・**${t.title}**${t.summary ? `: ${t.summary}` : ""}`;
    });
    addChunkedFields(fields, "🔍 主な議題・ハイライト", topicLines);
  }

  // Discord API restricts embed.fields to a maximum of 25
  const safeFields = fields.length > 25
    ? [
        ...fields.slice(0, 24),
        {
          name: "⚠️ 省略された項目",
          value: `他 ${fields.length - 24} 件の項目（Discord制限25件により省略）`,
          inline: false
        }
      ]
    : fields;

  const embed: DiscordEmbed = {
    title: `📝 会議メモ: ${truncate(note.title, 200)}`,
    description: `**開催日時**: ${note.date}\n\n**【概要】**\n${truncate(note.overview, 2000)}`,
    color: 0x5865f2, // Discord Blurple
    fields: safeFields,
    footer: {
      text: "Google Meet 自動議事録通知（Google Drive連携）"
    },
    timestamp: new Date().toISOString()
  };

  return {
    content: "📢 **新しい会議の議事録・要約がGoogle Driveに保存されました**",
    embeds: [embed]
  };
}

export async function sendDiscordWebhook(webhookUrl: string, payload: DiscordWebhookPayload): Promise<boolean> {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  return res.ok;
}
