export const voiceApi = {
  native: false,
  request: ((...args) => fetch(...args)) as typeof fetch,
  async signIn(password: string): Promise<void> {
    const response = await fetch("/__preview_login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ password }).toString(),
      signal: AbortSignal.timeout(15000),
    });
    if (response.status === 401)
      throw Error("That preview password didn’t match.");
    if (response.status === 429)
      throw Error("Too many attempts. Please try again in a minute.");
    if (!response.ok)
      throw Error("Could not unlock voice practice. Please try again.");
  },
  async signOut(): Promise<void> {},
};
