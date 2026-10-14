"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Money = {
  testMode: boolean; truncated: boolean; mrr: number; trialMrr: number;
  revenue: { last30: number; thisMonth: number; allTime: number };
  counts: { paying: number; trialing: number; pastDue: number; monthly: number; yearly: number; cancelling: number; new30: number; cancelled30: number };
  months: { label: string; total: number }[];
  payments: { id: string; email: string | null; amount: number; paidAt: number }[];
  subscribers: { id: string; email: string | null; status: string; interval: string | null; created: number; trialEnds: number | null; cancelsAtEnd: boolean }[];
};
type Signups = { total: number; last7: number; last30: number };
type Stats = { email: string; money: Money | { error: string } | null; signups: Signups | { error: string } | null; at: number };

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const usd = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: cents % 100 ? 2 : 0 });
const day = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const hasError = (x: unknown): x is { error: string } => !!x && typeof x === "object" && "error" in x;

function statusLabel(s: Money["subscribers"][number]) {
  if (s.status === "trialing") return s.cancelsAtEnd ? "Trial, cancelling" : `Trial until ${s.trialEnds ? day(s.trialEnds) : "soon"}`;
  if (s.status === "active") return s.cancelsAtEnd ? "Paying, cancelling" : "Paying";
  if (s.status === "past_due") return "Payment failed";
  if (s.status === "canceled") return "Cancelled";
  return s.status.replace(/_/g, " ");
}

export default function AdminDashboard() {
  const sb: SupabaseClient | null = useMemo(() => (url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } }) : null), []);
  const [phase, setPhase] = useState<"loading" | "signin" | "denied" | "ready">("loading");
  const [stats, setStats] = useState<Stats | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    if (!sb) { setPhase("signin"); return; }
    const token = (await sb.auth.getSession()).data.session?.access_token;
    if (!token) { setPhase("signin"); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/stats", { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
      if (res.status === 403) { setPhase("denied"); return; }
      setStats(await res.json());
      setPhase("ready");
    } catch {
      setNote("Couldn’t reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [sb]);

  useEffect(() => { load(); }, [load]);

  async function signIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!sb) return;
    const f = new FormData(e.currentTarget);
    setBusy(true); setNote("");
    const { error } = await sb.auth.signInWithPassword({ email: String(f.get("email")), password: String(f.get("password")) });
    setBusy(false);
    if (error) { setNote("That email and password don’t match."); return; }
    load();
  }

  async function signOut() {
    await sb?.auth.signOut();
    setStats(null); setPhase("signin");
  }

  if (phase === "loading") return <main className="adm adm-center"><p className="adm-muted">Opening your dashboard…</p></main>;

  if (phase === "signin" || phase === "denied") {
    return (
      <main className="adm adm-center">
        <form className="adm-card adm-signin" onSubmit={signIn}>
          <p className="adm-eyebrow">Still With You</p>
          <h1>Owner dashboard</h1>
          {!sb ? <p className="adm-muted">Accounts aren’t turned on for this site yet.</p> : phase === "denied" ? (
            <>
              <p className="adm-muted">This account isn’t on the owner list. Sign in with the owner email, or add this email to ADMIN_EMAILS in Vercel.</p>
              <button type="button" className="adm-btn" onClick={signOut}>Sign out</button>
            </>
          ) : (
            <>
              <label>Email<input name="email" type="email" autoComplete="email" required /></label>
              <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
              <button className="adm-btn" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
              {note && <p className="adm-note" role="alert">{note}</p>}
            </>
          )}
        </form>
      </main>
    );
  }

  const money = stats?.money, signups = stats?.signups;
  const m = money && !hasError(money) ? money : null;
  const peak = m ? Math.max(...m.months.map((x) => x.total), 1) : 1;
  const dash = m?.testMode ? "https://dashboard.stripe.com/test" : "https://dashboard.stripe.com";

  return (
    <main className="adm">
      <header className="adm-top">
        <div>
          <p className="adm-eyebrow">Still With You · Owner</p>
          <h1>Money and subscribers</h1>
        </div>
        <div className="adm-actions">
          {m?.testMode && <span className="adm-badge">Test mode</span>}
          <button className="adm-btn ghost" onClick={load} disabled={busy}>{busy ? "Refreshing…" : "Refresh"}</button>
          <button className="adm-btn ghost" onClick={signOut}>Sign out</button>
        </div>
      </header>

      {!money && <p className="adm-card adm-muted">Stripe isn’t connected yet. Add STRIPE_SECRET_KEY in Vercel to see money and subscribers.</p>}
      {hasError(money) && <p className="adm-card adm-note">{money.error} Try Refresh in a moment.</p>}

      {m && (
        <>
          <section className="adm-hero adm-card">
            <div>
              <p className="adm-label">Monthly recurring revenue</p>
              <p className="adm-big">{usd(m.mrr)}</p>
              <p className="adm-muted">
                From {m.counts.paying} paying {m.counts.paying === 1 ? "subscriber" : "subscribers"}
                {m.counts.trialing > 0 && <> · {usd(m.trialMrr)} more if {m.counts.trialing} {m.counts.trialing === 1 ? "trial converts" : "trials convert"}</>}
              </p>
            </div>
            <figure className="adm-chart" aria-label="Revenue by month, last six months">
              <figcaption className="adm-label">Collected by month</figcaption>
              <div className="adm-bars">
                {m.months.map((x) => (
                  <div className="adm-bar" key={x.label} title={`${x.label}: ${usd(x.total)}`}>
                    <span className="adm-bar-val">{x.total ? usd(x.total) : ""}</span>
                    <span className="adm-bar-fill" style={{ height: `${Math.max((x.total / peak) * 100, x.total ? 4 : 0)}%` }} />
                    <span className="adm-bar-lab">{x.label}</span>
                  </div>
                ))}
              </div>
            </figure>
          </section>

          <section className="adm-tiles">
            <Tile label="Plus subscribers" value={String(m.counts.paying + m.counts.trialing)} sub={`${m.counts.paying} paying · ${m.counts.trialing} in trial`} />
            <Tile label="Collected, last 30 days" value={usd(m.revenue.last30)} sub={`${usd(m.revenue.allTime)} all time`} />
            <Tile label="Plan mix" value={`${m.counts.monthly} / ${m.counts.yearly}`} sub="monthly / yearly" />
            <Tile label="Last 30 days" value={`+${m.counts.new30}`} sub={`${m.counts.cancelled30} cancelled · ${m.counts.cancelling} set to cancel`} />
            {m.counts.pastDue > 0 && <Tile label="Payment failed" value={String(m.counts.pastDue)} sub="Stripe is retrying their card" />}
            {signups && !hasError(signups) && <Tile label="Accounts" value={signups.total.toLocaleString()} sub={`+${signups.last7} this week · +${signups.last30} in 30 days`} />}
          </section>

          <section className="adm-lists">
            <div className="adm-card">
              <h2>Recent payments</h2>
              {m.payments.length === 0 ? <p className="adm-muted">No payments yet. Trials turn into payments when they end.</p> : (
                <ul className="adm-rows">
                  {m.payments.map((p) => (
                    <li key={p.id}><span className="adm-who">{p.email ?? "Unknown"}</span><span className="adm-muted">{day(p.paidAt)}</span><strong>{usd(p.amount)}</strong></li>
                  ))}
                </ul>
              )}
            </div>
            <div className="adm-card">
              <h2>Newest subscribers</h2>
              {m.subscribers.length === 0 ? <p className="adm-muted">No one has started Plus yet.</p> : (
                <ul className="adm-rows">
                  {m.subscribers.map((s) => (
                    <li key={s.id}>
                      <a className="adm-who" href={`${dash}/subscriptions/${s.id}`} target="_blank" rel="noreferrer">{s.email ?? "Unknown"}</a>
                      <span className="adm-muted">{day(s.created)} · {s.interval === "year" ? "Yearly" : "Monthly"}</span>
                      <span className={`adm-status s-${s.status}`}>{statusLabel(s)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
          {m.truncated && <p className="adm-muted">Showing the most recent 2,000 records. Open Stripe for the full history.</p>}
        </>
      )}

      {hasError(signups) && <p className="adm-muted">Accounts: {signups.error}</p>}
      {!signups && <p className="adm-muted">To see account sign-ups here too, add SUPABASE_SERVICE_ROLE_KEY in Vercel.</p>}
      <p className="adm-foot adm-muted">
        Signed in as {stats?.email}{stats?.at && <> · Updated {new Date(stats.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</>}
        {m && <> · <a href={dash} target="_blank" rel="noreferrer">Open Stripe</a></>}
      </p>
    </main>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="adm-card adm-tile">
      <p className="adm-label">{label}</p>
      <p className="adm-num">{value}</p>
      <p className="adm-muted">{sub}</p>
    </div>
  );
}
