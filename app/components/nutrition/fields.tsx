import {
  detailMetricKeys,
  detailMetrics,
  metricKeys,
  metrics,
  units,
  type Macros,
  type Meal,
  type NutritionDetails,
} from "../../../lib/domain/nutrition";

export function MacroFields({
  value,
  onChange,
  positive = false,
}: {
  value: Macros;
  onChange: (value: Macros) => void;
  positive?: boolean;
}) {
  return (
    <div className="nutrition-grid">
      {metricKeys.map((key) => (
        <label key={key}>
          {metrics[key]} ({key === "calories" ? "kcal" : "g"})
          <input
            required
            type="number"
            inputMode="decimal"
            min={positive ? 0.01 : 0}
            max={100000}
            step="any"
            value={Number.isNaN(value[key]) ? "" : value[key]}
            onFocus={(e) => e.target.select()}
            onChange={(e) =>
              onChange({
                ...value,
                [key]: e.target.value === "" ? NaN : Number(e.target.value),
              })
            }
          />
        </label>
      ))}
    </div>
  );
}
export function DetailFields({
  value,
  onChange,
}: {
  value: NutritionDetails;
  onChange: (value: NutritionDetails) => void;
}) {
  return (
    <div className="nutrition-grid">
      {detailMetricKeys.map((key) => (
        <label key={key}>
          {detailMetrics[key]} (g)
          <input
            required
            type="number"
            inputMode="decimal"
            min={0}
            max={100000}
            step="any"
            value={Number.isNaN(value[key]) ? "" : value[key]}
            onFocus={(e) => e.target.select()}
            onChange={(e) =>
              onChange({
                ...value,
                [key]: e.target.value === "" ? NaN : Number(e.target.value),
              })
            }
          />
        </label>
      ))}
    </div>
  );
}
export function QuantityFields({
  value,
  onChange,
}: {
  value: Pick<Meal, "quantity" | "unit">;
  onChange: (value: Pick<Meal, "quantity" | "unit">) => void;
}) {
  return (
    <div className="nutrition-quantity">
      <label>
        Cantidad
        <input
          required
          type="number"
          inputMode="decimal"
          min={0.01}
          max={100000}
          step="any"
          value={Number.isNaN(value.quantity) ? "" : value.quantity}
          onFocus={(e) => e.target.select()}
          onChange={(e) =>
            onChange({
              ...value,
              quantity: e.target.value === "" ? NaN : Number(e.target.value),
            })
          }
        />
      </label>
      <label>
        Unidad
        <select
          value={value.unit}
          onChange={(e) =>
            onChange({ ...value, unit: e.target.value as Meal["unit"] })
          }
        >
          {Object.entries(units).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
