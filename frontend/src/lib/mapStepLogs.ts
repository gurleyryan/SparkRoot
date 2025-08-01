export type StepLogMap = {
  [key: string]: string[];
};

const stepKeywords: { [key: string]: string[] } = {
  filter: [
    "Starting deck generation",
    "Commander submitted:",
    "Filtering card pool",
    "Filtering complete",
  ],
  theme: [
    "Detecting deck theme",
    "Theme detected:",
  ],
  categorize: [
    "Categorizing cards by function",
    "Categorization complete",
    "Starting deck with commander:",
    "Detecting commander functions",
    "Commander provides these deck functions:",
  ],
  lands: [
    "Selecting lands FIRST",
    "Selected",
    "Added basic land:",
    "Added nonbasic land:",
    "Deck size after lands",
    "Land count in deck",
  ],
  curve: [
    "Mana curve targets",
    "Added to mana curve slot",
  ],
  rocks: [
    "Mana rocks target",
    "Added mana rock:",
  ],
  categories: [
    "Target lands from curve",
    "Trimmed land:",
    "Filled land:",
    "Strictly filling categories",
    "Strictly filling category",
    "(type-priority) Added to",
    "(overflow) Added to",
    "(min fill) Added to",
    "(final type fill) Added",
    "Added theme/synergy cards",
    "Trimmed",
    "Filled",
    "No valid candidates left to fill deck to 99",
    "Final fill:",
    "Final trim:",
    "Final trim: removed last card",
  ],
  final: [
    "Final deck size",
    "Final land count",
  ],
};

export function mapStepLogs(stepLogs: string[]): StepLogMap {
  const result: StepLogMap = {
    filter: [],
    theme: [],
    categorize: [],
    lands: [],
    curve: [],
    rocks: [],
    categories: [],
    final: [],
  };

  for (const log of stepLogs) {
    for (const [step, keywords] of Object.entries(stepKeywords)) {
      if (keywords.some(kw => log.includes(kw))) {
        result[step].push(log);
        break;
      }
    }
    // If not matched, optionally push to a "misc" or ignore
  }

  return result;
}