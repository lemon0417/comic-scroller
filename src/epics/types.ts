import type { RootState } from "@domain/reducers";
import type { PopupRootState } from "@domain/reducers/popup";
export type { PopupRootState } from "@domain/reducers/popup";
import type { Observable } from "rxjs";

export type EpicAction = {
  type: string;
  [key: string]: unknown;
};

type StateStream<State> = {
  value: State;
};

type BaseEpic<State> = (
  action$: Observable<EpicAction>,
  state$: StateStream<State>,
) => Observable<EpicAction>;

export type AppEpic = BaseEpic<RootState>;

export type PopupEpic = BaseEpic<PopupRootState>;
