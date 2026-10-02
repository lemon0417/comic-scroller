export type BackgroundSummary = {
  checked: number;
  updated: number;
  errors: number;
  diff: {
    before: number;
    after: number;
    added: number;
  };
};

export type BackgroundCheckResult = {
  at: number;
  summary: BackgroundSummary;
};

export type BackgroundCheckResponse =
  | ({ ok: true } & BackgroundCheckResult)
  | { ok: false; reason: "disabled" | "update-check-failed" };
