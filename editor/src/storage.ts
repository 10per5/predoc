const STORAGE_KEY = "predoc-storage";
const PREFS_KEY = "predoc-prefs";

export interface WikiStorage {
  patches: [string, string][];
  lastServerTime?: [string, number][];
  frontmatter?: [string, Record<string, string | number | undefined>][];
  bodies?: [string, string][];
  baselines?: [string, string][];
}

export interface WikiPrefs {
  stickyToolbar: boolean;
}

export function loadPrefs(): WikiPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { stickyToolbar: true };
}

export function savePrefs(prefs: WikiPrefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export function loadStorage(): WikiStorage {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return {
        patches: data.patches || [],
        lastServerTime: data.lastServerTime || [],
        frontmatter: data.frontmatter || [],
        bodies: data.bodies || [],
        baselines: data.baselines || [],
      };
    }
  } catch {}
  return { patches: [] };
}

export function saveStorage(storage: WikiStorage) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
}

/** Clear all cached storage data from localStorage. Useful when switching to/from localStorage provider. */
export function clearStorage() {
  localStorage.removeItem(STORAGE_KEY);
}
