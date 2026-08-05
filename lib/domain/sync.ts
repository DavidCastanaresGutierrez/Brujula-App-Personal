export type RemoteRevisionAction = "ignore" | "apply" | "conflict";

export function belongsToActiveUser(expectedUserId: string, activeUserId?: string | null) {
  return Boolean(expectedUserId && activeUserId === expectedUserId);
}

export function shouldRetryPendingSave(
  pendingSave: boolean,
  hasUnsavedChanges: boolean,
  hasConflict: boolean,
) {
  return pendingSave && hasUnsavedChanges && !hasConflict;
}

export function decideRemoteRevision(
  currentRevision: number,
  remoteRevision: number,
  hasLocalChanges: boolean,
): RemoteRevisionAction {
  if (!Number.isSafeInteger(remoteRevision) || remoteRevision <= currentRevision) return "ignore";
  return hasLocalChanges ? "conflict" : "apply";
}
