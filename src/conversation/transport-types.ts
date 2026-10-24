export interface VoiceTransportEvents {
  open(): void;
  message(data: string): void;
  closed(): void;
  connection(state: string): void;
  audioBlocked(blocked: boolean): void;
}
export interface VoiceTransport {
  offer(microphone: boolean): Promise<string>;
  answer(sdp: string): Promise<void>;
  send(data: string): boolean;
  mute(muted: boolean): void;
  resumeAudio(): Promise<void>;
  close(): void;
}
export type VoiceTransportFactory = (
  events: VoiceTransportEvents,
) => VoiceTransport;
