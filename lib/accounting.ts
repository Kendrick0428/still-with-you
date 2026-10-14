import type Stripe from "stripe";
import { CAP, LOOKUPS } from "@/lib/admin";

export type LedgerRow = {
  id: string; date: number; type: "sale" | "refund";
  email: string | null; gross: number; fee: number; net: number;
};

const bt = (x: string | Stripe.BalanceTransaction | null | undefined) => (x && typeof x !== "string" ? x : null);

// Every Still With You Plus sale and refund in [from, to), with Stripe's fee and the net that reached the balance.
export async function stripeLedger(s: Stripe, from: number, to: number): Promise<{ rows: LedgerRow[]; truncated: boolean }> {
  const created = { gte: Math.floor(from / 1000), lt: Math.floor(to / 1000) };
  const subs = await s.subscriptions.list({ status: "all", limit: 100 }).autoPagingToArray({ limit: CAP });
  const plus = new Set(
    subs.filter((x) => x.items.data.some((i) => i.price.lookup_key && LOOKUPS.has(i.price.lookup_key)))
      .map((x) => (typeof x.customer === "string" ? x.customer : x.customer.id)),
  );

  const charges = await s.charges.list({ created, limit: 100, expand: ["data.balance_transaction", "data.customer"] }).autoPagingToArray({ limit: CAP });
  const ours = new Map<string, string | null>(); // charge id -> customer email
  const rows: LedgerRow[] = [];
  for (const c of charges) {
    const customer = typeof c.customer === "string" ? c.customer : c.customer?.id;
    if (!customer || !plus.has(customer) || c.status !== "succeeded") continue;
    const cust = typeof c.customer === "object" && c.customer && !c.customer.deleted ? c.customer : null;
    const email = cust?.email ?? c.billing_details?.email ?? c.receipt_email ?? null;
    ours.set(c.id, email);
    const b = bt(c.balance_transaction);
    rows.push({ id: c.id, date: c.created * 1000, type: "sale", email, gross: b?.amount ?? c.amount, fee: b?.fee ?? 0, net: b?.net ?? c.amount });
  }

  const refunds = await s.refunds.list({ created, limit: 100, expand: ["data.balance_transaction"] }).autoPagingToArray({ limit: CAP });
  for (const r of refunds) {
    if (r.status !== "succeeded" || !r.charge) continue;
    const chargeId = typeof r.charge === "string" ? r.charge : r.charge.id;
    if (!ours.has(chargeId)) {
      // A refund this year for a sale made earlier: look the sale up once.
      const c = await s.charges.retrieve(chargeId).catch(() => null);
      const customer = typeof c?.customer === "string" ? c.customer : c?.customer?.id;
      if (!c || !customer || !plus.has(customer)) continue;
      ours.set(chargeId, c.billing_details?.email ?? c.receipt_email ?? null);
    }
    const b = bt(r.balance_transaction);
    rows.push({ id: r.id, date: r.created * 1000, type: "refund", email: ours.get(chargeId) ?? null, gross: -r.amount, fee: b?.fee ?? 0, net: b?.net ?? -r.amount });
  }

  rows.sort((a, b) => a.date - b.date);
  return { rows, truncated: subs.length >= CAP || charges.length >= CAP || refunds.length >= CAP };
}
