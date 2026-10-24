export const voiceApi = {
  native: false,
  request: ((...args) => fetch(...args)) as typeof fetch,
  async signIn(_password: string): Promise<void> {
    throw Error("Sign in through the private preview page.");
  },
  async signOut(): Promise<void> {},
};
