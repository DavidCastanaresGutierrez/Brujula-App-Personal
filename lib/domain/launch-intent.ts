export const mainViews = ["summary", "today", "week", "habits", "goals", "nutrition"] as const;
export type LaunchView = (typeof mainViews)[number];
export type LaunchAction = "photo";
export type LaunchIntent = { view: LaunchView | null; action: LaunchAction | null };

// Home-screen shortcuts and shared links open the app on a view: /?view=today or
// /?view=nutrition&action=photo. Anything unknown is ignored.
export function parseLaunchIntent(search: string): LaunchIntent {
  const params = new URLSearchParams(search);
  const view = params.get("view");
  const action = params.get("action");
  return {
    view: (mainViews as readonly string[]).includes(view ?? "") ? (view as LaunchView) : null,
    action: action === "photo" ? "photo" : null,
  };
}

export function isLaunchView(value: unknown): value is LaunchView {
  return typeof value === "string" && (mainViews as readonly string[]).includes(value);
}
