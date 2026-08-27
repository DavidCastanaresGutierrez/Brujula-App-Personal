"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

export default function WatchConnectPage() {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getSupabaseBrowserClient().auth.getSession().then(({ data }) => {
      setSignedIn(Boolean(data.session));
      setReady(true);
    });
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
      </>}
      <Link className="watch-connect-back" href="/">← Volver a Brújula</Link>
    </section>
  </main>;
}
