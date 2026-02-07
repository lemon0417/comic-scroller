import map from "lodash/map";
import filter from "lodash/filter";
import findIndex from "lodash/findIndex";
import pickBy from "lodash/pickBy";

type ListCategory = "update" | "subscribe" | "history";

type Action = {
  type: string;
  data?: {
    update: Array<any>;
    subscribe: Array<any>;
    history: Array<any>;
    dm5: any;
    sf: any;
    comicbus: any;
  };
  category?: ListCategory;
  index?: number;
};

type State = {
  update: Array<any>;
  subscribe: Array<any>;
  history: Array<any>;
  exportUrl: string;
  exportFilename: string;
  dm5: {
    baseURL: string;
  };
  sf: {
    baseURL: string;
  };
  comicbus: {
    baseURL: string;
  };
  [key: string]: any;
};

const initialState = {
  update: [],
  subscribe: [],
  history: [],
  exportUrl: "",
  exportFilename: "",
  dm5: {
    baseURL: "https://www.dm5.com",
  },
  sf: {
    baseURL: "http://comic.sfacg.com",
  },
  comicbus: {
    baseURL: "http://www.comicbus.com",
  },
};

const UPDATE_POPUP_DATA = "UPDATE_POPUP_DATA";
const REMOVE_CARD = "REMOVE_CARD";
const SHIFT_CARDS = "SHIFT_CARDS";
const MOVE_CARD = "MOVE_CARD";
const SET_EXPORT_CONFIG = "SET_EXPORT_CONFIG";
const CLEAR_EXPORT_CONFIG = "CLEAR_EXPORT_CONFIG";

export default function popup(state: State = initialState, action: Action) {
  switch (action.type) {
    case UPDATE_POPUP_DATA: {
      const data = action.data || {
        update: [],
        subscribe: [],
        history: [],
        dm5: {},
        sf: {},
        comicbus: {},
      };
      return {
        exportUrl: state.exportUrl,
        exportFilename: state.exportFilename,
        update: map(data.update || [], (item) => ({
          ...item,
          shift: false,
          move: false,
        })),
        subscribe: map(data.subscribe || [], (item) => ({
          ...item,
          shift: false,
          move: false,
        })),
        history: map(data.history || [], (item) => ({
          ...item,
          shift: false,
          move: false,
        })),
        dm5: {
          ...state.dm5,
          ...data.dm5,
        },
        sf: {
          ...state.sf,
          ...data.sf,
        },
        comicbus: {
          ...state.comicbus,
          ...data.comicbus,
        },
      };
    }
    case SET_EXPORT_CONFIG:
      return {
        ...state,
        exportUrl: action.url || "",
        exportFilename: action.filename || "",
      };
    case CLEAR_EXPORT_CONFIG:
      return {
        ...state,
        exportUrl: "",
        exportFilename: "",
      };
    case REMOVE_CARD: {
      const category = action.category;
      if (!category) return state;
      if (category === "history") {
        const index = findIndex(state.history, (item) => item.move);
        if (index < 0) return state;
        const { site, comicsID } = state.history[index] || {};
        return {
          ...state,
          history: filter(state.history, (item) => !item.move).map((item) => ({
            ...item,
            move: false,
            shift: false,
          })),
          ...(site
            ? {
                [site]: pickBy(
                  state[site],
                  (item) => item.comicsID !== comicsID,
                ),
              }
            : {}),
        };
      }
      return {
        ...state,
        [category]: filter(state[category], (item) => !item.move).map(
          (item) => ({ ...item, move: false, shift: false }),
        ),
      };
    }
    case SHIFT_CARDS: {
      const category = action.category;
      const index = typeof action.index === "number" ? action.index : -1;
      if (!category) return state;
      return {
        ...state,
        [category]: map(state[category], (item, i) => {
          if (i > index) return { ...item, shift: true };
          return item;
        }),
      };
    }
    case MOVE_CARD: {
      const category = action.category;
      const index = typeof action.index === "number" ? action.index : -1;
      if (!category) return state;
      return {
        ...state,
        [category]: map(state[category], (item, i) => {
          if (i === index) return { ...item, move: true };
          return item;
        }),
      };
    }
    default:
      return state;
  }
}

export function updatePopupData(data: {
  subscribe: Array<any>;
  history: Array<any>;
  update: Array<any>;
}) {
  return { type: UPDATE_POPUP_DATA, data };
}

export function removeCard(category: string, index: number) {
  return { type: REMOVE_CARD, category, index };
}

export function shiftCards(category: string, index: number) {
  return { type: SHIFT_CARDS, category, index };
}

export function moveCard(category: string, index: number) {
  return { type: MOVE_CARD, category, index };
}

export function setExportConfig(url: string, filename: string) {
  return { type: SET_EXPORT_CONFIG, url, filename };
}

export function clearExportConfig() {
  return { type: CLEAR_EXPORT_CONFIG };
}
