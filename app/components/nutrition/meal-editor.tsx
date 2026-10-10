import {
  mealTypes,
  totalNutrients,
  units,
  type Meal,
} from "../../../lib/domain/nutrition";
import {
  macroText,
  detailText,
} from "../../../lib/domain/nutrition-analysis";
import { DetailFields, MacroFields, QuantityFields } from "./fields";

export function MealEditor({
  value,
  editing,
  busy,
  onChange,
  onSubmit,
  onCancel,
}: {
  value: Meal;
  editing: boolean;
  busy: boolean;
  onChange: (value: Meal) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <section
      className="panel nutrition-value"
      aria-label="Formulario de comida"
    >
      <h2>{editing ? "Editar comida" : "Añadir comida"}</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <fieldset disabled={busy}>
          <label>
            Nombre de la comida
            <input
              autoFocus
              required
              maxLength={200}
              value={value.name}
              onChange={(e) =>
                onChange({ ...value, name: e.target.value })
              }
            />
          </label>
          <label>
            Tipo de comida
            <select
              value={value.type}
              onChange={(e) =>
                onChange({
                  ...value,
                  type: e.target.value as Meal["type"],
                })
              }
            >
              {Object.entries(mealTypes).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <QuantityFields
            value={value}
            onChange={(fields) => onChange({ ...value, ...fields })}
          />
          <h3>Valores por {units[value.unit]}</h3>
          <MacroFields
            value={value}
            onChange={(fields) => onChange({ ...value, ...fields })}
          />
          <details className="nutrition-optional-fields">
            <summary>Información nutricional adicional</summary>
            <DetailFields
              value={value}
              onChange={(fields) => onChange({ ...value, ...fields })}
            />
          </details>
          <p>
            <strong>Total: {macroText(totalNutrients(value))}</strong>
          </p>
          {detailText(totalNutrients(value)) && (
            <p>{detailText(totalNutrients(value))}</p>
          )}
          <div className="nutrition-actions">
            <button type="submit">Guardar comida</button>
            <button type="button" onClick={onCancel}>
              Cancelar
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
