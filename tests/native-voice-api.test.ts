import * as SecureStore from "expo-secure-store";
import { voiceApi } from "../src/conversation/api.native";
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: "device-only",
}));
const originalFetch = global.fetch;
beforeEach(() => jest.clearAllMocks());
afterEach(() => {
  global.fetch = originalFetch;
});
test("native sign-in stores only the returned session token in secure storage", async () => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ token: "signed-session" }),
  })) as unknown as typeof fetch;
  await voiceApi.signIn("preview-password");
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
    "ambio.native-voice-session.v1",
    "signed-session",
    { keychainAccessible: "device-only" },
  );
  expect(global.fetch).toHaveBeenCalledWith(
    "https://ambio-daily-preview.vercel.app/api/voice/login",
    expect.objectContaining({ method: "POST", credentials: "omit" }),
  );
});
test("native requests use HTTPS and bearer auth, clearing expired sessions", async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue("signed-session");
  global.fetch = jest.fn(async () => ({
    ok: false,
    status: 401,
  })) as unknown as typeof fetch;
  await voiceApi.request("/api/voice/health");
  const [url, init] = jest.mocked(global.fetch).mock.calls[0];
  expect(url).toBe("https://ambio-daily-preview.vercel.app/api/voice/health");
  expect(new Headers(init?.headers).get("Authorization")).toBe(
    "Bearer signed-session",
  );
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
    "ambio.native-voice-session.v1",
  );
  await expect(
    voiceApi.request("https://other.example/api/voice/health"),
  ).rejects.toThrow("Invalid voice endpoint");
  expect(global.fetch).toHaveBeenCalledTimes(1);
});
test("incorrect passwords never enter secure storage", async () => {
  global.fetch = jest.fn(async () => ({
    ok: false,
    status: 401,
  })) as unknown as typeof fetch;
  await expect(voiceApi.signIn("wrong")).rejects.toThrow("didn’t match");
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
});
