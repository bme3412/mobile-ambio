function secureStore(): typeof import("expo-secure-store") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-secure-store");
  } catch {
    throw Error(
      "Install the latest Ambio development build to enable secure voice sign-in.",
    );
  }
}

const origin =
  process.env.EXPO_PUBLIC_VOICE_URL || "https://ambio-daily-preview.vercel.app";
const key = "ambio.native-voice-session.v1";
function endpoint(path: string) {
  const url = new URL(origin);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw Error("Voice server must be an HTTPS origin.");
  if (
    !path.startsWith("/api/voice/") &&
    !/^\/api\/editions(?:\/|\?|$)/.test(path)
  )
    throw Error("Invalid voice endpoint.");
  return `${url.origin}${path}`;
}
export const voiceApi = {
  native: true,
  request: (async (input, init) => {
    const url = endpoint(String(input));
    const SecureStore = secureStore();
    const token = await SecureStore.getItemAsync(key);
    const headers = new Headers(init?.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(url, {
      ...init,
      headers,
      credentials: "omit",
    });
    // A request started before a successful unlock must not erase its newer session.
    if (
      response.status === 401 &&
      (await SecureStore.getItemAsync(key)) === token
    )
      await SecureStore.deleteItemAsync(key);
    return response;
  }) as typeof fetch,
  async signIn(password: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(endpoint("/api/voice/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
        credentials: "omit",
        signal: controller.signal,
      });
      if (response.status === 401)
        throw Error("That preview password didn’t match.");
      if (response.status === 429)
        throw Error("Too many sign-in attempts. Please try again in a minute.");
      if (!response.ok)
        throw Error(
          "Voice sign-in is unavailable. Check that the server has the native voice update.",
        );
      const data = await response.json();
      if (
        typeof data.token !== "string" ||
        !data.token ||
        data.token.length > 1500
      )
        throw Error("The voice server returned an invalid session.");
      const SecureStore = secureStore();
      await SecureStore.setItemAsync(key, data.token, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    } catch (error) {
      if (controller.signal.aborted)
        throw Error("Sign-in timed out. Please try again.");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  },
  async signOut() {
    await secureStore().deleteItemAsync(key);
  },
};
