"""Editorial selection policy shared by research, writing, and review."""
VERSION = 'france-tech-sport-v1'
LANES = ('france', 'technology-ai', 'european-sports')
LABELS = ('FRANCE', 'TECH & IA', 'SPORT EUROPÉEN')
QUERIES = (
    'France actualité -"info du jour" -agenda -programme',
    'technologie Europe innovation -emploi -ETF',
    'intelligence artificielle actualité lancement -emploi -formation',
    'site:lequipe.fr sport -calendrier -programme -billetterie',
)

POLICY = '''Select exactly one story in each lane, in this order:
1. france: consequential French domestic politics, public policy, business, or everyday life.
2. technology-ai: substantive European technology developments OR major global AI news, with no European connection required for global AI. Prioritize real capabilities, launches, adoption and industry changes over promotional promises. General science discoveries do not qualify.
3. european-sports: significant European competitions or major international performances by European teams or athletes, across football, tennis, rugby, cycling, F1 and other sports. Do not automatically favor football.
Prefer developments in the newest day of the supplied search window. A wider window is allowed only as fallback, never more than three calendar dates including edition date. The development itself must be fresh, not merely a republished article. Reject unchanged repeats from recent editions. No unrelated culture, events listings or general science substitutions. Hold if any lane lacks sufficient evidence.
Use three distinct substantive source articles, not homepages, archive headlines, navigation or related-story teasers. Claims about significance need evidence; retain uncertainty and distinguish announcements from confirmed results.'''
STYLE = '''Use concrete headlines and an edition title naming its main subjects. Each story opens with a concrete development or engaging question and progresses through what happened, why it matters, and one question worth discussing. Camille and Louis contribute distinct facts, clarifications and perspectives without invented personal experiences or manufactured disagreement. No repetitive summaries or vocabulary lessons to fill time. Briefly explain a term only when comprehension requires it; translations, definitions and practice carry the detailed learning support. Keep roughly 800–1000 French words when evidence supports it; never pad to meet length.'''
# Fictional rhythm examples only, deliberately separated from factual source material.
STYLE_EXAMPLES = '''Illustrative structure, not facts to reuse:
FRANCE: Camille announces a specific French policy change; Louis identifies who it affects from the source; they explore one documented practical consequence and ask the listener's view.
TECH & IA: Louis identifies the new capability and who released it; Camille asks what users can actually do; Louis separates demonstrated results from the company's promises; one everyday discussion question follows.
SPORT EUROPÉEN: Camille gives the result and stakes; Louis explains the decisive sourced moment; they ask about strategy or the experience of following the sport. Do not invent match details or quotations.'''
