import type { RootState } from "@domain/reducers";
import type { PopupState } from "@domain/reducers/popupState";
import type { Observable } from "rxjs";

export type EpicAction = {
  type: string;
  [key: string]: unknown;
};

type StateStream<State> = {
  value: State;
};

export type PopupRootState = {
  popup: PopupState;
};

type BaseEpic<State> = (
  action$: Observable<EpicAction>,
  state$: StateStream<State>,
) => Observable<EpicAction>;

export type AppEpic = BaseEpic<RootState>;

export type PopupEpic = BaseEpic<PopupRootState>;
