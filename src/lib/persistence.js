const STORAGE_KEY = 'stairmaster-state';

/**
 * Load persisted state, merging with defaults.
 */
export function loadState(defaults) {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const result = { ...defaults };
      for (const [key, val] of Object.entries(parsed)) {
        if (val !== null && typeof val === 'object' && !Array.isArray(val) &&
            result[key] && typeof result[key] === 'object') {
          // Two-level deep merge: merge each sub-key with its default
          const merged = { ...result[key] };
          for (const [subKey, subVal] of Object.entries(val)) {
            if (subVal !== null && typeof subVal === 'object' && !Array.isArray(subVal) &&
                merged[subKey] && typeof merged[subKey] === 'object') {
              merged[subKey] = { ...merged[subKey], ...subVal };
            } else {
              merged[subKey] = subVal;
            }
          }
          result[key] = merged;
        } else {
          result[key] = val;
        }
      }
      return result;
    }
  } catch {}
  return { ...defaults };
}

/**
 * Save state to localStorage.
 */
export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

const CAMERA_KEY = 'stairmaster-cameras';

/**
 * Load saved camera for a specific view mode.
 */
export function loadCamera(viewMode) {
  try {
    const saved = localStorage.getItem(CAMERA_KEY);
    if (saved) {
      const all = JSON.parse(saved);
      return all[viewMode] || null;
    }
  } catch {}
  return null;
}

/**
 * Save camera for a specific view mode.
 */
export function saveCamera(viewMode, data) {
  try {
    const saved = localStorage.getItem(CAMERA_KEY);
    const all = saved ? JSON.parse(saved) : {};
    all[viewMode] = data;
    localStorage.setItem(CAMERA_KEY, JSON.stringify(all));
  } catch {}
}
