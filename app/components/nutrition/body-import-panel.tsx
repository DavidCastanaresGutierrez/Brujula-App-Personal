import { useState } from "react";
import {
  fmt,
  parseBodyImport,
  type BodyImport,
} from "../../../lib/domain/nutrition-analysis";

export function BodyImportPanel({
  busy,
  onImport,
  onClose,
}: {
  busy: boolean;
  onImport: (preview: BodyImport) => void;
  onClose: () => void;
}) {
  const [bodyImportText, setBodyImportText] = useState("");
  const [bodyImportPreview, setBodyImportPreview] = useState<BodyImport | null>(
    null,
  );
  const [bodyImportError, setBodyImportError] = useState("");
  return (
    <section
      className="panel nutrition-editor"
      aria-label="Importar composición corporal"
    >
      <h2>Importar mediciones corporales</h2>
      <p>
        Pega el JSON de Samsung Health o de una medición. Revísalo antes de
        guardarlo.
      </p>
      <textarea
        className="nutrition-json-input"
        aria-label="JSON de composición corporal"
        placeholder={
          '{\n  "schema_version": 1,\n  "measurements": [{ "recorded_at": "2026-09-22", "bmi": 26.1, "weight": 86.6, "height_cm": 182, "body_fat": 15.4, "fat_mass": 13.3, "imme": 9.2, "body_water": 53.6, "lean_mass": 73.3, "basal_metabolic_rate": 1952, "skeletal_muscle_mass": 42.1 }]\n}'
        }
        value={bodyImportText}
        onChange={(e) => {
          setBodyImportText(e.target.value);
          setBodyImportPreview(null);
          setBodyImportError("");
        }}
      />
      {bodyImportError && (
        <p className="nutrition-error" role="alert">
          {bodyImportError}
        </p>
      )}
      {bodyImportPreview && (
        <div className="nutrition-import-preview">
          <h3>
            {bodyImportPreview.measurements.length} medición
            {bodyImportPreview.measurements.length === 1 ? "" : "es"} lista
            {bodyImportPreview.measurements.length === 1 ? "" : "s"}
          </h3>
          {bodyImportPreview.measurements.map((measurement) => (
            <p key={measurement.recorded_at}>
              <b>{measurement.recorded_at}</b> · {fmt(measurement.weight)}{" "}
              kg · {fmt(measurement.body_fat)}% grasa ·{" "}
              {fmt(measurement.skeletal_muscle_mass ?? measurement.muscle)} kg
              {" "}músculo-esquelética
            </p>
          ))}
          <button
            disabled={busy}
            onClick={() => onImport(bodyImportPreview)}
          >
            Confirmar importación
          </button>
        </div>
      )}
      <div className="nutrition-actions">
        <button
          type="button"
          disabled={!bodyImportText.trim()}
          onClick={() => {
            try {
              setBodyImportPreview(parseBodyImport(bodyImportText));
              setBodyImportError("");
            } catch (cause) {
              setBodyImportPreview(null);
              setBodyImportError(
                cause instanceof Error
                  ? cause.message
                  : "No se ha podido leer el JSON.",
              );
            }
          }}
        >
          Previsualizar JSON
        </button>
        <button
          type="button"
          onClick={onClose}
        >
          Cancelar
        </button>
      </div>
    </section>
  );
}
