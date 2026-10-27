import {
  VoiceTransport,
  VoiceTransportFactory,
} from "../conversation/transport-types";

export type CoachState = {
  status:
    | "ready"
    | "connecting"
    | "listening"
    | "thinking"
    | "speaking"
    | "feedback"
    | "error"
    | "locked";
  caption: string;
  heard: string;
  speechDetected: boolean;
  audioBlocked: boolean;
  error: string | null;
};
const initial = (): CoachState => ({
  status: "ready",
  caption: "",
  heard: "",
  speechDetected: false,
  audioBlocked: false,
  error: null,
});
export class SpokenCoach {
  private transport?: VoiceTransport;
  private attempt?: { id: string; episodeId: string; phraseId: string };
  private abort?: AbortController;
  private timer?: ReturnType<typeof setTimeout>;
  private generation = 0;
  private responded = false;
  private finishing = false;
  private state = initial();
  private listeners = new Set<() => void>();
  constructor(
    private request: (path: string, init?: RequestInit) => Promise<Response>,
    private factory: VoiceTransportFactory,
    private completed: (attempt: {
      id: string;
      episodeId: string;
      phraseId: string;
    }) => void = () => {},
  ) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(patch: Partial<CoachState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }
  private deadline(ms: number, message: string) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.fail(message), ms);
  }
  private release() {
    this.generation++;
    this.attempt = undefined;
    clearTimeout(this.timer);
    this.abort?.abort();
    this.abort = undefined;
    const transport = this.transport;
    this.transport = undefined;
    transport?.close();
  }
  private fail(error: string) {
    this.release();
    this.update({ status: "error", error, audioBlocked: false });
  }
  stop = () => {
    this.release();
    this.state = initial();
    this.listeners.forEach((fn) => fn());
  };
  resumeAudio = async () => {
    await this.transport?.resumeAudio();
  };
  async start(episodeId: string, phraseId: string) {
    this.stop();
    this.attempt = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      episodeId,
      phraseId,
    };
    const generation = this.generation;
    this.responded = false;
    this.finishing = false;
    this.update({ status: "connecting" });
    this.abort = new AbortController();
    this.deadline(
      35000,
      "Could not connect to your coach. Check your connection and try again.",
    );
    const current = () => generation === this.generation;
    try {
      // Check access before asking for the microphone, including an expired native session.
      const health = await this.request("/api/voice/health", {
        signal: this.abort.signal,
      });
      if (!current()) return;
      if (health.status === 401) {
        this.release();
        this.update({ status: "locked" });
        return;
      }
      if (!health.ok || !(await health.json()).available)
        throw Error(
          "Your spoken coach is unavailable. Please try again later.",
        );
      if (!current()) return;
      const transport = this.factory({
        open: () => {
          if (!current()) return;
          this.transport?.mute(false);
          this.update({ status: "listening" });
          this.deadline(
            60000,
            "The coach did not receive a complete phrase. Try again, and wait for ‘Read aloud now’ before speaking.",
          );
        },
        message: (data) => {
          if (current()) this.message(data);
        },
        closed: () => {
          if (current())
            this.fail("The audio connection closed. Please try again.");
        },
        connection: (state) => {
          if (current() && state === "failed")
            this.fail("The audio connection failed. Please try again.");
        },
        audioBlocked: (audioBlocked) => {
          if (current()) this.update({ audioBlocked });
        },
      });
      this.transport = transport;
      const offer = await transport.offer(true);
      if (!current()) {
        transport.close();
        return;
      }
      transport.mute(true);
      const response = await this.request(
        `/api/voice/practice/session?episodeId=${encodeURIComponent(episodeId)}&phraseId=${encodeURIComponent(phraseId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/sdp" },
          body: offer,
          signal: this.abort.signal,
        },
      );
      if (!current()) return;
      if (response.status === 401) {
        this.release();
        this.update({ status: "locked" });
        return;
      }
      if (!response.ok)
        throw Error(
          response.status === 429
            ? "Please wait a few seconds before trying again."
            : "Could not connect to your coach. Please try again later.",
        );
      await transport.answer(await response.text());
    } catch (error) {
      if (current())
        this.fail(
          error instanceof Error &&
            /permission|denied|NotAllowed/i.test(error.message + error.name)
            ? "Allow microphone access in Settings to read to your coach."
            : error instanceof Error
              ? error.message
              : "Could not start your coach.",
        );
    }
  }
  finish = () => {
    if (this.state.status !== "listening" || this.finishing) return;
    this.finishing = true;
    this.transport?.mute(true);
    this.update({ status: "thinking" });
    this.deadline(
      30000,
      "Your coach took too long to respond. Please try again.",
    );
    this.transport?.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
  };
  private message(data: string) {
    let event;
    try {
      event = JSON.parse(data);
    } catch {
      return;
    }
    switch (event.type) {
      case "input_audio_buffer.speech_started":
        if (!this.responded) this.update({ speechDetected: true });
        break;
      case "input_audio_buffer.committed":
        if (this.responded) break;
        this.responded = true;
        this.transport?.mute(true);
        this.update({ status: "thinking" });
        this.deadline(
          45000,
          "Your coach took too long to respond. Please try again.",
        );
        this.transport?.send(JSON.stringify({ type: "response.create" }));
        break;
      case "conversation.item.input_audio_transcription.completed":
        this.update({ heard: event.transcript ?? "" });
        break;
      case "response.output_audio_transcript.delta":
        this.update({ caption: this.state.caption + (event.delta ?? "") });
        break;
      case "response.output_audio_transcript.done":
        this.update({ caption: event.transcript ?? this.state.caption });
        break;
      case "output_audio_buffer.started":
        this.update({ status: "speaking" });
        break;
      case "output_audio_buffer.stopped":
        if (this.responded) {
          const attempt = this.attempt;
          this.release();
          this.update({ status: "feedback", audioBlocked: false });
          if (attempt) this.completed(attempt);
        }
        break;
      case "response.done":
        if (
          event.response?.status === "failed" ||
          event.response?.status === "cancelled"
        )
          this.fail(
            "The coach could not finish the feedback. Please try again.",
          );
        break;
      case "error":
        // A manual finish can race the automatic VAD commit. The first committed turn wins.
        if (
          event.error?.code === "input_audio_buffer_commit_empty" &&
          this.responded
        )
          break;
        this.fail(
          event.error?.code === "input_audio_buffer_commit_empty"
            ? "No audio reached the coach. Wait for ‘Read aloud now’, read the phrase, then pause."
            : "The coach could not process this attempt. Please try again.",
        );
        break;
    }
  }
}
