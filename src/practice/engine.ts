import type * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";
import { parseAssessment, type Assessment } from "./assessment";
export type Credentials = { token: string; region: string };
export class PracticeEngine {
  constructor(
    private loadSDK: () => Promise<typeof SpeechSDK> = () =>
      import("microsoft-cognitiveservices-speech-sdk"),
  ) {}
  private generation = 0;
  private recognizer?: SpeechSDK.SpeechRecognizer;
  private stream?: MediaStream;
  private timer?: ReturnType<typeof setTimeout>;
  private audio?: SpeechSDK.AudioConfig;
  async start(
    text: string,
    credentials: () => Promise<Credentials>,
    events: {
      partial(text: string): void;
      capture?(stream: MediaStream): void;
      ready(): void;
      result(result: Assessment): void;
      error(message: string): void;
    },
  ) {
    this.stop();
    const generation = this.generation;
    const current = () => generation === this.generation;
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw Error(
          "Microphone access needs a secure browser or the latest iPhone build.",
        );
      const auth = await credentials();
      if (!current()) return;
      const sdk = await this.loadSDK();
      if (!current()) return;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      if (!current()) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.stream = stream;
      events.capture?.(stream);
      const config = sdk.SpeechConfig.fromAuthorizationToken(
        auth.token,
        auth.region,
      );
      config.speechRecognitionLanguage = "fr-FR";
      config.outputFormat = sdk.OutputFormat.Detailed;
      this.audio = sdk.AudioConfig.fromStreamInput(stream);
      const recognizer = new sdk.SpeechRecognizer(config, this.audio);
      this.recognizer = recognizer;
      new sdk.PronunciationAssessmentConfig(
        text,
        sdk.PronunciationAssessmentGradingSystem.HundredMark,
        sdk.PronunciationAssessmentGranularity.Word,
        true,
      ).applyTo(recognizer);
      recognizer.recognizing = (_, event) => {
        if (current()) events.partial(event.result.text);
      };
      recognizer.sessionStarted = () => {
        if (current()) events.ready();
      };
      recognizer.recognizeOnceAsync(
        (result) => {
          if (!current()) return;
          try {
            const assessment = parseAssessment(
              result.properties.getProperty(
                sdk.PropertyId.SpeechServiceResponse_JsonResult,
              ),
            );
            this.stop();
            events.result(assessment);
          } catch (error) {
            this.stop();
            events.error(
              error instanceof Error
                ? error.message
                : "Could not assess this attempt.",
            );
          }
        },
        () => {
          if (current()) {
            this.stop();
            events.error(
              "Speech assessment failed. Check your connection and try again.",
            );
          }
        },
      );
      this.timer = setTimeout(() => {
        if (current()) {
          this.stop();
          events.error(
            "This attempt reached 30 seconds. Try a shorter, steady reading.",
          );
        }
      }, 30000);
    } catch (error) {
      if (current()) {
        this.stop();
        events.error(
          error instanceof Error
            ? error.message
            : "Could not start the microphone.",
        );
      }
    }
  }
  stop() {
    this.generation++;
    clearTimeout(this.timer);
    this.timer = undefined;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
    this.recognizer?.close();
    this.recognizer = undefined;
    this.audio?.close();
    this.audio = undefined;
  }
}
