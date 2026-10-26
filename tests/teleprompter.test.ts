import { teleprompterOffset } from "../src/domain/teleprompter";
const bounds = {
  startMs: 1000,
  nextStartMs: 5000,
  top: 200,
  nextTop: 400,
  anchor: 100,
  reduceMotion: false,
};
test("scroll follows audio progress through a phrase and clamps gaps", () => {
  expect(teleprompterOffset({ ...bounds, positionMs: 1000 })).toBe(100);
  expect(teleprompterOffset({ ...bounds, positionMs: 3000 })).toBe(200);
  expect(teleprompterOffset({ ...bounds, positionMs: 5000 })).toBe(300);
  expect(teleprompterOffset({ ...bounds, positionMs: 6000 })).toBe(300);
});
test("reduced motion holds each phrase at the reading anchor", () => {
  expect(
    teleprompterOffset({ ...bounds, positionMs: 3000, reduceMotion: true }),
  ).toBe(100);
  expect(teleprompterOffset({ ...bounds, positionMs: 0, top: 0 })).toBe(0);
});
