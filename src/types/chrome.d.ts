type ChromeStorageCallback = (items: Record<string, unknown>) => void;
type ChromeVoidCallback = () => void;

type ChromeStorageChange = {
  oldValue?: unknown;
  newValue?: unknown;
};

type ChromeNotificationOptions = {
  type: "basic" | "image" | "list" | "progress";
  title: string;
  message: string;
  iconUrl?: string;
};

type ChromeTab = {
  id?: number;
  url?: string;
};

type ChromeOnInstalledDetails = {
  reason?: string;
};

type ChromeAlarm = {
  name?: string;
};

type ChromeNavigationDetails = {
  frameId: number;
  tabId: number;
  url: string;
};

declare const chrome: {
  action: {
    setBadgeBackgroundColor(details: { color: string }): void;
    setBadgeText(details: { text: string }): void;
  };
  alarms: {
    create(
      name: string,
      options: {
        delayInMinutes?: number;
        periodInMinutes?: number;
        when?: number;
      },
    ): void;
    onAlarm: {
      addListener(listener: (alarm: ChromeAlarm) => void): void;
    };
  };
  extension?: {
    getViews(options: { type: "popup" }): Window[];
  };
  notifications: {
    clear(id: string): void;
    create(id: string, options: ChromeNotificationOptions): void;
    onClicked: {
      addListener(listener: (id: string) => void): void;
    };
  };
  runtime: {
    getManifest(): { version: string };
    getURL(path: string): string;
    onInstalled: {
      addListener(
        listener: (details: ChromeOnInstalledDetails) => void,
      ): void;
    };
    onMessage: {
      addListener(
        listener: (
          request: { msg?: string },
          sender: unknown,
          sendResponse: (response: Record<string, unknown>) => void,
        ) => boolean | void,
      ): void;
    };
    openOptionsPage(): void;
    sendMessage(message: { msg: string }): void;
  };
  storage: {
    local: {
      get(callback: ChromeStorageCallback): void;
      get(
        keys: string | string[] | Record<string, unknown> | null,
        callback: ChromeStorageCallback,
      ): void;
      set(items: Record<string, unknown>, callback?: ChromeVoidCallback): void;
      clear(callback?: ChromeVoidCallback): void;
      remove(
        keys: string | string[],
        callback?: ChromeVoidCallback,
      ): void;
    };
    onChanged: {
      addListener(
        listener: (
          changes: Record<string, ChromeStorageChange>,
          areaName: string,
        ) => void,
      ): void;
      removeListener(
        listener: (
          changes: Record<string, ChromeStorageChange>,
          areaName: string,
        ) => void,
      ): void;
    };
  };
  tabs: {
    create(options: { url: string }): void;
    getCurrent(callback: (tab?: ChromeTab) => void): void;
    remove(tabId: number): void;
    update(tabId: number, options: { url: string }): void;
  };
  webNavigation: {
    onBeforeNavigate: {
      addListener(
        listener: (details: ChromeNavigationDetails) => void,
        filters?: { url: Array<{ urlMatches: string }> },
      ): void;
    };
  };
};
