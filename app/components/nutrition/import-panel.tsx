import {
  mealTypes,
  sumMacros,
  totalNutrients,
  type NutritionImport,
} from "../../../lib/domain/nutrition";
import {
  macroText,
  detailText,
  quantityText,
} from "../../../lib/domain/nutrition-analysis";

export function ImportPanel({
  busy,
  reading,
  fileName,
  text,
  error,
  preview,
  onFile,
  onTextChange,
  onPreview,
  onCancel,
  onConfirm,
}: {
  busy: boolean;
  reading: boolean;
  fileName: string;
  text: string;
  error: string;
  preview: NutritionImport | null;
  onFile: (file: File | undefined) => void;
  onTextChange: (text: string) => void;
  onPreview: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <section
      className="panel nutrition-editor"
      aria-label="Importación desde ChatGPT"
    >
      <h2>Añadir JSON de ChatGPT</h2>
      <p>
        Selecciona un archivo o pega el JSON directamente. Revisarás las
        comidas antes de guardarlas.
      </p>
      <label className="nutrition-file-picker">
        Archivo JSON
        <input
          aria-label="Seleccionar JSON de ChatGPT"
          className="nutrition-file-input"
          type="file"
          accept="application/json,.json"
          disabled={busy || reading}
          onChange={(e) => onFile(e.currentTarget.files?.[0])}
        />
      </label>
      {reading && (
        <p className="nutrition-file-status" role="status">
          Leyendo {fileName}…
        </p>
      )}
      <div className="nutrition-import-divider">
        <span>o pega el contenido</span>
      </div>
      <label>
        JSON
        <textarea
          className="nutrition-json-input"
          aria-label="Pegar JSON de ChatGPT"
          placeholder={
            '{\n  "schema_version": 1,\n  "date": "2026-09-16",\n  "meals": […]\n}'
          }
          rows={9}
          maxLength={100000}
          spellCheck={false}
          value={text}
          disabled={busy || reading}
          onChange={(e) => onTextChange(e.target.value)}
        />
      </label>
      <div className="nutrition-actions">
        <button
          type="button"
          disabled={busy || reading || !text.trim()}
          onClick={onPreview}
        >
          Previsualizar JSON
        </button>
        <button
          type="button"
          disabled={busy || reading}
          onClick={onCancel}
        >
          Cancelar
        </button>
      </div>
      {error && (
        <p className="nutrition-error" role="alert">
          {error}
        </p>
      )}
      <details>
        <summary>¿Cómo consigo el JSON?</summary>
        <p>
          Copia el bloque completo que te dé ChatGPT y pégalo arriba.
          También puedes descargarlo y seleccionar el archivo.
        </p>
      </details>
      {preview && (
        <div className="nutrition-import-preview">
          <h3>
            JSON listo · {preview.date} · {preview.meals.length} comidas
          </h3>
          <p className="nutrition-file-status">{fileName}</p>
          {preview.meals.map((meal, i) => {
            const mealTotal = totalNutrients(meal);
            return (
              <p key={i}>
                <b>
                  {mealTypes[meal.type]}: {meal.name} · {quantityText(meal)}
                </b>
                <br />
                {macroText(mealTotal)}
                {detailText(mealTotal) && (
                  <>
                    <br />
                    {detailText(mealTotal)}
                  </>
                )}
              </p>
            );
          })}
          <p>
            <strong>Total: {macroText(sumMacros(preview.meals))}</strong>
          </p>
          <p>
            Se añadirán a las comidas existentes de esa fecha. Un JSON
            idéntico no se importa dos veces.
          </p>
          <button disabled={busy} onClick={onConfirm}>
            Confirmar importación
          </button>
        </div>
      )}
    </section>
  );
}
