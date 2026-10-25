import {
  mealTypes,
  type Meal,
} from "../../../lib/domain/nutrition";
import {
  fmt,
} from "../../../lib/domain/nutrition-analysis";

export function PhotoPanel({
  busy,
  file,
  mealType,
  onFileChange,
  onMealTypeChange,
  onAnalyze,
  onCancel,
}: {
  busy: boolean;
  file: File | null;
  mealType: Meal["type"];
  onFileChange: (file: File | null) => void;
  onMealTypeChange: (type: Meal["type"]) => void;
  onAnalyze: () => void;
  onCancel: () => void;
}) {
  return (
    <section
      className="panel nutrition-editor nutrition-photo"
      aria-label="Analizar foto de comida"
    >
      <h2>Analizar foto de comida</h2>
      <p>
        Haz una foto o selecciona una imagen. La estimación se revisa antes
        de añadirla al día.
      </p>
      <label className="nutrition-file-picker">
        Foto de comida
        <input
          className="nutrition-file-input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          disabled={busy}
          onChange={(e) => onFileChange(e.currentTarget.files?.[0] ?? null)}
        />
      </label>
      <label>
        Tipo de comida
        <select
          value={mealType}
          disabled={busy}
          onChange={(e) => onMealTypeChange(e.currentTarget.value as Meal["type"])}
        >
          {Object.entries(mealTypes).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>
      {file && (
        <p className="nutrition-file-status">
          {file.name || "Foto seleccionada"} · {fmt(file.size / 1024 / 1024)} MB
        </p>
      )}
      <p className="nutrition-photo-note">
        La foto se reduce en tu dispositivo, se envía solo para el análisis
        y no se guarda en Brújula. Revisa siempre cantidades e ingredientes
        antes de confirmar.
      </p>
      <div className="nutrition-actions">
        <button
          type="button"
          disabled={busy || !file}
          onClick={onAnalyze}
        >
          {busy ? "Analizando…" : "Analizar foto"}
        </button>
        <button type="button" disabled={busy} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </section>
  );
}
