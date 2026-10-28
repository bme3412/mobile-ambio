export function localDate(date?: Date): string;
export function topicsForDate(date?: string): {
  date: string;
  day: string;
  topics: { id: string; label: string }[];
};
export function conversationOpening(topicId: string, date?: string): string;
