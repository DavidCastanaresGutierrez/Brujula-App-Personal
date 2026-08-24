import type { ReactNode } from "react";
import { SyncStatus, type SyncStatusValue } from "./sync-status";

type HabitTab = "daily" | "weekly";

type HabitsViewProps = {
  activeTab: HabitTab;
  archivedCount: number;
  syncStatus: SyncStatusValue;
  children: ReactNode;
  onTabChange: (tab: HabitTab) => void;
  onOpenMotivations: () => void;
  onOpenCategories: () => void;
  onOpenBackup: () => void;
  onOpenArchived: () => void;
  onAddHabit: () => void;
  onUseRemote: () => void;
  onKeepLocal: () => void;
};

export function HabitsView(props: HabitsViewProps) {
  return <>
    <section className="view-intro"><p className="eyebrow">SISTEMAS</p><h1>Hábitos</h1><p>Configura tus rutinas, registra el seguimiento y protege tu constancia.</p></section>
    <section className="tracker panel" id="tracker">
      <div className="tracker-head">
        <div><p className="eyebrow">REGISTRO INTERACTIVO</p><h2>Tu constancia, día a día</h2></div>
        <div className="tracker-actions">
          <button className="reset-button" onClick={props.onOpenMotivations}>Frases</button>
          <button className="reset-button blocks-button" onClick={props.onOpenCategories}>Gestionar bloques</button>
          <button className="reset-button blocks-button" onClick={props.onOpenBackup}>Copia de datos</button>
          <button className="reset-button archived-button" onClick={props.onOpenArchived}>Archivados{props.archivedCount > 0 && <span>{props.archivedCount}</span>}</button>
          <div className="tabs"><button className={props.activeTab === "daily" ? "active" : ""} onClick={() => props.onTabChange("daily")}>Diarios</button><button className={props.activeTab === "weekly" ? "active" : ""} onClick={() => props.onTabChange("weekly")}>Semanales</button></div>
          <button className="add-button" onClick={props.onAddHabit}>+ Añadir hábito</button>
        </div>
      </div>
      {props.children}
      <SyncStatus status={props.syncStatus} onUseRemote={props.onUseRemote} onKeepLocal={props.onKeepLocal} />
    </section>
  </>;
}
