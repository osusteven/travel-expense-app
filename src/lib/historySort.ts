export const HISTORY_SORT_COOKIE = "ledger_history_sort";

export const HISTORY_SORTS = {
  newest: "Newest first",
  oldest: "Oldest first",
  "amount-desc": "Highest amount",
  "amount-asc": "Lowest amount",
  az: "Description A–Z",
} as const;
export type HistorySort = keyof typeof HISTORY_SORTS;

export const parseHistorySort = (v: string | undefined): HistorySort =>
  v && v in HISTORY_SORTS ? (v as HistorySort) : "newest";

/** Date sorts keep the day groups; the others show one list with the date on each entry. */
export const groupsByDay = (s: HistorySort) => s === "newest" || s === "oldest";
