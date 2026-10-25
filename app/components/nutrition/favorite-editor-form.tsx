import {
  mealTypes,
  units,
  type FrequentMeal,
  type Meal,
} from "../../../lib/domain/nutrition";
import { DetailFields, MacroFields } from "./fields";

export function FavoriteEditorForm({
  value,
  busy,
  onChange,
  onSubmit,
  onCancel,
}: {
  value: FrequentMeal;
  busy: boolean;
  onChange: (value: FrequentMeal) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <section
      className="panel nutrition-editor"
      aria-label="Editar comida frecuente"
    >
      <h2>Editar comida frecuente</h2>
      <p>
        Edita su ficha de referencia. Esto no cambia las comidas que ya has
        registrado.
      </p>
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
                onChange({
                  ...value,
                  name: e.target.value,
                })
              }
            />
          </label>
          <label>
            Tipo habitual
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
          <label>
            Unidad de referencia
            <select
              value={value.unit}
              onChange={(e) =>
                onChange({
                  ...value,
                  unit: e.target.value as Meal["unit"],
                })
              }
            >
              {Object.entries(units).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
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
          <div className="nutrition-actions">
            <button type="submit">Guardar favorito</button>
            <button type="button" onClick={onCancel}>
              Cancelar
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
