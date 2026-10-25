import { isLaunchView, parseLaunchIntent, type LaunchIntent, type LaunchView } from "../domain/launch-intent";

const LAST_VIEW_KEY = "brujula-last-view-v1";

let cachedIntent: LaunchIntent | null = null;

// Reads the shortcut parameters once and removes them from the address bar so a
// reload or a shared link does not replay the action. The result is cached for the
// page lifetime because React may run the mount effect twice in development.
export function readLaunchIntent(): LaunchIntent {
  if (cachedIntent) return cachedIntent;
  const intent = parseLaunchIntent(window.location.search);
  if (intent.view || intent.action) {
    window.history.replaceState(window.history.state, "", window.location.pathname);
  }
  cachedIntent = intent;
  return intent;
}

export function recallLastView(): LaunchView | null {
  try {
    const stored = localStorage.getItem(LAST_VIEW_KEY);
    return isLaunchView(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function rememberLastView(view: LaunchView) {
  try {
    localStorage.setItem(LAST_VIEW_KEY, view);
  } catch {
    // Private mode or full storage: the app simply opens on the default view next time.
  }
}
