// Calendar prompts, not live-news claims. Shared by the app and voice service.
const days = [
  ["Sunday reset", "A small win this week", "Make room for next week"],
  ["A fresh start", "One thing to look forward to", "Your ideal Monday"],
  [
    "Everyday adventures",
    "A place you would love to visit",
    "A habit worth keeping",
  ],
  [
    "Midweek discoveries",
    "Something that surprised you",
    "A book, film, or song",
  ],
  [
    "A different perspective",
    "A small change with a big impact",
    "Something you have changed your mind about",
  ],
  ["Weekend possibilities", "Your perfect evening", "A plan with friends"],
  ["Time to explore", "A meal worth talking about", "A day with no plans"],
];
function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function topicsForDate(value = localDate()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw Error("Invalid conversation date");
  const date = new Date(value + "T12:00:00Z");
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  )
    throw Error("Invalid conversation date");
  const weekday = date.getUTCDay();
  return {
    date: value,
    day: [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ][weekday],
    topics: days[weekday].map((label, index) => ({
      id: `day-${weekday}-${index}`,
      label,
    })),
  };
}
function conversationOpening(topicId, date) {
  const daily = topicsForDate(date);
  const topic =
    topicId === "open"
      ? { label: "Whatever is on your mind" }
      : daily.topics.find((t) => t.id === topicId);
  if (!topic) throw Error("Unknown conversation topic");
  return `The learner's local date is ${daily.date}, ${daily.day}. Selected conversation starter: ${topic.label}. Start immediately with a brief, friendly greeting and ONE easy French question about this topic. Do not ask them to select a topic again or require listening to an episode. Follow their interests freely, including daily life, culture, plans, work, or personal experiences. You have no live news feed: do not invent current events, weather, or local happenings. If they mention news, ask about what they read and discuss their perspective without presenting unverified details as facts.`;
}
module.exports = { localDate, topicsForDate, conversationOpening };
