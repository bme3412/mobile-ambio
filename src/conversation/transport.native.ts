import { PermissionsAndroid, Platform } from "react-native";
import type { MediaStream, RTCPeerConnection } from "react-native-webrtc";
import { VoiceTransportFactory } from "./transport-types";

export const createVoiceTransport: VoiceTransportFactory = (events) => {
  // Load only when starting a call so an old development client can still open
  // the app and display an actionable rebuild message.
  let rtc: typeof import("react-native-webrtc");
  let audio: typeof import("react-native-incall-manager").default;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    rtc = require("react-native-webrtc");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    audio = require("react-native-incall-manager").default;
  } catch {
    throw Error(
      "Install the latest Ambio development build to enable voice. Expo Go does not include native calling support.",
    );
  }
  const pc = new rtc.RTCPeerConnection();
  let stream: MediaStream | null = null;
  let channel: ReturnType<RTCPeerConnection["createDataChannel"]> | null = null;
  let closed = false;
  let audioStarted = false;
  pc.addEventListener("connectionstatechange", () => {
    if (!closed) events.connection(pc.connectionState);
  });
  // Remote audio is rendered by the native WebRTC audio device; no HTML audio
  // element or RTCView is needed for an audio-only call.
  return {
    async offer(microphone) {
      if (Platform.OS === "android" && Number(Platform.Version) >= 31) {
        // Optional: denial leaves speaker/wired audio available.
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        );
        if (closed) throw Error("Connection cancelled.");
      }
      if (microphone) {
        const acquired = await rtc.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        if (closed) {
          acquired.getTracks().forEach((track) => track.stop());
          acquired.release();
          throw Error("Connection cancelled.");
        }
        stream = acquired;
        stream.getTracks().forEach((track) => pc.addTrack(track, acquired));
      } else pc.addTransceiver("audio", { direction: "recvonly" });
      if (closed) throw Error("Connection cancelled.");
      // 'video' chooses speaker by default while retaining automatic headset
      // routing. It does not capture a camera or create a video track.
      audio.start({ media: "video", auto: true });
      audioStarted = true;
      audio.setKeepScreenOn(false);
      channel = pc.createDataChannel("oai-events");
      channel.addEventListener("open", () => {
        if (!closed) events.open();
      });
      channel.addEventListener("message", (event) => {
        if (!closed) events.message(String(event.data));
      });
      channel.addEventListener("close", () => {
        if (!closed) events.closed();
      });
      const offer = await pc.createOffer();
      if (closed) throw Error("Connection cancelled.");
      await pc.setLocalDescription(offer);
      if (!offer.sdp) throw Error("Could not prepare voice connection.");
      return offer.sdp;
    },
    async answer(sdp) {
      await pc.setRemoteDescription(
        new rtc.RTCSessionDescription({ type: "answer", sdp }),
      );
    },
    send(data) {
      if (closed || channel?.readyState !== "open") return false;
      channel.send(data);
      return true;
    },
    mute(muted) {
      stream?.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    },
    async resumeAudio() {
      /* Native audio has no browser autoplay gate. */
    },
    close() {
      if (closed) return;
      closed = true;
      channel?.close();
      stream?.getTracks().forEach((track) => track.stop());
      stream?.release();
      stream = null;
      pc.close();
      if (audioStarted) audio.stop();
    },
  };
};
