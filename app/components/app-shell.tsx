import Link from "next/link";
import { Brand } from "./auth";

export type MainView = "summary" | "today" | "week" | "habits" | "goals";

export type ClosureNotice = {
  key: string;
  kind: "daily" | "weekly" | "monthly" | "yearly";
  eyebrow: string;
  title: string;
  detail: string;
  baseScore: number;
  bonus: number;
  finalScore: number;
};

type ClosureNoticeCardProps = {
  notice: ClosureNotice;
  formatScore: (score: number) => string;
  onDismiss: () => void;
};

export function ClosureNoticeCard({ notice, formatScore, onDismiss }: ClosureNoticeCardProps) {
  return <aside className="closure-notice" role="status" aria-live="polite">
    <div className="closure-notice-head">
      <div><p className="eyebrow">{notice.eyebrow}</p><h2>{notice.title}</h2></div>
      <button onClick={onDismiss} aria-label="Cerrar resumen">×</button>
    </div>
    <p>{notice.detail}</p>
    <div className="closure-score">
      <span><small>Nota base</small><strong>{formatScore(notice.baseScore)}</strong></span>
      <b>+</b>
      <span className="bonus"><small>Bonus</small><strong>{notice.bonus > 0 ? `+${formatScore(notice.bonus)}` : "—"}</strong></span>
      <b>=</b>
      <span className="final"><small>Nota final</small><strong>{formatScore(notice.finalScore)}</strong></span>
    </div>
    <button className="closure-confirm" onClick={onDismiss}>Entendido</button>
  </aside>;
}

type AppHeaderProps = {
  activeView: MainView;
  userEmail?: string;
  onNavigate: (view: MainView) => void;
  onSignOut: () => void;
};

const navigation: { view: MainView; label: string }[] = [
  { view: "summary", label: "Resumen" },
  { view: "today", label: "Tu día" },
  { view: "week", label: "Semana" },
  { view: "habits", label: "Hábitos" },
  { view: "goals", label: "Objetivos" },
];

export function AppHeader({ activeView, userEmail, onNavigate, onSignOut }: AppHeaderProps) {
  return <header className="topbar">
    <Brand />
    <nav aria-label="Navegación principal">
      {navigation.map((item) => (
        <button key={item.view} className={activeView === item.view ? "nav-active" : ""} onClick={() => onNavigate(item.view)}>
          {item.label}
        </button>
      ))}
    </nav>
    <div className="session-actions">
      <Link className="watch-header-link" href="/watch-connect" aria-label="Gestionar Galaxy Watch" title="Gestionar Galaxy Watch">
        <span aria-hidden="true">⌚</span><b>Reloj</b>
      </Link>
      <span className="avatar" aria-hidden="true">{(userEmail?.slice(0, 2) ?? "BR").toUpperCase()}</span>
      <button className="logout-button" onClick={onSignOut}>Cerrar sesión</button>
    </div>
  </header>;
}
