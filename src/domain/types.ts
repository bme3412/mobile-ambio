export interface WordToken {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  meaning?: string;
}
export interface TranscriptSegment {
  id: string;
  speaker: string;
  startMs: number;
  endMs: number;
  translation: string;
  words: WordToken[];
}
export interface Story {
  id: string;
  category: string;
  title: string;
  description: string;
  segmentId: string;
}
export interface Episode {
  id: string;
  title: string;
  subtitle: string;
  language: "fr";
  durationMs: number;
  cover: string;
  stories: Story[];
  segments: TranscriptSegment[];
  isMock: boolean;
}
export interface Bookmark {
  id: string;
  episodeId: string;
  segmentId: string;
  word: WordToken;
  context: string;
  reviewed: boolean;
}
export interface PlaybackProgress {
  episodeId: string;
  positionMs: number;
  rate: number;
}
export interface LearningObservation {
  id: string;
  original: string;
  suggestion: string;
  explanation: string;
}
export interface ConversationSession {
  topicTitle?: string;
  id: string;
  episodeId: string;
  createdAt: string;
  turns: { id: string; role: "user" | "tutor"; text: string }[];
  observations: LearningObservation[];
  isMock: boolean;
}
