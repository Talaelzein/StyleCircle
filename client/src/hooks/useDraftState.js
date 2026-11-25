import { useEffect, useState } from "react";

const memoryDrafts = new Map();

export default function useDraftState(key, initialValue, { memoryOnly = false } = {}) {
  const [value, setValue] = useState(() => {
    if (memoryDrafts.has(key)) return memoryDrafts.get(key);
    if (!memoryOnly) {
      try {
        const stored = sessionStorage.getItem(key);
        if (stored !== null) {
          const parsed = JSON.parse(stored);
          memoryDrafts.set(key, parsed);
          return parsed;
        }
      } catch { /* Storage may be disabled. */ }
    }
    const fresh = typeof initialValue === "function" ? initialValue() : initialValue;
    memoryDrafts.set(key, fresh);
    return fresh;
  });

  useEffect(() => {
    memoryDrafts.set(key, value);
    if (!memoryOnly) {
      try { sessionStorage.setItem(key, JSON.stringify(value)); }
      catch { /* Use memory only. */ }
    }
  }, [key, value, memoryOnly]);

  return [value, setValue];
}

export function clearUserDrafts(userId) {
  if (!userId) return;
  const prefix = `stylecircle-draft:${userId}:`;
  for (const [key, value] of memoryDrafts) {
    if (!key.startsWith(prefix)) continue;
    if (key.endsWith(":fitting:bodyPhoto")) {
      for (const photo of [value?.front, value?.back, value]) {
        if (photo?.url) URL.revokeObjectURL(photo.url);
      }
    }
    memoryDrafts.delete(key);
  }
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(prefix)) sessionStorage.removeItem(key);
    }
  } catch { /* Storage may be disabled. */ }
}
