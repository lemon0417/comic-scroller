import { ActionsObservable } from 'redux-observable';
import resizeEpic, { startResize } from './resizeEpic';
import { updateInnerHeight } from '../container/App/reducers/comics';

describe('resizeEpic', () => {
  it('emits updateInnerHeight on window resize after start', () => {
    jest.useFakeTimers();

    const action$ = ActionsObservable.of(startResize());
    const output$ = resizeEpic(action$);

    const actions = [];
    const subscription = output$.subscribe(action => actions.push(action));

    Object.defineProperty(window, 'innerHeight', {
      value: 777,
      configurable: true,
    });

    window.dispatchEvent(new Event('resize'));
    jest.runAllTimers();

    expect(actions).toContainEqual(updateInnerHeight(777));

    subscription.unsubscribe();
    jest.useRealTimers();
  });
});
