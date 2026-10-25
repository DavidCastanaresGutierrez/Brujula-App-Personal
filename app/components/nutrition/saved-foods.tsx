import { useState } from "react";
import {
  mealTypes,
  units,
  type FrequentMeal,
  type Meal,
} from "../../../lib/domain/nutrition";
import {
  fmt,
  matchesMealSearch,
} from "../../../lib/domain/nutrition-analysis";

export function SavedFoods({
  frequent,
  busy,
  onEdit,
  onRemove,
  onAdd,
}: {
  frequent: FrequentMeal[];
  busy: boolean;
  onEdit: (food: FrequentMeal) => void;
  onRemove: (food: FrequentMeal) => void;
  onAdd: (food: FrequentMeal) => void;
}) {
  const [frequentSearch, setFrequentSearch] = useState("");
  const [frequentType, setFrequentType] = useState<Meal["type"] | "all">("all");
  const [selectedFrequentId, setSelectedFrequentId] = useState<string | null>(
    null,
  );
    const visibleFrequent = frequent.filter(
      (meal) =>
        matchesMealSearch(meal.name, frequentSearch) &&
        (frequentType === "all" || meal.type === frequentType),
    );
    const selectedFrequent =
      frequent.find((meal) => meal.id === selectedFrequentId) ?? null;
  return (
    <article className="panel nutrition-saved-foods">
      <div className="panel-head">
        <div>
          <p className="eyebrow">ALIMENTOS GUARDADOS</p>
          <h2>Buscar y añadir</h2>
        </div>
      </div>
      <label className="nutrition-search">
        <span className="sr-only">Buscar alimento guardado</span>
        <input
          type="search"
          placeholder="Buscar: café, pollo, batido…"
          value={frequentSearch}
          onChange={(e) => setFrequentSearch(e.target.value)}
        />
      </label>
      <div
        className="nutrition-saved-food-tabs"
        role="tablist"
        aria-label="Filtrar alimentos guardados"
      >
        <button
          role="tab"
          aria-selected={frequentType === "all"}
          className={frequentType === "all" ? "active" : ""}
          onClick={() => setFrequentType("all")}
        >
          Todos
        </button>
        {(Object.entries(mealTypes) as [Meal["type"], string][]).map(
          ([type, label]) => (
            <button
              key={type}
              role="tab"
              aria-selected={frequentType === type}
              className={frequentType === type ? "active" : ""}
              onClick={() => setFrequentType(type)}
            >
              {label}
            </button>
          ),
        )}
      </div>
      {visibleFrequent.length > 0 && (
        <div className="nutrition-saved-food-list" role="list">
          {visibleFrequent.map((meal) => (
            <div
              className={`nutrition-saved-food${selectedFrequentId === meal.id ? " selected" : ""}`}
              key={meal.id}
              role="listitem"
            >
              <button
                className="nutrition-saved-food-select"
                aria-pressed={selectedFrequentId === meal.id}
                onClick={() =>
                  setSelectedFrequentId((current) =>
                    current === meal.id ? null : meal.id,
                  )
                }
              >
                <span
                  className="nutrition-saved-food-radio"
                  aria-hidden="true"
                />
                <span>
                  <b>{meal.name}</b>
                  <small>
                    {fmt(meal.calories)} kcal · 1 {units[meal.unit]} · P{" "}
                    {fmt(meal.protein)} g
                  </small>
                </span>
              </button>
              <div className="nutrition-saved-food-actions">
                <button
                  disabled={busy}
                  onClick={() => onEdit(meal)}
                >
                  Editar
                </button>
                <button
                  disabled={busy}
                  aria-label={`Quitar ${meal.name} de frecuentes`}
                  onClick={() => onRemove(meal)}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {!frequent.length && (
        <p>
          Aún no hay alimentos guardados. Guarda una comida del día como
          frecuente para tenerla aquí.
        </p>
      )}
      {frequent.length > 0 && !visibleFrequent.length && (
        <p>No hay alimentos guardados que coincidan con esta búsqueda.</p>
      )}
      {selectedFrequent && (
        <div className="nutrition-saved-food-confirm">
          <span>
            <b>{selectedFrequent.name}</b>
            <small>Seleccionado para añadir al día</small>
          </span>
          <button
            className="add-button"
            disabled={busy}
            onClick={() => onAdd(selectedFrequent)}
          >
            Añadir alimento
          </button>
        </div>
      )}
    </article>
  );
}
