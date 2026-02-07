import { of } from "rxjs";
import resizeEpic, { startResize } from "./resizeEpic";
import { updateInnerHeight } from "@domain/reducers/comics";

describe("resizeEpic", () => {
  it("emits updateInnerHeight on window resize after start", () => {
    jest.useFakeTimers();

    const action$ = of(startResize());
    const output$ = resizeEpic(action$);

    const actions: any[] = [];
    const subscription = output$.subscribe((action: any) =>
      actions.push(action),
    );

    Object.defineProperty(window, "innerHeight", {
      value: 777,
      configurable: true,
    });

    window.dispatchEvent(new Event("resize"));
    jest.runAllTimers();

    expect(actions).toContainEqual(updateInnerHeight(777));

    subscription.unsubscribe();
    jest.useRealTimers();
  });
});
