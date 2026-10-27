import { voiceApi } from "../conversation/api";
import type { Credentials } from "./engine";
export async function practiceCredentials(): Promise<Credentials> {
  const path = "/api/voice/practice/token";
  const local =
    !voiceApi.native &&
    typeof location !== "undefined" &&
    ["localhost", "127.0.0.1"].includes(location.hostname) &&
    location.port === "8092";
  let response: Response;
  try {
    response = await (local ? fetch : voiceApi.request)(
      local ? `http://${location.hostname}:8086${path}` : path,
      { method: "POST", signal: AbortSignal.timeout(20000) },
    );
  } catch {
    throw Error(
      "Could not reach pronunciation practice. Check your connection and try again.",
    );
  }
  if (response.status === 401)
    throw Error("Sign in on the Talk tab, then return to practice.");
  if (!response.ok)
    throw Error(
      response.status === 429
        ? "Please wait a moment before trying again."
        : "Pronunciation practice is unavailable. Please try again later.",
    );
  const data = await response.json();
  if (
    typeof data.token !== "string" ||
    !data.token ||
    typeof data.region !== "string" ||
    !/^[a-z0-9-]{2,40}$/.test(data.region)
  )
    throw Error("The practice server returned an invalid session.");
  return { token: data.token, region: data.region };
}
