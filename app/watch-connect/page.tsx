"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

export default function WatchConnectPage() {
  type WatchDevice = { id: string; name: string; created_at: string; last_seen_at: string | null };
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [devices, setDevices] = useState<WatchDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function authorizedFetch(path: string, init?: RequestInit) {
    const { data } = await getSupabaseBrowserClient().auth.getSession();
    if (!data.session) throw new Error("Sesión no válida");
    return fetch(path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}`, ...init?.headers } });
  }

  async function loadDevices() {
    setLoadingDevices(true);
    try {
      const response = await authorizedFetch("/api/watch/devices");
      const payload = await response.json() as { devices?: WatchDevice[]; error?: string };
      if (!response.ok) throw new Error(payload.error);
      setDevices(payload.devices ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se han podido cargar los relojes");
    } finally {
      setLoadingDevices(false);
    }
  }

  useEffect(() => {
    getSupabaseBrowserClient().auth.getSession().then(({ data }) => {
      setSignedIn(Boolean(data.session));
      setReady(true);
      if (data.session) void loadDevices();
    });
    // The session is checked once on entry; subsequent requests validate it again server-side.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createCode() {
    setBusy(true); setError(""); setCode("");
    const { data } = await getSupabaseBrowserClient().auth.getSession();
    if (!data.session) { setSignedIn(false); setBusy(false); return; }
    const response = await fetch("/api/watch/pair", { method: "POST", headers: { Authorization: `Bearer ${data.session.access_token}` } });
    const payload = await response.json() as { code?: string; error?: string };
    if (response.ok && payload.code) setCode(payload.code); else setError(payload.error ?? "No se ha podido crear el código");
    setBusy(false);
  }

  async function revokeDevice(deviceId: string) {
    if (!window.confirm("¿Desvincular este reloj? Dejará de sincronizar inmediatamente.")) return;
    setBusy(true); setError("");
    try {
      const response = await authorizedFetch("/api/watch/devices", { method: "DELETE", body: JSON.stringify({ deviceId }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error);
      setDevices((current) => current.filter((device) => device.id !== deviceId));
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : "No se ha podido desvincular el reloj");
    } finally {
      setBusy(false);
    }
  }

  function dateLabel(value: string | null) {
    if (!value) return "Todavía sin actividad";
    return `Última conexión: ${new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))}`;
  }

  return <main className="watch-connect-page">
    <section className="watch-connect-card">
      <div className="watch-connect-mark">⌁</div>
      <p className="watch-connect-kicker">BRÚJULA · WEAR OS</p>
      <h1>Conecta tu reloj</h1>
      {!ready ? <p>Comprobando tu sesión…</p> : !signedIn ? <><p>Inicia sesión primero en Brújula y vuelve a esta pantalla.</p><Link className="watch-connect-button" href="/">Ir a iniciar sesión</Link></> : <>
        <p>Abre Brújula en tu Galaxy Watch 6 e introduce este código. Caduca en 10 minutos y solo funciona una vez.</p>
        {code && <div className="watch-connect-code" aria-label={`Código ${code}`}>{code.slice(0, 3)} {code.slice(3)}</div>}
        {error && <p className="watch-connect-error">{error}</p>}
        <button className="watch-connect-button" onClick={createCode} disabled={busy}>{busy ? "Generando…" : code ? "Generar otro código" : "Generar código"}</button>
        <div className="watch-device-section">
          <h2>Relojes vinculados</h2>
          {loadingDevices ? <p>Cargando dispositivos…</p> : devices.length === 0 ? <p>No hay ningún reloj vinculado.</p> : <div className="watch-device-list">
            {devices.map((device) => <article className="watch-device" key={device.id}>
              <div><strong>{device.name}</strong><small>{dateLabel(device.last_seen_at ?? device.created_at)}</small></div>
              <button type="button" onClick={() => revokeDevice(device.id)} disabled={busy}>Desvincular</button>
            </article>)}
          </div>}
        </div>
      </>}
      <Link className="watch-connect-back" href="/">← Volver a Brújula</Link>
    </section>
  </main>;
}
