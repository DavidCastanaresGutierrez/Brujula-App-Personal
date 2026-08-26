"use client";

import type { Habit } from "../../lib/domain/tracker-state";
import { longestHabitStreak } from "../../lib/domain/tracking";
import { Ring } from "./charts";
import { motivationForToday, weeklyBarPalette } from "../config/tracker-defaults";

type RankingView = "best" | "watch" | "streak";

type WeeklyProgressItem = {
  range: string;
  value: number | null;
  projected: boolean;
};

type SummaryOverviewProps = {
  motivations: string[];
  monthName: string;
  year: number;
  onShiftMonth: (direction: number) => void;
  dayScoreTitle: string;
  dayScore: number;
  dayScoreDetail: string;
  dayProgress: number;
  weekScore: number;
  weekRange: string;
  weeklyGoalBonus: number;
  monthScore: number;
  totalChecks: number;
  totalGoal: number;
  topHabitName?: string;
  topHabitPercent: number;
  weeklyProgress: WeeklyProgressItem[];
  rankingView: RankingView;
  rankingItems: Habit[];
  longestVisibleStreak: number;
  habitCompletion: (habit: Habit) => number;
  onRankingViewChange: (view: RankingView) => void;
  formatScore: (score: number) => string;
};

export function SummaryOverview({
  motivations, monthName, year, onShiftMonth, dayScoreTitle, dayScore, dayScoreDetail, dayProgress,
  weekScore, weekRange, weeklyGoalBonus, monthScore, totalChecks, totalGoal, topHabitName,
  topHabitPercent, weeklyProgress, rankingView, rankingItems, longestVisibleStreak,
  habitCompletion, onRankingViewChange, formatScore,
}: SummaryOverviewProps) {
  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">TU PANEL DE CONSTANCIA</p>
          <h1>Pequeños pasos.<br /><em>Grandes cambios.</em></h1>
          <p className="hero-copy">Visualiza tu progreso, protege tus rachas y convierte cada día en una victoria medible.</p>
        </div>
        <div className="hero-aside">
          <blockquote className="panel-motivation"><span aria-hidden="true">✦</span><p>“{motivationForToday(motivations)}”</p></blockquote>
          <div className="month-control">
            <button onClick={() => onShiftMonth(-1)} aria-label="Mes anterior">‹</button>
            <div><span>PERIODO</span><strong>{monthName} {year}</strong></div>
            <button onClick={() => onShiftMonth(1)} aria-label="Mes siguiente">›</button>
          </div>
        </div>
      </section>

      <section className="metrics">
        <article className="metric primary">
          <div><span>{dayScoreTitle}</span><strong>{formatScore(dayScore)}<small> / 10</small></strong><p>{dayScoreDetail}</p></div>
          <Ring value={dayProgress} />
        </article>
        <article className="metric">
          <span>Nota semanal</span>
          <strong>{formatScore(weekScore)} <small>/ 10</small></strong>
          <p>{weekRange}{weeklyGoalBonus > 0 ? ` · +${formatScore(weeklyGoalBonus)} bonus` : ""}</p>
        </article>
        <article className="metric">
          <span>Nota del mes</span>
          <strong>{formatScore(monthScore)} <small>/ 10</small></strong>
          <p>{totalChecks} de {totalGoal} acciones completadas</p>
        </article>
        <article className="metric">
          <span>Hábito más sólido</span>
          <strong className="compact">{topHabitName ?? "—"}</strong>
          <p className="positive">{topHabitPercent}% completado</p>
        </article>
      </section>

      <section className="dashboard-grid" id="insights">
        <article className="panel overview">
          <div className="panel-head"><div><p className="eyebrow">RITMO DEL MES</p><h2>Evolución del mes por semanas</h2></div><span className="legend"><i /> Completado</span></div>
          <div className="bars">
            {weeklyProgress.map((week, index) => (
              <div className={`bar-column ${week.projected ? "projected" : ""}`} key={week.range}>
                <span>{week.value !== null ? `${week.value}%` : ""}</span>
                <div className="bar-track">{week.value !== null ? <div style={{ height: `${Math.max(week.value, 4)}%`, background: weeklyBarPalette[index] }} /> : null}</div>
                <strong><b>S{index + 1}</b><small>{week.range}</small></strong>
              </div>
            ))}
          </div>
        </article>

        <article className="panel ranking">
          <div className="panel-head ranking-head"><div><p className="eyebrow">CLASIFICACIÓN</p><h2>{rankingView === "best" ? "Hábitos destacados" : rankingView === "watch" ? "Hábitos a vigilar" : "Mejores rachas"}</h2></div><span className="trophy">{rankingView === "best" ? "✦" : rankingView === "watch" ? "!" : "🔥"}</span></div>
          <div className="tabs ranking-tabs" role="tablist" aria-label="Tipo de clasificación">
            <button role="tab" aria-selected={rankingView === "best"} className={rankingView === "best" ? "active" : ""} onClick={() => onRankingViewChange("best")}>Destacados</button>
            <button role="tab" aria-selected={rankingView === "watch"} className={rankingView === "watch" ? "active" : ""} onClick={() => onRankingViewChange("watch")}>A vigilar</button>
            <button role="tab" aria-selected={rankingView === "streak"} className={rankingView === "streak" ? "active" : ""} onClick={() => onRankingViewChange("streak")}>Mejor racha</button>
          </div>
          <div className="rank-list">
            {rankingItems.slice(0, 5).map((habit, index) => {
              const streak = longestHabitStreak(habit);
              const progress = rankingView === "streak"
                ? Math.round(streak / Math.max(longestVisibleStreak, 1) * 100)
                : Math.round(habitCompletion(habit) * 100);
              return (
                <div className="rank-row" key={habit.id}>
                  <b>{String(index + 1).padStart(2, "0")}</b>
                  <div><span>{habit.name}</span><div className="mini-track"><i style={{ width: `${progress}%`, background: habit.color }} /></div></div>
                  <strong>{rankingView === "streak" ? `${streak} ${streak === 1 ? "día" : "días"}` : `${progress}%`}</strong>
                </div>
              );
            })}
          </div>
        </article>
      </section>
    </>
  );
}
