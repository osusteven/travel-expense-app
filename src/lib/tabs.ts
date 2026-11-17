/** The trip page's tabs. Kept outside the client component so the server can read it too. */
export type TabId = "add" | "history" | "stats";
export const TAB_IDS: TabId[] = ["add", "history", "stats"];
