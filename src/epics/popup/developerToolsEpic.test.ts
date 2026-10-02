import {
  requestBackgroundCheck,
  requestInitializeDeveloperTools,
  requestSetDevLogEnabled,
} from "@domain/actions/developerTools";
import developerTools, {
  initialDeveloperToolsState,
} from "@domain/reducers/developerTools";
import popupState, { hydratePopupFeed } from "@domain/reducers/popupState";
import type { EpicAction, PopupRootState } from "@epics/types";
import { runDeveloperBackgroundCheck } from "@infra/services/developerTools";
import * as devLog from "@utils/devLog";
import { Subject } from "rxjs";

import developerToolsEpic from "./developerToolsEpic";

jest.mock("@utils/buildMode", () => ({ IS_DEVELOPMENT_BUILD: true }));
jest.mock("@infra/services/developerTools", () => ({
  runDeveloperBackgroundCheck: jest.fn(),
}));
jest.mock("@utils/devLog", () => ({
  isDevLogEnabled: jest.fn(),
  setDevLogEnabled: jest.fn(),
}));

const result = {
  at: 123,
  summary: {
    checked: 2,
    updated: 1,
    errors: 0,
    diff: { before: 1, after: 2, added: 1 },
  },
};

describe("developer tools epic", () => {
  let action$: Subject<EpicAction>;
  let state$: { value: PopupRootState };
  let outputs: EpicAction[];
  let stop: () => void;
  function dispatch(action: EpicAction) {
    state$.value = {
      popup: popupState(state$.value.popup, action),
      developerTools: developerTools(state$.value.developerTools, action),
    };
    action$.next(action);
  }
  const flush = async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  };

  beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(runDeveloperBackgroundCheck).mockResolvedValue(result);
    jest.mocked(devLog.isDevLogEnabled).mockReturnValue(false);
    jest.mocked(devLog.setDevLogEnabled).mockReturnValue(true);
    action$ = new Subject();
    state$ = {
      value: {
        popup: popupState(undefined, { type: "init" }),
        developerTools: initialDeveloperToolsState,
      },
    };
    outputs = [];
    const subscription = developerToolsEpic(action$, state$).subscribe(
      (action) => {
        outputs.push(action);
        dispatch(action);
      },
    );
    stop = () => subscription.unsubscribe();
  });
  afterEach(() => stop());

  it("loads and changes the saved logging setting", () => {
    dispatch(requestInitializeDeveloperTools());
    expect(state$.value.developerTools?.debugReady).toBe(true);
    dispatch(requestSetDevLogEnabled(true));
    expect(devLog.setDevLogEnabled).toHaveBeenCalledWith(true);
    expect(state$.value.developerTools?.debugLogEnabled).toBe(true);
  });

  it("reports storage failure and permits a retry", () => {
    jest.mocked(devLog.setDevLogEnabled).mockImplementationOnce(() => {
      throw new Error("storage");
    });
    dispatch(requestSetDevLogEnabled(true));
    expect(state$.value.developerTools?.debugPending).toBe(false);
    expect(state$.value.developerTools?.debugError).toContain("儲存空間");
    dispatch(requestSetDevLogEnabled(true));
    expect(state$.value.developerTools?.debugError).toBe("");
  });

  it("ignores duplicate scans and holds its state across storage refreshes", async () => {
    let finish!: (value: typeof result) => void;
    jest.mocked(runDeveloperBackgroundCheck).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    dispatch(requestBackgroundCheck());
    dispatch(requestBackgroundCheck());
    dispatch(hydratePopupFeed(state$.value.popup.feed));
    expect(runDeveloperBackgroundCheck).toHaveBeenCalledTimes(1);
    expect(state$.value.developerTools?.checkStatus).toBe("running");
    finish(result);
    await flush();
    expect(state$.value.developerTools?.checkResult).toEqual(result);
  });

  it("reports connection failure and handles a subsequent successful scan", async () => {
    jest
      .mocked(runDeveloperBackgroundCheck)
      .mockRejectedValueOnce(new Error("等待結果逾時"));
    dispatch(requestBackgroundCheck());
    await flush();
    expect(state$.value.developerTools?.checkStatus).toBe("error");
    dispatch(requestBackgroundCheck());
    await flush();
    expect(state$.value.developerTools?.checkStatus).toBe("success");
    expect(outputs).toHaveLength(2);
  });

  it("does not scan during another library mutation", async () => {
    state$.value.popup.activeAction = "cleanup";
    dispatch(requestBackgroundCheck());
    await flush();
    expect(runDeveloperBackgroundCheck).not.toHaveBeenCalled();
    expect(state$.value.developerTools?.checkError).toContain(
      "書庫資料正在更新",
    );
  });
});
