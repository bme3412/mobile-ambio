/* eslint-disable @typescript-eslint/no-require-imports */
const local = require("../server/voice-config.cjs");
const hosted = require("../preview/lib/voice-config.cjs");
test("voice context uses a server-owned edition and keeps hosted/local configurations aligned", () => {
  const old = local.sessionConfig("daily-fr-2026-10-24");
  const latest = local.sessionConfig("daily-fr-2026-10-25");
  expect(latest.instructions).toContain("Le goût de la découverte");
  expect(latest.instructions).toContain("Sophie Adenot");
  expect(old.instructions).not.toContain("Sophie Adenot");
  for (const id of [
    "daily-fr-2026-10-24",
    "daily-fr-2026-10-25",
    "daily-fr-2026-10-26",
  ])
    expect(hosted.sessionConfig(id)).toEqual(local.sessionConfig(id));
  expect(() => local.sessionConfig("untrusted client text")).toThrow(
    "Unknown episode",
  );
  expect(() => hosted.sessionConfig("__proto__")).toThrow("Unknown episode");
  expect(local.sessionConfig("daily-fr-2026-10-26").instructions).toContain(
    "Le monde en mouvement",
  );
  expect(local.sessionConfig()).toEqual(old);
});

test("weekday conversation starts directly without episode context", () => {
  const options = { topicId: "day-3-1", localDate: "2026-10-28" };
  const config = hosted.sessionConfig(undefined, undefined, options);
  expect(config).toEqual(local.sessionConfig(undefined, undefined, options));
  expect(config.instructions).toContain("Something that surprised you");
  expect(config.instructions).toContain("Wednesday");
  expect(config.instructions).not.toContain("DATED EPISODE:");
  expect(config.instructions).toContain("no live news feed");
  expect(() =>
    hosted.sessionConfig(undefined, undefined, { topicId: "__proto__" }),
  ).toThrow();
  expect(() =>
    hosted.sessionConfig(undefined, undefined, {
      topicId: "open",
      localDate: "2026-02-30",
    }),
  ).toThrow();
});
test("all seven weekdays have distinct valid starters across date boundaries", () => {
  const {
    topicsForDate,
    conversationOpening,
    localDate,
  } = require("../preview/lib/conversation-topics.cjs");
  const labels = new Set();
  for (let day = 25; day <= 31; day++) {
    const date = `2026-10-${day}`;
    const daily = topicsForDate(date);
    expect(daily.topics).toHaveLength(3);
    for (const topic of daily.topics) {
      labels.add(topic.label);
      expect(conversationOpening(topic.id, date)).toContain(topic.label);
    }
  }
  expect(labels.size).toBe(21);
  expect(localDate(new Date(2026, 9, 28, 23, 59))).toBe("2026-10-28");
});

test("native calls protect replies from automatic speech-triggered cancellation", () => {
  const native = hosted.sessionConfig(undefined, undefined, {
    topicId: "open",
    autoInterrupt: false,
  });
  expect(native.audio.input.turn_detection.interrupt_response).toBe(false);
  expect(native.audio.input.turn_detection.create_response).toBe(true);
  expect(native.audio.input.noise_reduction).toEqual({ type: "near_field" });
  expect(
    hosted.sessionConfig().audio.input.turn_detection.interrupt_response,
  ).toBe(true);
});
