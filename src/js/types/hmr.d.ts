declare const module: {
  hot?: {
    accept: (path: string, cb: () => void) => void;
  };
};
