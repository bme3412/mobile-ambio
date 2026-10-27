import { practiceCredentials, unlockPractice } from "../src/practice/api";
import { voiceApi } from "../src/conversation/api";
jest.mock("../src/conversation/api", () => ({
  voiceApi: { native: true, request: jest.fn(), signIn: jest.fn() },
}));
beforeEach(() => jest.clearAllMocks());
test("an expired session requests inline unlock instead of sending the learner to Talk", async () => {
  jest
    .mocked(voiceApi.request)
    .mockResolvedValue({ status: 401, ok: false } as Response);
  expect(await practiceCredentials()).toEqual({ requiresSignIn: true });
});
test("unlock uses the same sign-in service as Talk and returns safe bridge data", async () => {
  jest.mocked(voiceApi.signIn).mockResolvedValue();
  expect(await unlockPractice("beta-password")).toEqual({});
  expect(voiceApi.signIn).toHaveBeenCalledWith("beta-password");
  jest
    .mocked(voiceApi.signIn)
    .mockRejectedValue(Error("That preview password didn’t match."));
  expect(await unlockPractice("wrong")).toEqual({
    error: "That preview password didn’t match.",
  });
});
test("service failures do not masquerade as sign-in requirements", async () => {
  jest
    .mocked(voiceApi.request)
    .mockResolvedValue({ status: 503, ok: false } as Response);
  await expect(practiceCredentials()).rejects.toThrow("unavailable");
});
