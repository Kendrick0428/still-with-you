"use client";
import { useCallback, useEffect, useMemo, useState } from "react";

type Row = { id: string; date: number; type: "sale" | "refund"; email: string | null; gross: number; fee: number; net: number };
type Expense = { id: string; spent_on: string; vendor: string; category: string; amount_cents: number; monthly: boolean; ends_on: string | null; note: string | null };
type Data = {
  year: number; testMode: boolean; taxRate: number;
  ledger: { rows: Row[]; truncated: boolean } | { error: string } | null;
  expenses: Expense[] | null;
};
type Line = { date: Date; kind: "Sale" | "Refund" | "Expense"; who: string; category: string; gross: number; fee: number; net: number; note: string };

export const CATEGORIES = [
  "Software & hosting", "AI services", "Website & domain", "Advertising & marketing", "Legal & professional",
  "Office & supplies", "Equipment", "Education & training", "Bank & payment fees", "Other",
];
const VENDORS: Record<string, string> = {
  Vercel: "Software & hosting", Supabase: "Software & hosting", Upstash: "Software & hosting",
  Anthropic: "AI services", GoDaddy: "Website & domain", Apple: "Software & hosting", Google: "Software & hosting",
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// IRS estimated-tax periods for individuals: months covered and when each payment is due.
const QUARTERS = [
  { label: "Jan–Mar", end: 2, due: (y: number) => `Apr 15, ${y}` },
  { label: "Apr–May", end: 4, due: (y: number) => `Jun 15, ${y}` },
  { label: "Jun–Aug", end: 7, due: (y: number) => `Sep 15, ${y}` },
  { label: "Sep–Dec", end: 11, due: (y: number) => `Jan 15, ${y + 1}` },
];

const usd = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
const money = (cents: number) => (cents / 100).toFixed(2);
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const hasError = (x: unknown): x is { error: string } => !!x && typeof x === "object" && "error" in x;

// Each time an expense was actually paid in the year: once, or every month from its start until it stops (never in the future).
function occurrences(e: Expense, year: number, today: Date): Date[] {
  const start = parse(e.spent_on);
  if (!e.monthly) return start.getFullYear() === year && start <= today ? [start] : [];
  const stop = e.ends_on ? parse(e.ends_on) : today;
  const out: Date[] = [];
  for (let m = 0; m < 12; m++) {
    const last = new Date(year, m + 1, 0).getDate();
    const d = new Date(year, m, Math.min(start.getDate(), last));
    if (d >= start && d <= stop && d <= today) out.push(d);
  }
  return out;
}

function csvCell(v: string | number) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function Accounting({ token }: { token: () => Promise<string | null> }) {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [rate, setRate] = useState("25");
  const [adding, setAdding] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const call = useCallback(async (path: string, init?: RequestInit) => {
    const t = await token();
    const res = await fetch(path, { ...init, headers: { "content-type": "application/json", authorization: `Bearer ${t}` }, cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Something went wrong. Please try again.");
    return body;
  }, [token]);

  const load = useCallback(async () => {
    setBusy(true); setNote("");
    try {
      const d: Data = await call(`/api/admin/accounting?year=${year}`);
      setData(d); setRate(String(d.taxRate));
    } catch (e) { setNote((e as Error).message); }
    setBusy(false);
  }, [call, year]);
  useEffect(() => { load(); }, [load]);

  const report = useMemo(() => {
    if (!data) return null;
    const today = new Date();
    const r = Number(rate) >= 0 && Number(rate) <= 60 ? Number(rate) / 100 : data.taxRate / 100;
    const lines: Line[] = [];
    const ledger = data.ledger && !hasError(data.ledger) ? data.ledger : null;
    for (const x of ledger?.rows ?? []) {
      const date = new Date(x.date);
      if (date.getFullYear() !== year) continue;
      lines.push({ date, kind: x.type === "sale" ? "Sale" : "Refund", who: x.email ?? "", category: "Still With You Plus", gross: x.gross, fee: x.fee, net: x.net, note: x.id });
    }
    for (const e of data.expenses ?? []) {
      for (const date of occurrences(e, year, today)) {
        lines.push({ date, kind: "Expense", who: e.vendor, category: e.category, gross: -e.amount_cents, fee: 0, net: -e.amount_cents, note: [e.monthly ? "Monthly" : "", e.note ?? ""].filter(Boolean).join(" · ") });
      }
    }
    lines.sort((a, b) => a.date.getTime() - b.date.getTime());

    const months = MONTHS.map((label) => ({ label, sales: 0, refunds: 0, fees: 0, expenses: 0, profit: 0 }));
    const byCategory: Record<string, number> = {};
    for (const l of lines) {
      const m = months[l.date.getMonth()];
      if (l.kind === "Sale") m.sales += l.gross;
      if (l.kind === "Refund") m.refunds += -l.gross;
      if (l.kind !== "Expense") m.fees += l.fee;
      if (l.kind === "Expense") { m.expenses += -l.gross; byCategory[l.category] = (byCategory[l.category] ?? 0) - l.gross; }
    }
    for (const m of months) m.profit = m.sales - m.refunds - m.fees - m.expenses;
    const total = months.reduce((t, m) => ({ sales: t.sales + m.sales, refunds: t.refunds + m.refunds, fees: t.fees + m.fees, expenses: t.expenses + m.expenses, profit: t.profit + m.profit }), { sales: 0, refunds: 0, fees: 0, expenses: 0, profit: 0 });
    if (total.fees) byCategory["Payment processing (Stripe fees)"] = total.fees;

    // Set-aside is a share of profit so far; each quarter holds what's new since the last one.
    let cum = 0, held = 0;
    const quarters = QUARTERS.map((q, i) => {
      const startM = i ? QUARTERS[i - 1].end + 1 : 0;
      const profit = months.slice(startM, q.end + 1).reduce((t, m) => t + m.profit, 0);
      cum += profit;
      const due = Math.max(0, Math.round(Math.max(0, cum) * r) - held);
      held += due;
      return { ...q, profit, setAside: due };
    });
    const shown = year === today.getFullYear() ? today.getMonth() + 1 : 12;
    return { lines, months: months.slice(0, shown), total, byCategory, quarters, setAside: Math.round(Math.max(0, total.profit) * r), ratePct: r * 100, truncated: !!ledger?.truncated, ledgerError: hasError(data.ledger) ? data.ledger.error : null, noStripe: !data.ledger };
  }, [data, rate, year]);

  async function saveRate() {
    const n = Number(rate);
    if (!(n >= 0 && n <= 60)) { setNote("Use a percentage between 0 and 60."); return; }
    try { await call("/api/admin/accounting", { method: "PUT", body: JSON.stringify({ taxRate: n }) }); setNote(""); }
    catch (e) { setNote((e as Error).message); }
  }

  async function addExpense(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setAdding(true); setNote("");
    try {
      await call("/api/admin/expenses", { method: "POST", body: JSON.stringify({
        spentOn: f.get("spentOn"), vendor: f.get("vendor"), category: f.get("category"),
        amount: f.get("amount"), monthly: f.get("monthly") === "on", note: f.get("note"),
      }) });
      form.reset();
      (form.elements.namedItem("spentOn") as HTMLInputElement).value = ymd(new Date());
      await load();
    } catch (err) { setNote((err as Error).message); }
    setAdding(false);
  }

  async function stopMonthly(x: Expense) {
    try {
      await call("/api/admin/expenses", { method: "PATCH", body: JSON.stringify({ id: x.id, spentOn: x.spent_on, vendor: x.vendor, category: x.category, amount: x.amount_cents / 100, monthly: true, endsOn: ymd(new Date()), note: x.note }) });
      await load();
    } catch (err) { setNote((err as Error).message); }
  }

  async function remove(x: Expense) {
    if (!confirm(`Delete ${x.vendor} (${usd(x.amount_cents)})${x.monthly ? " and all its past months" : ""}?`)) return;
    try { await call(`/api/admin/expenses?id=${encodeURIComponent(x.id)}`, { method: "DELETE" }); await load(); }
    catch (err) { setNote((err as Error).message); }
  }

  function downloadCsv() {
    if (!report || !data) return;
    const rows: (string | number)[][] = [
      [`Still With You: ${year} accounting summary`],
      [`Prepared ${new Date().toLocaleDateString("en-US")}`, data.testMode ? "STRIPE TEST MODE: not real money" : "Live Stripe data"],
      ["Basis", "Cash (money collected and paid, by date)"],
      [],
      ["MONTHLY SUMMARY"],
      ["Month", "Gross sales", "Refunds", "Stripe fees", "Expenses", "Net profit"],
      ...report.months.map((m) => [`${m.label} ${year}`, money(m.sales), money(m.refunds), money(m.fees), money(m.expenses), money(m.profit)]),
      ["Total", money(report.total.sales), money(report.total.refunds), money(report.total.fees), money(report.total.expenses), money(report.total.profit)],
      [],
      ["EXPENSES BY CATEGORY"],
      ["Category", "Amount"],
      ...Object.entries(report.byCategory).sort((a, b) => b[1] - a[1]).map(([c, v]) => [c, money(v)]),
      [],
      ["ESTIMATED TAX SET-ASIDE (an estimate for saving, not tax advice)"],
      ["Rate used", `${report.ratePct}% of net profit`],
      ["Period", "Due", "Net profit", "Set aside"],
      ...report.quarters.map((q) => [q.label, q.due(year), money(q.profit), money(q.setAside)]),
      ["Year to date", "", money(report.total.profit), money(report.setAside)],
      [],
      ["ALL TRANSACTIONS"],
      ["Date", "Type", "Customer or vendor", "Category", "Gross", "Stripe fee", "Net", "Reference or note"],
      ...report.lines.map((l) => [ymd(l.date), l.kind, l.who, l.category, money(l.gross), money(l.fee), money(l.net), l.note]),
    ];
    const blob = new Blob(["﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `still-with-you-accounting-${year}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const years = Array.from({ length: thisYear - 2026 + 1 }, (_, i) => thisYear - i);

  return (
    <div className="acc">
      <div className="acc-bar no-print">
        <label className="acc-year">Year
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>{years.map((y) => <option key={y}>{y}</option>)}</select>
        </label>
        <div className="adm-actions">
          <button className="adm-btn ghost" onClick={() => window.print()} disabled={!report}>Print or save as PDF</button>
          <button className="adm-btn" onClick={downloadCsv} disabled={!report}>Download for my CPA</button>
        </div>
      </div>

      <div className="print-only acc-print-head">
        <h1>Still With You · {year} accounting summary</h1>
        <p>Prepared {new Date().toLocaleDateString("en-US", { dateStyle: "long" })} · Cash basis{data?.testMode ? " · STRIPE TEST MODE, not real money" : ""}</p>
      </div>

      {note && <p className="adm-card adm-note" role="alert">{note}</p>}
      {!report && busy && <p className="adm-muted">Adding up {year}…</p>}

      {report && (
        <>
          {data?.testMode && <p className="adm-card acc-flag">Stripe is in test mode, so these sales are practice purchases, not real income.</p>}
          {report.noStripe && <p className="adm-card adm-muted">Stripe isn’t connected, so only expenses are shown.</p>}
          {report.ledgerError && <p className="adm-card adm-note">{report.ledgerError} Sales are missing until it answers; try again in a moment.</p>}
          {data?.expenses === null && <p className="adm-card adm-note">Expenses aren’t switched on in the database yet.</p>}

          <section className="adm-tiles">
            <Tile label="Gross sales" value={usd(report.total.sales)} sub={report.total.refunds ? `${usd(report.total.refunds)} refunded` : "No refunds"} />
            <Tile label="Stripe fees" value={usd(report.total.fees)} sub="Kept by Stripe per sale" />
            <Tile label="Expenses" value={usd(report.total.expenses)} sub={`${(data?.expenses ?? []).length} logged`} />
            <Tile label="Net profit" value={usd(report.total.profit)} sub={`${year === thisYear ? "So far in" : "For"} ${year}`} />
          </section>

          <section className="adm-card acc-tax">
            <div>
              <p className="adm-label">Set aside for taxes</p>
              <p className="adm-big">{usd(report.setAside)}</p>
              <p className="adm-muted">{report.ratePct}% of net profit. This is an estimate to help you save, not tax advice. Your CPA will tell you the real amount. Many self-employed people hold 25–30% to cover income and self-employment tax.</p>
              <label className="acc-rate no-print">Percent to hold
                <input type="number" min={0} max={60} step={0.5} value={rate} onChange={(e) => setRate(e.target.value)} onBlur={saveRate} inputMode="decimal" />
                <span>%</span>
              </label>
            </div>
            <table className="acc-table">
              <thead><tr><th>Estimated payment</th><th>Due</th><th className="n">Profit</th><th className="n">Hold</th></tr></thead>
              <tbody>{report.quarters.map((q) => <tr key={q.label}><td>{q.label}</td><td>{q.due(year)}</td><td className="n">{usd(q.profit)}</td><td className="n"><strong>{usd(q.setAside)}</strong></td></tr>)}</tbody>
            </table>
          </section>

          <section className="adm-card">
            <h2>Month by month</h2>
            <div className="acc-scroll">
              <table className="acc-table">
                <thead><tr><th>Month</th><th className="n">Sales</th><th className="n">Refunds</th><th className="n">Stripe fees</th><th className="n">Expenses</th><th className="n">Profit</th></tr></thead>
                <tbody>
                  {report.months.map((m) => <tr key={m.label}><td>{m.label}</td><td className="n">{usd(m.sales)}</td><td className="n">{usd(m.refunds)}</td><td className="n">{usd(m.fees)}</td><td className="n">{usd(m.expenses)}</td><td className="n">{usd(m.profit)}</td></tr>)}
                </tbody>
                <tfoot><tr><td>Total</td><td className="n">{usd(report.total.sales)}</td><td className="n">{usd(report.total.refunds)}</td><td className="n">{usd(report.total.fees)}</td><td className="n">{usd(report.total.expenses)}</td><td className="n">{usd(report.total.profit)}</td></tr></tfoot>
              </table>
            </div>
          </section>

          <section className="acc-two">
            <div className="adm-card">
              <h2>Expenses by category</h2>
              {Object.keys(report.byCategory).length === 0 ? <p className="adm-muted">Nothing yet.</p> : (
                <ul className="adm-rows">
                  {Object.entries(report.byCategory).sort((a, b) => b[1] - a[1]).map(([c, v]) => <li key={c} className="acc-li"><span>{c}</span><strong>{usd(v)}</strong></li>)}
                </ul>
              )}
            </div>

            <form className="adm-card acc-form no-print" onSubmit={addExpense}>
              <h2>Add an expense</h2>
              <label>Date paid<input name="spentOn" type="date" defaultValue={ymd(new Date())} required /></label>
              <label>Paid to<input name="vendor" list="acc-vendors" placeholder="Vercel, Supabase, Anthropic…" required maxLength={120}
                onChange={(e) => { const c = VENDORS[e.target.value]; const sel = e.target.form?.elements.namedItem("category") as HTMLSelectElement | null; if (c && sel) sel.value = c; }} /></label>
              <datalist id="acc-vendors">{Object.keys(VENDORS).map((v) => <option key={v} value={v} />)}</datalist>
              <label>Category<select name="category" defaultValue="Software & hosting">{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
              <label>Amount (USD)<input name="amount" type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="20.00" required /></label>
              <label className="acc-check"><input name="monthly" type="checkbox" /> Repeats every month</label>
              <label>Note (optional)<input name="note" maxLength={500} placeholder="Pro plan" /></label>
              <button className="adm-btn" disabled={adding}>{adding ? "Saving…" : "Add expense"}</button>
              <p className="adm-muted">Keep the receipt for each one. Your CPA may ask for it.</p>
            </form>
          </section>

          {(data?.expenses ?? []).length > 0 && (
            <section className="adm-card">
              <h2>Logged expenses</h2>
              <ul className="adm-rows">
                {(data?.expenses ?? []).slice().reverse().map((x) => (
                  <li key={x.id} className="acc-exp">
                    <span className="adm-who">{x.vendor}<span className="adm-muted"> · {x.category}</span></span>
                    <span className="adm-muted">{x.monthly ? (x.ends_on ? `Monthly, ${x.spent_on} to ${x.ends_on}` : `Monthly since ${x.spent_on}`) : x.spent_on}</span>
                    <strong>{usd(x.amount_cents)}</strong>
                    <span className="acc-row-actions no-print">
                      {x.monthly && !x.ends_on && <button type="button" onClick={() => stopMonthly(x)}>Stop</button>}
                      <button type="button" onClick={() => remove(x)}>Delete</button>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="adm-card">
            <h2>All transactions</h2>
            {report.lines.length === 0 ? <p className="adm-muted">No sales, refunds or expenses in {year} yet.</p> : (
              <div className="acc-scroll">
                <table className="acc-table">
                  <thead><tr><th>Date</th><th>Type</th><th>Customer or vendor</th><th className="n">Gross</th><th className="n">Fee</th><th className="n">Net</th></tr></thead>
                  <tbody>{report.lines.slice().reverse().map((l, i) => <tr key={i} className={i >= 25 && !showAll ? "acc-hidden" : undefined}><td>{ymd(l.date)}</td><td>{l.kind}</td><td className="acc-who">{l.who}</td><td className="n">{usd(l.gross)}</td><td className="n">{l.fee ? usd(l.fee) : ""}</td><td className="n">{usd(l.net)}</td></tr>)}</tbody>
                </table>
                {report.lines.length > 25 && !showAll && <button type="button" className="adm-btn ghost no-print acc-more" onClick={() => setShowAll(true)}>Show all {report.lines.length}</button>}
              </div>
            )}
          </section>

          <p className="adm-muted acc-fine">
            Sales and Stripe fees come straight from Stripe and count only Still With You Plus. Expenses are what you log here. Amounts are by the date money moved (cash basis).
            Ask your CPA about sales tax on digital subscriptions in your state, and keep Stripe’s payout reports with your bank statements.
            {report.truncated && " Very large years are capped at the most recent 2,000 Stripe records; Stripe’s own reports have everything."}
          </p>
        </>
      )}
    </div>
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
