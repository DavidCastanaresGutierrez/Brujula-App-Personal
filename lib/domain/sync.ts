export type RemoteRevisionAction = "ignore" | "apply" | "conflict";

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
