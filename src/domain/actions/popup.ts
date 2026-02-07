export type RemoveCardPayload = {
  category: "update" | "subscribe" | "history";
  index: number | string;
  comicsID: string;
  chapterID?: string;
  site?: string;
};

export const REQUEST_REMOVE_CARD = "REQUEST_REMOVE_CARD";

export function requestRemoveCard(payload: RemoveCardPayload) {
  return { type: REQUEST_REMOVE_CARD, payload };
}
