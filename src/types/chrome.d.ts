// Minimal Chrome API stubs for type-checking.
// Extend as needed.

declare const chrome: any;

declare interface NodeModule {
  hot?: {
    accept: (path: string, cb: () => void) => void;
  };
}
