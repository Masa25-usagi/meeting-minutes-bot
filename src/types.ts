export interface DecisionItem {
  category?: string;
  title: string;
  description: string;
}

export interface NextStepItem {
  assignee: string; // e.g. "pta", "なむ", "グループ"
  title: string;
  task: string;
}

export interface TopicItem {
  title: string;
  summary: string;
}

export interface MeetingNote {
  title: string;
  date: string; // e.g. "2026年9月14日 22:30 JST"
  rawDate: string;
  overview: string;
  topics: TopicItem[];
  decisions: DecisionItem[];
  nextSteps: NextStepItem[];
  rawContent: string;
}

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  fields: DiscordEmbedField[];
  footer: { text: string };
  timestamp?: string;
}

export interface DiscordWebhookPayload {
  content?: string;
  embeds: DiscordEmbed[];
}

export interface WatcherState {
  processedFiles: Record<string, {
    mtimeMs: number;
    processedAt: string;
  }>;
}
