"use client";

import { useState } from "react";
import Image from "next/image";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

export function Brand({ lightBackground = false }: { lightBackground?: boolean }) {
  return <div className="brand"><Image className="brand-logo" src={lightBackground ? "/compass-mark-light.png" : "/compass-mark-dark.png"} width={68} height={68} alt="" priority /><span>Brújula</span></div>;
}

function AuthIcon({ name }: { name: "mail" | "lock" | "eye" | "eyeOff" | "shield" | "compass" }) {
  if (name === "mail") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5h17v11h-17z"/><path d="m4 7 8 6 8-6"/></svg>;
  if (name === "lock") return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></svg>;
  if (name === "eye") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>;
  if (name === "eyeOff") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-2.4 3.1M6.1 6.2C3.7 8 2.5 12 2.5 12s3.5 6 9.5 6a9.7 9.7 0 0 0 3-.5M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>;
  if (name === "shield") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.8 2.9 8.2 7 10 4.1-1.8 7-5.2 7-10V6l-7-3Z"/><path d="m9.5 12 1.7 1.7 3.5-3.7"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m15.8 8.2-2.3 5.3-5.3 2.3 2.3-5.3 5.3-2.3Z"/></svg>;
}

export function AuthGate() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (error) throw error;
        setMessage("Te hemos enviado un enlace para restablecer la contraseña. Revisa también la carpeta de spam.");
        return;
      }
      const result = await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo completar el acceso.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page"><div className="auth-shell"><section className="auth-card"><div className="auth-content">
      <div className="auth-brand" aria-label="Brújula, tu rumbo personal"><Image className="auth-logo" src="/compass-mark-light.png" width={92} height={92} alt="" priority /><strong>Brújula</strong><span>TU RUMBO PERSONAL</span></div>
      <div className="auth-intro"><h1>{mode === "login" ? "Construye la persona que quieres llegar a ser." : "Recupera el acceso a tu rumbo."}</h1><p>{mode === "forgot" ? "Escribe tu correo y recibirás un enlace seguro para crear una contraseña nueva." : "Cada pequeño hábito cambia tu dirección."}</p></div>
      <form onSubmit={submit}>
        <label htmlFor="auth-email">Correo</label><div className="auth-field"><span className="auth-field-icon"><AuthIcon name="mail" /></span><input id="auth-email" type="email" placeholder="tu@email.com" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></div>
        {mode !== "forgot" && <><label htmlFor="auth-password">Contraseña</label><div className="auth-field password-field"><span className="auth-field-icon"><AuthIcon name="lock" /></span><input id="auth-password" type={showPassword ? "text" : "password"} placeholder="Mínimo 8 caracteres" minLength={8} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-pressed={showPassword} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}><AuthIcon name={showPassword ? "eyeOff" : "eye"} /></button></div></>}
        {message && <p className="auth-message" role="status">{message}</p>}
        <button className="auth-submit" disabled={busy}>{busy ? <><span className="auth-spinner" aria-hidden="true" />Procesando…</> : <>{mode === "login" ? "Entrar" : "Enviar enlace"}<span aria-hidden="true">→</span></>}</button>
      </form>
      <p className="auth-trust"><AuthIcon name="shield" /> Acceso privado · Seguro · Sincronizado</p><div className="auth-links">{mode === "login" ? <button className="auth-switch" onClick={() => { setMode("forgot"); setMessage(""); }}>¿Has olvidado tu contraseña?</button> : <button className="auth-switch secondary" onClick={() => { setMode("login"); setMessage(""); setShowPassword(false); }}>Volver al inicio de sesión</button>}</div>
    </div></section><aside className="auth-visual" aria-hidden="true"><div className="auth-visual-message"><span className="auth-visual-icon"><AuthIcon name="compass" /></span><blockquote>“No se trata de llegar más rápido, sino de avanzar en la dirección correcta.”</blockquote></div></aside></div></main>
  );
}

export function ResetPassword({ onComplete }: { onComplete: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    if (password !== confirmation) return setMessage("Las contraseñas no coinciden.");
    setBusy(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await supabase.auth.signOut();
      onComplete();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar la contraseña.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-page"><section className="auth-card"><div className="auth-brand"><Brand lightBackground /></div><p className="eyebrow">NUEVA CONTRASEÑA</p><h1>Recupera tu rumbo.</h1><p>Elige una contraseña nueva de al menos 8 caracteres.</p><form onSubmit={submit}><label>Nueva contraseña<span className="password-field"><input type={showPassword ? "text" : "password"} minLength={8} autoComplete="new-password" required value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-pressed={showPassword}>{showPassword ? "Ocultar" : "Mostrar"}</button></span></label><label>Repite la contraseña<input type={showPassword ? "text" : "password"} minLength={8} autoComplete="new-password" required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>{message && <p className="auth-message">{message}</p>}<button className="add-button full" disabled={busy}>{busy ? "Guardando…" : "Guardar nueva contraseña"}</button></form></section></main>;
}
