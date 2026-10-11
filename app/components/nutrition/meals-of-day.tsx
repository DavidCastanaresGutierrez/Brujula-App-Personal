import { useState } from "react";
import {
  mealTypes,
  totalNutrients,
  type Entry,
  type FrequentMeal,
  type Meal,
} from "../../../lib/domain/nutrition";
import {
  macroText,
  detailText,
  quantityText,
  normalizedMealName,
} from "../../../lib/domain/nutrition-analysis";

export function MealsOfDay({
  groups,
  frequent,
  busy,
  onAdd,
  onEdit,
  onSaveFrequent,
  onDelete,
}: {
  groups: { type: Meal["type"]; entries: Entry[] }[];
  frequent: FrequentMeal[];
  busy: boolean;
  onAdd: () => void;
  onEdit: (entry: Entry) => void;
  onSaveFrequent: (entry: Entry) => void;
  onDelete: (entry: Entry) => void;
}) {
  const [collapsedMealTypes, setCollapsedMealTypes] = useState<
    Partial<Record<Meal["type"], boolean>>
  >({});
  return (
    <article className="panel">
      <div className="panel-head">
        <h2>Comidas del día</h2>
        <button disabled={busy} onClick={onAdd}>
          + Añadir comida
        </button>
      </div>
      {!groups.length && (
        <p>Añade una comida o importa tus estimaciones desde ChatGPT.</p>
      )}
      {groups.map((group) => {
        const isCollapsed = Boolean(collapsedMealTypes[group.type]);
        const contentId = `nutrition-meal-group-${group.type}`;
        return (
          <section
            className={`nutrition-meal-group${isCollapsed ? " is-collapsed" : ""}`}
            key={group.type}
          >
            <h3>
              <button
                type="button"
                className="nutrition-meal-group-toggle"
                aria-expanded={!isCollapsed}
                aria-controls={contentId}
                onClick={() =>
                  setCollapsedMealTypes((current) => ({
                    ...current,
                    [group.type]: !current[group.type],
                  }))
                }
              >
                <span>{mealTypes[group.type]}</span>
                <small>
                  {group.entries.length}{" "}
                  {group.entries.length === 1 ? "comida" : "comidas"}
                </small>
                <span
                  className="nutrition-meal-group-chevron"
                  aria-hidden="true"
                >
                  ⌄
                </span>
              </button>
            </h3>
            <div id={contentId} hidden={isCollapsed}>
              {group.entries.map((entry) => {
                const savedAsFrequent = frequent.some(
                  (meal) =>
                    normalizedMealName(meal.name) ===
                    normalizedMealName(entry.name),
                );
                const entryTotal = totalNutrients(entry);
                return (
                  <div className="nutrition-meal" key={entry.id}>
                    <div>
                      <small>{quantityText(entry)}</small>
                      <h4>
                        {entry.name}
                        {savedAsFrequent && (
                          <span
                            className="nutrition-frequent-badge"
                            title="Guardada en comidas frecuentes"
                            aria-label="Guardada en comidas frecuentes"
                          >
                            ★ Frecuente
                          </span>
                        )}
                      </h4>
                      <p>{macroText(entryTotal)}</p>
                      {detailText(entryTotal) && (
                        <p className="nutrition-details-line">
                          {detailText(entryTotal)}
                        </p>
                      )}
                    </div>
                    <div className="nutrition-actions">
                      <button
                        disabled={busy}
                        onClick={() => onEdit(entry)}
                      >
                        Editar
                      </button>
                      <button
                        disabled={busy || savedAsFrequent}
                        title={
                          savedAsFrequent
                            ? "Esta comida ya está guardada en frecuentes."
                            : undefined
                        }
                        onClick={() => onSaveFrequent(entry)}
                      >
                        {savedAsFrequent
                          ? "Ya está en frecuentes"
                          : "Guardar como frecuente"}
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => onDelete(entry)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </article>
  );
}
