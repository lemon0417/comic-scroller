import { Observable } from "rxjs";

export function fetchText$(
  url: string,
  source: string,
  options: Pick<RequestInit, "redirect" | "credentials" | "headers"> = {},
) {
  return new Observable<string>((subscriber) => {
    const controller = new AbortController();
    let settled = false;

    void fetch(url, { ...options, signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`${source} request failed: ${response.status}`);
        }
        return response.text();
      })
      .then(
        (text) => {
          if (subscriber.closed) return;
          settled = true;
          subscriber.next(text);
          subscriber.complete();
        },
        (error: unknown) => {
          if (subscriber.closed) return;
          settled = true;
          subscriber.error(error);
        },
      );

    return () => {
      if (!settled) {
        controller.abort();
      }
    };
  });
}
