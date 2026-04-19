const STORAGE_KEY = 'stairmaster-state';

/**
 * Load persisted state, merging with defaults.
 */
export function loadState(defaults) {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Deep merge: for nested objects (aoParams, materialAssignments, etc.)
      const result = { ...defaults };
      for (const [key, val] of Object.entries(parsed)) {
        if (val !== null && typeof val === 'object' && !Array.isArray(val) &&
            result[key] && typeof result[key] === 'object') {
          result[key] = { ...result[key], ...val };
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

const CAMERA_KEY = 'stairmaster-camera';

export function loadCamera() {
  try {
    const saved = localStorage.getItem(CAMERA_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
}

export function saveCamera(data) {
  try {
    localStorage.setItem(CAMERA_KEY, JSON.stringify(data));
  } catch {}
}
