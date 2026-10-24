import { ConversationSession } from "../domain/types";
export const prompts = [
  {
    question:
      "Si vous aviez une heure de plus ce week-end, qu’aimeriez-vous découvrir, et pourquoi ?",
    sample:
      "Si j’aurais une heure de plus, j’aimerais rencontrer un artisan chocolatier.",
    reply:
      "Vous aimeriez rencontrer un artisan. Quelle question lui poseriez-vous ?",
    help: "Choose science, craftsmanship or a slower moment. Try: « Si j’avais une heure de plus, j’aimerais… » (If I had an extra hour, I’d like to…).",
  },
  {
    question:
      "Quelle question aimeriez-vous poser à un scientifique ou à un artisan ?",
    sample: "J’aimerais comprendre comment on choisit un équilibre de saveurs.",
    reply:
      "Vous avez choisi une question concrète sur les saveurs. Pourquoi ce sujet vous intéresse-t-il ?",
    help: "Ask something specific. Try: « J’aimerais comprendre comment… » (I’d like to understand how…).",
  },
  {
    question: "Pourquoi ce sujet vous intéresse-t-il personnellement ?",
    sample:
      "Ce qui m’intéresse, c’est de découvrir le travail derrière ce qu’on mange.",
    reply:
      "Vous avez fait un choix, posé une question et donné une raison personnelle. Essayez maintenant de le dire en une minute sans regarder vos notes.",
    help: "Give a personal reason. « Ce qui m’intéresse, c’est… » means “What interests me is…”.",
  },
];
export const correction = {
  id: "si-javais",
  original: "Si j’aurais une heure de plus",
  suggestion: "Si j’avais une heure de plus",
  explanation:
    "For this hypothetical situation, use the imperfect after « si » and the conditional in the main clause: « Si j’avais une heure de plus, j’aimerais… ».",
};
export function appendResponse(
  turns: ConversationSession["turns"],
  text: string,
  step: number,
): ConversationSession["turns"] {
  return [
    ...turns,
    { id: `user-${turns.length}`, role: "user", text },
    {
      id: `tutor-${turns.length + 1}`,
      role: "tutor",
      text:
        text === prompts[step].sample
          ? prompts[step].reply
          : `Merci pour votre réponse. ${prompts[step + 1]?.question ?? "Relisez votre réponse, puis dites-la à voix haute en une minute."}`,
    },
  ];
}
