import { createVoiceTransport } from "./transport";
import { VoiceTransport, VoiceTransportFactory } from "./transport-types";
import { ConversationSession, LearningObservation } from "../domain/types";
export type VoiceState = {
  status:
    | "idle"
    | "connecting"
    | "listening"
    | "thinking"
    | "speaking"
    | "ended"
    | "error";
  turns: ConversationSession["turns"];
  observations: LearningObservation[];
  muted: boolean;
  microphone: boolean;
  error: string | null;
  audioBlocked: boolean;
};
export class VoiceConversation {
  private state: VoiceState = {
    status: "idle",
    turns: [],
    observations: [],
    muted: false,
    microphone: false,
    error: null,
    audioBlocked: false,
  };
  private listeners = new Set<() => void>();
  private transport: VoiceTransport | null = null;
  constructor(
    private request: typeof fetch = (...args) => fetch(...args),
    private createTransport: VoiceTransportFactory = createVoiceTransport,
  ) {}
  private abort: AbortController | null = null;
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private disconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;
  private generating = false;
  private needsContinuation = false;
  private outputItem: string | null = null;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.state;
  private update(patch: Partial<VoiceState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }
  private turn(
    id: string,
    role: "user" | "tutor",
    text: string,
    append = false,
  ) {
    const exists = this.state.turns.some((t) => t.id === id);
    this.update({
      turns: exists
        ? this.state.turns.map((t) =>
            t.id === id ? { ...t, text: append ? t.text + text : text } : t,
          )
        : [...this.state.turns, { id, role, text }],
    });
  }
  private send(event: object) {
    return this.transport?.send(JSON.stringify(event)) ?? false;
  }
  private fail(message: string) {
    this.release();
    this.update({ status: "error", error: message, microphone: false });
  }
  async start(microphone = true, episodeId?: string) {
    this.release();
    const generation = this.generation;
    this.update({
      status: "connecting",
      turns: [],
      observations: [],
      muted: false,
      microphone: false,
      error: null,
      audioBlocked: false,
    });
    try {
      this.abort = new AbortController();
      this.timeout = setTimeout(
        () => this.fail("Connection timed out. Please try again."),
        35000,
      );
      const health = await this.request("/api/voice/health", {
        signal: this.abort.signal,
      });
      const capabilities = health.ok ? await health.json() : null;
      if (!capabilities?.available)
        throw Error(
          "Voice is unavailable. Check your connection, sign in if prompted, and try again.",
        );
      if (
        episodeId &&
        !(Array.isArray(capabilities.episodeIds)
          ? capabilities.episodeIds.includes(episodeId)
          : episodeId === "daily-fr-2026-10-24")
      )
        throw Error("Talk for this edition needs the updated voice service.");
      if (generation !== this.generation) return;
      const transport = this.createTransport({
        open: () => {
          if (generation !== this.generation) return;
          if (this.timeout) clearTimeout(this.timeout);
          this.update({ status: "listening", microphone });
          this.send({ type: "response.create" });
        },
        message: (data) => {
          if (generation !== this.generation) return;
          try {
            this.handle(JSON.parse(data));
          } catch {
            this.fail(
              "The voice connection returned an unreadable response. Please reconnect.",
            );
          }
        },
        closed: () => {
          if (generation === this.generation)
            this.fail(
              "The voice connection closed. Your conversation is still available to save.",
            );
        },
        audioBlocked: (audioBlocked) => {
          if (generation === this.generation) this.update({ audioBlocked });
        },
        connection: (state) => {
          if (generation !== this.generation) return;
          if (state === "connected") {
            if (this.disconnectTimeout) clearTimeout(this.disconnectTimeout);
            this.disconnectTimeout = null;
          } else if (state === "failed" || state === "closed") {
            this.fail(
              "Connection lost. Your conversation is still available to save.",
            );
          } else if (state === "disconnected" && !this.disconnectTimeout) {
            this.disconnectTimeout = setTimeout(() => {
              if (generation === this.generation)
                this.fail(
                  "Connection lost. Your conversation is still available to save.",
                );
            }, 20000);
          }
        },
      });
      this.transport = transport;
      const offer = await transport.offer(microphone);
      if (generation !== this.generation) return;
      const response = await this.request(
        `/api/voice/session${episodeId ? `?episodeId=${encodeURIComponent(episodeId)}` : ""}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/sdp" },
          body: offer,
          signal: this.abort.signal,
        },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw Error(data.error || "Could not start voice conversation.");
      }
      const sdp = await response.text();
      if (generation !== this.generation) return;
      await transport.answer(sdp);
    } catch (error) {
      if (generation !== this.generation) return;
      const failure = error as { name?: string; message?: string } | null;
      const message = failure?.message || "Could not connect.";
      this.fail(
        failure &&
          ["NotAllowedError", "SecurityError"].includes(failure.name ?? "")
          ? "Microphone access was denied. Allow it in settings, or use typing instead."
          : message,
      );
    }
  }
  // Provider events are intentionally handled in one place so audio, captions
  // and saved notes share the same conversation and interruption lifecycle.
  handle(event: { type: string; [key: string]: unknown }) {
    const id = String(event.item_id ?? "");
    switch (event.type) {
      case "input_audio_buffer.speech_started":
        this.update({ status: "listening" });
        break;
      case "input_audio_buffer.speech_stopped":
        this.update({ status: "thinking" });
        break;
      case "input_audio_buffer.committed":
        // A commit must not erase transcript fragments already received.
        if (!this.state.turns.some((turn) => turn.id === id))
          this.turn(id, "user", "");
        break;
      case "conversation.item.input_audio_transcription.delta":
        this.turn(id, "user", String(event.delta ?? ""), true);
        break;
      case "conversation.item.input_audio_transcription.completed":
        this.turn(
          id,
          "user",
          String(event.transcript ?? "").trim() ||
            "[No speech could be transcribed]",
        );
        break;
      case "conversation.item.input_audio_transcription.failed":
        this.turn(id, "user", "[Speech could not be transcribed]");
        break;
      case "response.created":
        this.generating = true;
        this.update({ status: "thinking" });
        break;
      case "output_audio_buffer.started":
        this.update({ status: "speaking" });
        break;
      case "output_audio_buffer.stopped":
      case "output_audio_buffer.cleared":
        this.update({ status: "listening" });
        break;
      case "response.output_audio_transcript.delta":
        this.outputItem = id;
        this.turn(id, "tutor", String(event.delta ?? ""), true);
        break;
      case "response.output_audio_transcript.done":
        this.outputItem = id;
        this.turn(id, "tutor", String(event.transcript ?? ""));
        break;
      case "conversation.item.truncated":
        this.turn(
          id,
          "tutor",
          "[Reply interrupted — ask me to repeat if you missed it.]",
        );
        break;
      case "response.function_call_arguments.done": {
        if (event.name !== "record_correction") break;
        let accepted = false;
        try {
          const note = JSON.parse(String(event.arguments));
          if (
            [note.original, note.suggestion, note.explanation].every(
              (v) => typeof v === "string" && v.length > 0 && v.length < 600,
            ) &&
            this.state.turns.some(
              (t) => t.role === "user" && t.text.includes(note.original),
            )
          ) {
            if (
              !this.state.observations.some(
                (n) =>
                  n.original === note.original &&
                  n.suggestion === note.suggestion,
              )
            )
              this.update({
                observations: [
                  ...this.state.observations,
                  { id: String(event.call_id), ...note },
                ],
              });
            accepted = true;
          }
        } catch {
          /* Invalid notes are not presented as corrections. */
        }
        this.send({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: event.call_id,
            output: JSON.stringify({ saved: accepted }),
          },
        });
        this.needsContinuation = true;
        break;
      }
      case "response.done": {
        this.generating = false;
        const response = event.response as { status?: string } | undefined;
        if (response?.status === "failed") {
          this.update({
            status: "listening",
            error: "The tutor could not finish that reply. Please try again.",
          });
        }
        if (this.needsContinuation) {
          this.needsContinuation = false;
          this.send({ type: "response.create" });
        }
        break;
      }
      case "error": {
        const error = event.error as { code?: string } | undefined;
        if (error?.code === "response_cancel_not_active") break;
        this.update({
          error: "The voice service had a problem. Try again or reconnect.",
          status: "listening",
        });
        break;
      }
    }
  }
  interrupt() {
    if (this.generating) this.send({ type: "response.cancel" });
    this.send({ type: "output_audio_buffer.clear" });
    this.needsContinuation = false;
    if (
      this.outputItem &&
      (this.state.status === "speaking" || this.generating)
    )
      this.turn(
        this.outputItem,
        "tutor",
        "[Reply interrupted — ask me to repeat if you missed it.]",
      );
    this.update({ status: "listening" });
  }
  sendText(text: string) {
    if (
      !text.trim() ||
      !["listening", "thinking", "speaking"].includes(this.state.status)
    )
      return;
    this.interrupt();
    const id = `msg_${Date.now()}`;
    this.turn(id, "user", text.trim());
    this.send({
      type: "conversation.item.create",
      item: {
        id,
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: text.trim() }],
      },
    });
    this.send({ type: "response.create" });
    this.update({ status: "thinking", error: null });
  }
  mute() {
    const muted = !this.state.muted;
    this.transport?.mute(muted);
    this.update({ muted });
  }
  resumeAudio() {
    void this.transport?.resumeAudio();
  }

  end() {
    this.release();
    this.update({ status: "ended", microphone: false, muted: false });
  }
  private release() {
    this.generation++;
    this.abort?.abort();
    this.abort = null;
    if (this.timeout) clearTimeout(this.timeout);
    if (this.disconnectTimeout) clearTimeout(this.disconnectTimeout);
    this.disconnectTimeout = null;
    this.timeout = null;
    this.generating = false;
    this.needsContinuation = false;
    this.outputItem = null;
    this.transport?.close();
    this.transport = null;
  }
}
