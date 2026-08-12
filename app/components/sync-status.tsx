export type SyncStatusValue = "loading" | "saving" | "synced" | "offline" | "error" | "conflict";

type Props = {
  status: SyncStatusValue;
  onUseRemote: () => void;
  onKeepLocal: () => void;
};

const messages: Record<Exclude<SyncStatusValue, "conflict">, string> = {
  loading: "Cargando tus datos…",
  saving: "Guardando cambios…",
  synced: "Sincronizado en todos tus dispositivos.",
  offline: "Sin conexión: los cambios quedan guardados temporalmente en este dispositivo.",
  error: "Error de sincronización: tus cambios siguen guardados en este dispositivo y se reintentará automáticamente.",
};

export function SyncStatus({ status, onUseRemote, onKeepLocal }: Props) {
  return <div className={`save-note ${status}`} role={status === "error" || status === "conflict" ? "alert" : "status"} aria-live="polite">
    <span aria-hidden="true">●</span>
    {status === "conflict" ? <>
      <span>Hay cambios en este dispositivo y en otro. Elige qué versión conservar.</span>
      <div className="sync-conflict-actions">
        <button type="button" onClick={onUseRemote}>Usar cambios del otro dispositivo</button>
        <button type="button" onClick={onKeepLocal}>Conservar los de este dispositivo</button>
      </div>
    </> : <span>{messages[status]}</span>}
  </div>;
}
