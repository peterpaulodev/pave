"use client";

// localStorage can throw or come back empty (private window, blocked site
// data), so every access is wrapped; callers must render fine without it.
// A tiny pub/sub lets useSyncExternalStore see writes made in this tab.

const listeners = new Set<() => void>();

export function subscribeStorage(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore: the flag just won't stick
  }
  listeners.forEach((listener) => listener());
}
