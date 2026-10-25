import {
  mealTypes,
  totalNutrients,
  units,
  type FrequentMeal,
  type Meal,
} from "../../../lib/domain/nutrition";
import {
  macroText,
  quantityText,
} from "../../../lib/domain/nutrition-analysis";

export type FavoriteEntryDraft = {
  food: FrequentMeal;
  type: Meal["type"];
  quantity: number;
};

export function FavoriteEntryForm({
  value,
  busy,
  onChange,
  onSubmit,
  onCancel,
}: {
  value: FavoriteEntryDraft;
  busy: boolean;
  onChange: (value: FavoriteEntryDraft) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <section
      className="panel nutrition-editor"
      aria-label="Añadir comida frecuente"
    >
      <h2>Añadir {value.food.name}</h2>
      <p>
        Este favorito conserva sus valores por{" "}
        {units[value.food.unit]}. La cantidad de hoy se guarda solo
        en este registro.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <fieldset disabled={busy}>
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
          <label>
            Cantidad de hoy
            <input
              autoFocus
              required
              type="number"
              inputMode="decimal"
              min={0.01}
              max={100000}
              step="any"
              value={
                Number.isNaN(value.quantity)
                  ? ""
                  : value.quantity
              }
              onFocus={(e) => e.target.select()}
              onChange={(e) =>
                onChange({
                  ...value,
                  quantity:
                    e.target.value === "" ? NaN : Number(e.target.value),
                })
              }
            />
          </label>
          <p>
            <strong>
              Total:{" "}
              {macroText(
                totalNutrients({
                  ...value.food,
                  quantity: value.quantity,
                }),
              )}
            </strong>
          </p>
          <div className="nutrition-actions">
            <button type="submit">
              Añadir{" "}
              {quantityText({
                quantity: value.quantity,
                unit: value.food.unit,
              })}
            </button>
            <button type="button" onClick={onCancel}>
              Cancelar
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
