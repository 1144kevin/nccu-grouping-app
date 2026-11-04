// The API keeps levels 1-5; the app displays them as Lv.0-Lv.4.
export const levelLabel = (level: number) =>
  `Lv.${Math.max(1, Math.min(5, Math.trunc(level))) - 1}`;
