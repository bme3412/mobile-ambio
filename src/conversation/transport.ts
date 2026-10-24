import { VoiceTransportFactory } from "./transport-types";

export const createVoiceTransport: VoiceTransportFactory = (events) => {
  if (
    typeof window === "undefined" ||
    !window.isSecureContext ||
    typeof RTCPeerConnection === "undefined"
  )
    throw Error(
      "Open the HTTPS preview in Safari or Chrome to use voice conversation.",
    );
  const pc = new RTCPeerConnection();
  const audio = document.createElement("audio");
  audio.autoplay = true;
  audio.setAttribute("playsinline", "");
  let stream: MediaStream | null = null;
  let channel: RTCDataChannel | null = null;
  let closed = false;
  const resumeAudio = async () => {
    if (closed) return;
    try {
      await audio.play();
      if (!closed) events.audioBlocked(false);
    } catch {
      if (!closed) events.audioBlocked(true);
    }
  };
  pc.ontrack = (event) => {
    if (closed) return;
    audio.srcObject = event.streams[0];
    void resumeAudio();
  };
  pc.onconnectionstatechange = () => {
    if (!closed) events.connection(pc.connectionState);
  };
  return {
    async offer(microphone) {
      if (microphone) {
        const acquired = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        if (closed) {
          acquired.getTracks().forEach((track) => track.stop());
          throw Error("Connection cancelled.");
        }
        stream = acquired;
        stream.getTracks().forEach((track) => pc.addTrack(track, acquired));
      } else pc.addTransceiver("audio", { direction: "recvonly" });
      if (closed) throw Error("Connection cancelled.");
      channel = pc.createDataChannel("oai-events");
      channel.onopen = () => {
        if (!closed) events.open();
      };
      channel.onmessage = (event) => {
        if (!closed) events.message(event.data);
      };
      channel.onclose = () => {
        if (!closed) events.closed();
      };
      const offer = await pc.createOffer();
      if (closed) throw Error("Connection cancelled.");
      await pc.setLocalDescription(offer);
      if (!offer.sdp) throw Error("Could not prepare voice connection.");
      return offer.sdp;
    },
    answer: (sdp) => pc.setRemoteDescription({ type: "answer", sdp }),
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
    resumeAudio,
    close() {
      if (closed) return;
      closed = true;
      channel?.close();
      pc.close();
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
      audio.pause();
      audio.srcObject = null;
    },
  };
};
