jest.mock("./sites/registry", () => ({ getSiteReaderEpics: jest.fn() }));

describe("reader site inference", () => {
  afterEach(() => {
    window.history.replaceState(null, "", "/");
    jest.clearAllMocks();
  });

  it.each([
    ["m123", "dm5"],
    ["comic/49169/910633.html", "manhuagui"],
    ["online/new-105.html?ch=420a", "8comic"],
    ["comic-105.html?ch=420", ""],
  ])("infers %s as %s", (chapter, site) => {
    window.history.replaceState(
      null,
      "",
      `/?${new URLSearchParams({ chapter })}`,
    );
    jest.isolateModules(() => {
      require("./getAction");
      const registry = require("./sites/registry");
      expect(registry.getSiteReaderEpics).toHaveBeenCalledWith(site);
    });
  });

  it("keeps an explicit site selection", () => {
    window.history.replaceState(null, "", "/?site=8comic&chapter=invalid");
    jest.isolateModules(() => {
      require("./getAction");
      expect(
        require("./sites/registry").getSiteReaderEpics,
      ).toHaveBeenCalledWith("8comic");
    });
  });
});
