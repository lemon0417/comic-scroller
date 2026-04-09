import { requestDismissExtensionReleaseNotice } from "@domain/actions/popup";
import { setExtensionReleaseNotice } from "@domain/reducers/popupState";
import { lastValueFrom, of } from "rxjs";
import { toArray } from "rxjs/operators";

import releaseNoticeEpic from "./releaseNoticeEpic";

jest.mock("@infra/services/extensionRelease", () => ({
  dismissExtensionReleaseNotice: jest.fn(),
  getExtensionReleaseNotice: jest.fn(),
}));

const { dismissExtensionReleaseNotice, getExtensionReleaseNotice } =
  jest.requireMock("@infra/services/extensionRelease");

describe("releaseNoticeEpic", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("dismisses the stored release notice and rehydrates popup state", async () => {
    dismissExtensionReleaseNotice.mockResolvedValue(undefined);
    getExtensionReleaseNotice.mockResolvedValue(null);

    const actions = await lastValueFrom(
      releaseNoticeEpic(
        of(requestDismissExtensionReleaseNotice("4.2.0")),
        { value: undefined as never },
      ).pipe(toArray()),
    );

    expect(dismissExtensionReleaseNotice).toHaveBeenCalledWith("4.2.0");
    expect(actions).toEqual([setExtensionReleaseNotice(null)]);
  });
});
