import {
} from "../../../lib/domain/nutrition";
import {
  type NutritionGoals,
} from "../../../lib/domain/nutrition-analysis";
import { DetailFields, MacroFields } from "./fields";

export function GoalsForm({
  value,
  busy,
  onChange,
  onSubmit,
  onCancel,
}: {
  value: NutritionGoals;
  busy: boolean;
  onChange: (value: NutritionGoals) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <section
      className="panel nutrition-editor"
      aria-label="Objetivos nutricionales"
    >
      <h2>Objetivos diarios</h2>
      <p>
        Se generan a partir de tu última composición corporal y son
        editables. Las referencias de micronutrientes no sustituyen consejo
        médico individual.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <fieldset disabled={busy}>
          <h3>Macros</h3>
          <MacroFields
            value={value}
            onChange={(fields) => onChange({ ...value, ...fields })}
            positive
          />
          <h3>Micronutrientes y límites</h3>
          <DetailFields
            value={value}
            onChange={(fields) => onChange({ ...value, ...fields })}
          />
          <div className="nutrition-actions">
            <button type="submit">Guardar objetivos</button>
            <button type="button" onClick={onCancel}>
              Cancelar
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
