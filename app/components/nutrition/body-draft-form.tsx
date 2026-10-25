import {
  type BodyDraft,
} from "../../../lib/domain/nutrition-analysis";

export function BodyDraftForm({
  value,
  busy,
  onChange,
  onSubmit,
  onCancel,
}: {
  value: BodyDraft;
  busy: boolean;
  onChange: (value: BodyDraft) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <section
      className="panel nutrition-editor"
      aria-label="Composición corporal"
    >
      <h2>Registrar composición corporal</h2>
      <p>
        Al guardarla, Brújula te propondrá calorías y macros para perder
        grasa preservando masa muscular. Podrás modificarlos antes de
        confirmar.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <fieldset disabled={busy}>
          <label>
            Fecha
            <input
              type="date"
              value={value.recorded_at}
              onChange={(e) =>
                onChange({ ...value, recorded_at: e.target.value })
              }
            />
          </label>
          <div className="nutrition-grid">
            {(
              [
                ["bmi", "IMC (kg/m²)"],
                ["weight", "Peso (kg)"],
                ["height_cm", "Altura (cm)"],
                ["body_fat", "Porcentaje de grasa corporal (%)"],
                ["fat_mass", "Masa grasa corporal (kg)"],
                ["imme", "IMME (kg/m²)"],
                ["body_water", "Agua total en el cuerpo (L)"],
                ["lean_mass", "Masa libre de grasa (kg)"],
                ["basal_metabolic_rate", "Metabolismo basal (kcal)"],
                ["skeletal_muscle_mass", "Masa músculo-esquelética (kg)"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  required={
                    key === "weight" ||
                    key === "body_fat" ||
                    key === "skeletal_muscle_mass"
                  }
                  type="number"
                  min="0"
                  step="any"
                  value={value[key] ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      [key]:
                        e.target.value === ""
                          ? null
                          : Number(e.target.value),
                    })
                  }
                />
              </label>
            ))}
          </div>
          <div className="nutrition-actions">
            <button type="submit">Guardar y calcular objetivos</button>
            <button type="button" onClick={onCancel}>
              Cancelar
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
