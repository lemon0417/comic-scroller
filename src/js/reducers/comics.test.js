import comics, { resetImg, updateInnerHeight } from './comics';

describe('comics reducer', () => {
  it('updates innerHeight', () => {
    const prevState = comics(undefined, { type: '@@INIT' });
    const nextState = comics(prevState, updateInnerHeight(720));

    expect(nextState.innerHeight).toBe(720);
  });

  it('resets imageList on resetImg', () => {
    const seededState = {
      ...comics(undefined, { type: '@@INIT' }),
      imageList: {
        result: [0, 1],
        entity: {
          0: { src: 'a', loading: false },
          1: { src: 'b', loading: false },
        },
      },
    };

    const nextState = comics(seededState, resetImg());

    expect(nextState.imageList).toEqual({ result: [], entity: {} });
  });
});
