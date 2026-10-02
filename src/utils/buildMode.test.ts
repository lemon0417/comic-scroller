describe("development build flag", () => {
  it.each(["development", "production", "test", "staging"])(
    "only enables tools for development (%s)",
    (mode) => {
      jest.replaceProperty(process.env, "NODE_ENV", mode);
      jest.isolateModules(() => {
        expect(require("./buildMode").IS_DEVELOPMENT_BUILD).toBe(
          mode === "development",
        );
      });
      jest.restoreAllMocks();
    },
  );
});
