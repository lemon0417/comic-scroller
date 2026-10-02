import type { PopupFeedEntry } from "@domain/library";

export type ManageTab = "updates" | "following" | "history" | "data";
export type ManageFeedTab = Exclude<ManageTab, "data">;

export type ManageDialogState =
  | { kind: "closed" }
  | { kind: "history"; item: PopupFeedEntry }
  | { kind: "reset" }
  | { kind: "cleanup" }
  | { kind: "subscribe"; item: PopupFeedEntry; clearSeriesData: boolean };
