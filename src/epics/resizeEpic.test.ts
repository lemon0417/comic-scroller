import { of } from "rxjs";
import resizeEpic from "./resizeEpic";
import { startResize } from "@domain/actions/reader";
import { updateInnerHeight, updateInnerWidth } from "@domain/reducers/comics";

describe("resizeEpic", () => {
  it("emits updateInnerHeight on window resize after start", () => {
    jest.useFakeTimers();

    const action$ = of(startResize());
    const output$ = resizeEpic(action$, {
      value: undefined as never,
    });

    const actions: any[] = [];
    const subscription = output$.subscribe((action: any) =>
      actions.push(action),
    );

    Object.defineProperty(window, "innerHeight", {
      value: 777,
      configurable: true,
    });
    Object.defineProperty(window, "innerWidth", {
      value: 1280,
      configurable: true,
    });

    window.dispatchEvent(new Event("resize"));
    jest.runAllTimers();

    expect(actions).toContainEqual(updateInnerHeight(777));
    expect(actions).toContainEqual(updateInnerWidth(1280));

    subscription.unsubscribe();
    jest.useRealTimers();
  });
});
