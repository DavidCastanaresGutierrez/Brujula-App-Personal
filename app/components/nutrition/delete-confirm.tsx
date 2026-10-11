import {
  type Entry,
} from "../../../lib/domain/nutrition";

export function DeleteConfirm({
  entry,
  busy,
  onConfirm,
  onCancel,
}: {
  entry: Entry;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <section className="panel nutrition-editor">
      <h2>¿Eliminar {entry.name}?</h2>
      <div className="nutrition-actions">
        <button
          disabled={busy}
          onClick={onConfirm}
        >
          Confirmar eliminación
        </button>
        <button disabled={busy} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </section>
  );
}
