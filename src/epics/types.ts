import type { RootState } from "@domain/reducers";
import type { PopupState } from "@domain/reducers/popupState";
import type { Observable } from "rxjs";

export type EpicAction = {
  type: string;
  [key: string]: unknown;
};

export type StateStream<State> = {
  value: State;
};

export type RootStateStream = StateStream<RootState>;

export type PopupRootState = {
  popup: PopupState;
};

export type PopupStateStream = StateStream<PopupRootState>;

export type BaseEpic<State> = (
  action$: Observable<EpicAction>,
  state$: StateStream<State>,
) => Observable<EpicAction>;

export type AppEpic = BaseEpic<RootState>;

export type PopupEpic = BaseEpic<PopupRootState>;
