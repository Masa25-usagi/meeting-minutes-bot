import type { MeetingNote, TopicItem, DecisionItem, NextStepItem } from "./types.ts";

export function parseGoogleMeetNote(content: string, fallbackTitle = "Google Meet 会議メモ"): MeetingNote {
  const clean = content.replace(/\r\n/g, "\n").trim();

  // 1. Extract Date / Meeting Title
  let title = fallbackTitle;
  let date = "";

  // Check header lines (first 10 lines)
  const headerLines = clean.split("\n").slice(0, 10).map(l => l.trim()).filter(Boolean);
  for (const line of headerLines) {
    // Check Month D, YYYY format (e.g. "9月 29, 2026")
    const engDateMatch = line.match(/^([0-9]{1,2})月\s+([0-9]{1,2}),\s*([0-9]{4})$/);
    if (engDateMatch && !date) {
      date = `${engDateMatch[3]}年${engDateMatch[1]}月${engDateMatch[2]}日`;
      continue;
    }

    // Check "会議 YYYY年M月D日 HH:mm TZ"
    const fullDateMatch = line.match(/^会議\s+([0-9]{4}年[0-9]{1,2}月[0-9]{1,2}日\s+[0-9]{1,2}:[0-9]{2}\s*[A-Z]+)/);
    if (fullDateMatch) {
      date = fullDateMatch[1].trim();
      title = line;
      continue;
    }

    // Check specific meeting title line
    if (line !== "📝 メモ" && !line.includes("会議の記録") && !line.includes("文字起こし") && !line.startsWith("概要")) {
      if (!line.match(/^[0-9]{1,2}月\s+[0-9]{1,2},\s*[0-9]{4}$/) && !line.match(/^[0-9]{4}年/)) {
        if (title === fallbackTitle) {
          title = line;
        }
      }
    }
  }

  // Fallback date search in entire text
  if (!date) {
    const fullDateMatch = clean.match(/会議\s+([0-9]{4}年[0-9]{1,2}月[0-9]{1,2}日\s+[0-9]{1,2}:[0-9]{2}\s*[A-Z]+)/);
    if (fullDateMatch) {
      date = fullDateMatch[1].trim();
    } else {
      const engDateMatch = clean.match(/([0-9]{1,2})月\s+([0-9]{1,2}),\s*([0-9]{4})/);
      if (engDateMatch) {
        date = `${engDateMatch[3]}年${engDateMatch[1]}月${engDateMatch[2]}日`;
      } else {
        const simpleDateMatch = clean.match(/([0-9]{4}年[0-9]{1,2}月[0-9]{1,2}日|[0-9]{4}-[0-9]{2}-[0-9]{2})/);
        if (simpleDateMatch) date = simpleDateMatch[1];
      }
    }
  }

  // 2. Extract Overview (概要)
  let overview = "";
  const topics: TopicItem[] = [];
  const overviewMatch = clean.match(/概要\n+([\s\S]*?)(?:\n+(?:決定事項|次のステップ|詳細|Gemini\s+が生成したメモ|📖\s*文字起こし)|$)/);
  if (overviewMatch) {
    const rawOverview = overviewMatch[1].trim();
    const blocks = rawOverview.split(/\n\n+/);
    if (blocks.length > 0) {
      overview = blocks[0].replace(/\n/g, " ").trim();
      // Additional blocks in overview are topic highlights
      for (let i = 1; i < blocks.length; i++) {
        const lines = blocks[i].split("\n").map(l => l.trim()).filter(Boolean);
        if (lines.length >= 2) {
          topics.push({ title: lines[0], summary: lines.slice(1).join(" ") });
        } else if (lines.length === 1) {
          topics.push({ title: lines[0], summary: "" });
        }
      }
    }
  }

  // 3. Extract Decisions (決定事項)
  const decisions: DecisionItem[] = [];
  const decisionsMatch = clean.match(/決定事項\n+([\s\S]*?)(?:\n+(?:次のステップ|詳細|Gemini\s+が生成したメモ|📖\s*文字起こし)|$)/);
  if (decisionsMatch) {
    const rawDecisions = decisionsMatch[1].trim();
    let currentCategory = "";
    const lines = rawDecisions.split("\n").map(l => l.trim()).filter(Boolean);

    for (const line of lines) {
      if (!line.startsWith("*") && !line.startsWith("-") && !line.startsWith("・")) {
        currentCategory = line;
        continue;
      }
      const itemMatch = line.match(/^[\*\-・]\s*(.*?)(?:\s+(.*))?$/);
      if (itemMatch) {
        const itemText = itemMatch[1].trim();
        const rest = itemMatch[2] ? itemMatch[2].trim() : "";
        decisions.push({
          category: currentCategory,
          title: itemText,
          description: rest || itemText
        });
      }
    }
  }

  // 4. Extract Next Steps (次のステップ)
  const nextSteps: NextStepItem[] = [];
  const nextStepsMatch = clean.match(/次のステップ\n+([\s\S]*?)(?:\n+(?:詳細|Gemini\s+が生成したメモ|📖\s*文字起こし)|$)/);
  if (nextStepsMatch) {
    const rawNextSteps = nextStepsMatch[1].trim();
    const lines = rawNextSteps.split("\n").map(l => l.trim()).filter(Boolean);

    for (const line of lines) {
      if (!line.startsWith("*") && !line.startsWith("-") && !line.startsWith("・")) continue;
      // Match pattern like: * [assignee] title: description
      const stepMatch = line.match(/^[\*\-・]\s*(?:\[(.*?)\])?\s*([^:：]+)(?:[:：]\s*(.*))?$/);
      if (stepMatch) {
        const assignee = stepMatch[1] ? stepMatch[1].trim() : "全体";
        const stepTitle = stepMatch[2].trim();
        const task = stepMatch[3] ? stepMatch[3].trim() : stepTitle;
        nextSteps.push({ assignee, title: stepTitle, task });
      }
    }
  }

  // Derive meaningful title if still default and topic is not Google boilerplate
  if (title === fallbackTitle && topics.length > 0) {
    const candidate = topics[0].title;
    if (!candidate.includes("文字起こしが行われた場合は") && !candidate.includes("会話量が不足") && !candidate.includes("サポートされている言語")) {
      title = candidate;
    }
  }

  return {
    title,
    date: date || "日付未詳",
    rawDate: date,
    overview: overview || "（要約なし）",
    topics,
    decisions,
    nextSteps,
    rawContent: clean
  };
}
