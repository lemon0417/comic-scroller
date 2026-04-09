import { REQUEST_DISMISS_EXTENSION_RELEASE_NOTICE } from "@domain/actions/popup";
import { setExtensionReleaseNotice } from "@domain/reducers/popupState";
import {
  dismissExtensionReleaseNotice,
  getExtensionReleaseNotice,
} from "@infra/services/extensionRelease";
import { ofType } from "redux-observable";
import { from, type Observable, of } from "rxjs";
import { catchError, mergeMap } from "rxjs/operators";

import type { PopupEpic } from "../types";

type DismissExtensionReleaseNoticeAction = {
  type: typeof REQUEST_DISMISS_EXTENSION_RELEASE_NOTICE;
  payload?: {
    latestVersion?: string;
  };
};

const releaseNoticeEpic: PopupEpic = (action$) =>
  (action$ as Observable<DismissExtensionReleaseNoticeAction>).pipe(
    ofType(REQUEST_DISMISS_EXTENSION_RELEASE_NOTICE),
    mergeMap((action) => {
      const latestVersion = action.payload?.latestVersion || "";
      if (!latestVersion) {
        return [];
      }

      return from(dismissExtensionReleaseNotice(latestVersion)).pipe(
        mergeMap(() =>
          from(getExtensionReleaseNotice()).pipe(
            mergeMap((notice) => [setExtensionReleaseNotice(notice)]),
          ),
        ),
        catchError(() => of(setExtensionReleaseNotice(null))),
      );
    }),
  );

export default releaseNoticeEpic;
