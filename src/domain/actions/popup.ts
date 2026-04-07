export type RemoveCardPayload = {
  category: "update" | "subscribe" | "history";
  index: number | string;
  comicsID: string;
  chapterID?: string;
  clearSeriesData?: boolean;
  site?: string;
};

export type PopupDataView = "popup" | "manage";

export const REQUEST_REMOVE_CARD = "REQUEST_REMOVE_CARD";
export const REQUEST_POPUP_DATA = "REQUEST_POPUP_DATA";
export const REQUEST_IMPORT_CONFIG = "REQUEST_IMPORT_CONFIG";
export const REQUEST_RESET_CONFIG = "REQUEST_RESET_CONFIG";
export const REQUEST_EXPORT_CONFIG = "REQUEST_EXPORT_CONFIG";
export const POPUP_UPDATE_LIMIT = 50;

export function requestRemoveCard(payload: RemoveCardPayload) {
  return { type: REQUEST_REMOVE_CARD, payload };
}

export function requestPopupData(view?: PopupDataView) {
  return view ? { type: REQUEST_POPUP_DATA, payload: { view } } : { type: REQUEST_POPUP_DATA };
}

export function requestImportConfig(payload: unknown) {
  return { type: REQUEST_IMPORT_CONFIG, payload };
}

export function requestResetConfig() {
  return { type: REQUEST_RESET_CONFIG };
}

export function requestExportConfig() {
  return { type: REQUEST_EXPORT_CONFIG };
}
