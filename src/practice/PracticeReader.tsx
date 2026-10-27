"use dom";
import { useEffect, useRef, useState } from "react";
import { PracticeEngine, type Credentials } from "./engine";
import {
  alignAssessment,
  normalize,
  practiceTarget,
  type Assessment,
} from "./assessment";

type Phrase = {
  id: string;
  text: string;
  translation: string;
  words: { id: string; text: string; startMs: number; endMs: number }[];
};
export default function PracticeReader({
  title,
  phrases,
  getCredentials,
  playReference,
  stopReference,
  active,
  referenceError,
  referencePlaying,
  textScale,
  dom: _dom,
}: {
  title: string;
  phrases: Phrase[];
  active: boolean;
  referenceError: string | null;
  referencePlaying: boolean;
  textScale: number;
  getCredentials: () => Promise<Credentials>;
  playReference: (start: number, end: number) => Promise<void>;
  stopReference: () => Promise<void>;
  dom?: import("expo/dom").DOMProps;
}) {
  const [index, setIndex] = useState(0);
  const [wasActive, setWasActive] = useState(active);
  const [status, setStatus] = useState("ready");
  const [partial, setPartial] = useState("");
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [error, setError] = useState("");
  const engine = useRef<PracticeEngine | null>(null);
  const [recording, setRecording] = useState<string | null>(null);
  const recordingUrl = useRef<string | null>(null);
  const ownAudio = useRef<HTMLAudioElement | null>(null);
  const clearRecording = () => {
    ownAudio.current?.pause();
    if (recordingUrl.current) URL.revokeObjectURL(recordingUrl.current);
    recordingUrl.current = null;
    setRecording(null);
  };
  useEffect(
    () => () => {
      if (recordingUrl.current) URL.revokeObjectURL(recordingUrl.current);
    },
    [],
  );

  const attempt = useRef(0);
  const phrase = phrases[index];
  const busy = status === "connecting" || status === "listening";
  if (wasActive !== active) {
    setWasActive(active);
    setStatus("ready");
  }
  const cancel = () => {
    attempt.current++;
    engine.current?.stop();
    setStatus("ready");
  };
  useEffect(() => {
    const current = new PracticeEngine();
    engine.current = current;
    const hide = () => {
      if (document.hidden) {
        attempt.current++;
        current.stop();
        ownAudio.current?.pause();
        setStatus("ready");
      }
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      // Invalidate pending async attempts; this ref is a generation counter, not a DOM node.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      attempt.current++;
      current.stop();
      document.removeEventListener("visibilitychange", hide);
    };
  }, []);
  useEffect(() => {
    if (!active) {
      attempt.current++;
      engine.current?.stop();
      ownAudio.current?.pause();
    }
  }, [active]);
  const read = async () => {
    if (!engine.current || busy || !active) return;
    const id = ++attempt.current;
    clearRecording();
    setError("");
    setAssessment(null);
    setPartial("");
    setStatus("connecting");
    try {
      await stopReference();
      if (id !== attempt.current) return;
      await engine.current.start(phrase.text, getCredentials, {
        capture: (stream) => {
          if (typeof MediaRecorder === "undefined") return;
          try {
            const recorder = new MediaRecorder(stream);
            const chunks: BlobPart[] = [];
            recorder.ondataavailable = (event) => {
              if (event.data.size) chunks.push(event.data);
            };
            recorder.onstop = () => {
              if (id !== attempt.current || !chunks.length) return;
              const url = URL.createObjectURL(
                new Blob(chunks, { type: recorder.mimeType }),
              );
              recordingUrl.current = url;
              setRecording(url);
            };
            recorder.start();
          } catch {
            /* Assessment still works when local replay is unsupported. */
          }
        },
        ready: () => {
          if (id === attempt.current) setStatus("listening");
        },
        partial: (text) => {
          if (id === attempt.current) setPartial(text);
        },
        result: (result) => {
          if (id === attempt.current) {
            setAssessment(result);
            setStatus("feedback");
          }
        },
        error: (message) => {
          if (id === attempt.current) {
            setError(message);
            setStatus("ready");
          }
        },
      });
    } catch {
      if (id === attempt.current) {
        setError("Could not start practice. Please try again.");
        setStatus("ready");
      }
    }
  };
  const hear = async (wordIndex?: number) => {
    ownAudio.current?.pause();
    cancel();
    setError("");
    const words =
      wordIndex === undefined
        ? phrase.words
        : phrase.words.slice(
            Math.max(0, wordIndex - 1),
            Math.min(phrase.words.length, wordIndex + 2),
          );
    try {
      await playReference(words[0].startMs, words[words.length - 1].endMs);
    } catch {
      setError("The reference audio could not play. Try again.");
    }
  };
  const move = (next: number) => {
    clearRecording();
    cancel();
    void stopReference();
    setIndex(next);
    setPartial("");
    setAssessment(null);
    setError("");
  };
  const aligned = alignAssessment(
    phrase.words.map((w) => w.text),
    assessment?.words ?? [],
  );
  const target = practiceTarget(aligned);
  const hasAlignedWords = aligned.some((word) => word !== null);
  const heardWords = partial.split(/\s+/).map(normalize);
  return (
    <main
      style={{
        fontFamily: "system-ui",
        fontSize: 16 * textScale,
        color: "#0B1937",
        background: "#F5F0E6",
        minHeight: "100vh",
        boxSizing: "border-box",
        padding: "24px",
        maxWidth: 680,
        margin: "auto",
      }}
    >
      <style>{`body{margin:0;background:#F5F0E6}*{box-sizing:border-box}button{font:inherit;min-height:48px;border:1px solid #C9C7BB;border-radius:24px;background:#FCFBF9;color:#173E35;padding:12px 18px;cursor:pointer}button:disabled{opacity:.5;cursor:default}button:focus-visible{outline:3px solid #6250FA;outline-offset:3px}.actions{display:flex;flex-wrap:wrap;gap:10px;margin:20px 0}p{line-height:1.6}.primary{background:#175745;color:white;border-color:#175745}`}</style>
      <p style={{ fontSize: 12 * textScale, letterSpacing: 1.5 }}>
        LISTEN · READ · REFINE
      </p>
      <h1
        style={{
          fontFamily: "Georgia",
          fontSize: 30 * textScale,
          fontWeight: 400,
        }}
      >
        {title}
      </h1>
      <p>
        Phrase {index + 1} of {phrases.length}
      </p>
      <div
        lang="fr"
        aria-label="French reference phrase"
        style={{
          fontFamily: "Georgia",
          fontSize: 32 * textScale,
          lineHeight: 1.65,
          margin: "28px 0",
        }}
      >
        {phrase.words.map((word, i) => {
          const result = aligned[i];
          const attention =
            result &&
            (result.error === "Omission" ||
              result.error === "Mispronunciation" ||
              (result.accuracy !== null && result.accuracy < 60));
          const tentative =
            !assessment &&
            heardWords[i] &&
            heardWords[i] === normalize(word.text);
          return (
            <span
              key={word.id}
              style={{
                background: attention
                  ? "#F3DFC1"
                  : result?.accuracy !== null && result?.accuracy !== undefined
                    ? "#DDEBDD"
                    : tentative
                      ? "#EAE5F0"
                      : "transparent",
                borderRadius: 4,
              }}
            >
              {word.text}{" "}
            </span>
          );
        })}
      </div>
      <p style={{ color: "#59615E" }}>{phrase.translation}</p>
      <p style={{ fontSize: 13 * textScale, color: "#59615E" }}>
        Read aloud sends your microphone audio to Azure for assessment. Your
        replay copy is kept only for this phrase.
      </p>
      <div className="actions">
        <button onClick={() => void hear()}>Hear the phrase</button>
        {referencePlaying && (
          <button onClick={() => void stopReference()}>
            Stop reference audio
          </button>
        )}
        <button
          className="primary"
          disabled={busy || !active}
          onClick={() => void read()}
        >
          {assessment ? "Try again" : "Read aloud"}
        </button>
        {busy && <button onClick={cancel}>Cancel attempt</button>}
      </div>
      <p role="status" aria-live="polite">
        {status === "connecting"
          ? "Connecting to pronunciation practice…"
          : status === "listening"
            ? "Listening. Read the phrase, then pause for feedback."
            : assessment
              ? "Your feedback is ready."
              : "Listen first, then read at your own pace."}
      </p>
      {partial && !assessment && (
        <p>
          Hearing: <span lang="fr">{partial}</span>
          <br />
          <small>
            Live recognition is tentative, not a pronunciation score.
          </small>
        </p>
      )}
      {(error || referenceError) && (
        <p role="alert">
          {error || "The reference audio could not play. Please try again."}
        </p>
      )}
      {recording && (
        <section aria-label="Your recording">
          <p>Your attempt · kept only for this phrase</p>
          <audio
            ref={ownAudio}
            controls
            src={recording}
            onPlay={() => {
              cancel();
              void stopReference();
            }}
            style={{ maxWidth: "100%", width: "100%" }}
          />
        </section>
      )}
      {assessment && (
        <section
          aria-label="Pronunciation feedback"
          style={{ background: "#EAE5F0", padding: 18, borderRadius: 12 }}
        >
          <h2
            style={{
              fontFamily: "Georgia",
              fontWeight: 400,
              fontSize: 24 * textScale,
            }}
          >
            {target >= 0
              ? "One word to practise"
              : hasAlignedWords
                ? "Keep the phrase flowing"
                : "Let’s try that phrase again"}
          </h2>
          <p>
            {target >= 0
              ? `Try « ${phrase.words[target].text} » once more. ${aligned[target]?.error === "Omission" ? "It may have been missed in this attempt." : "Azure flagged it as a possible practice target."} Listen to the host’s version in context, then repeat.`
              : hasAlignedWords
                ? "No clear word-level target was flagged. Compare your rhythm with the host and try again if you like."
                : "The words could not be matched reliably to this phrase. Listen to the model, then read the complete phrase again."}
          </p>
          <button onClick={() => void hear(target >= 0 ? target : undefined)}>
            {target >= 0
              ? "Hear the correction in context"
              : "Hear the model again"}
          </button>
          <p>
            <small>
              Automated feedback can be affected by noise and recognition
              errors. Amber marks a possible practice target; unmarked words
              were not aligned reliably.
            </small>
          </p>
          <details>
            <summary>What Azure heard and assessed</summary>
            <p lang="fr">{assessment.heard || "No transcript returned."}</p>
            {assessment.words.map((w, i) => (
              <p key={i}>
                {w.word}: {w.error === "None" ? "Assessed" : w.error}{" "}
                {w.accuracy === null
                  ? "(no score)"
                  : `· ${Math.round(w.accuracy)}/100`}
              </p>
            ))}
          </details>
        </section>
      )}
      <div className="actions">
        <button disabled={index === 0} onClick={() => move(index - 1)}>
          Previous phrase
        </button>
        <button
          disabled={index === phrases.length - 1}
          onClick={() => move(index + 1)}
        >
          Next phrase
        </button>
      </div>
      {index === phrases.length - 1 && (
        <p>
          You’ve reached the last phrase. Repeat any phrase, or return to the
          story when you’re ready.
        </p>
      )}
      <p style={{ fontSize: 13 * textScale, color: "#59615E" }}>
        When you tap Read aloud, microphone audio is streamed to Microsoft Azure
        for French pronunciation assessment. Ambio does not save your recording.
        The microphone stops after each attempt, when you cancel, or when you
        leave practice.
      </p>
    </main>
  );
}
