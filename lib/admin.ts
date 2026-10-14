import type Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { PLANS } from "@/lib/billing";

// Only emails listed in ADMIN_EMAILS (comma separated) can open the admin page.
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

// The signed-in person, but only if their email is confirmed and on the admin list.
export async function currentAdmin(req: Request): Promise<{ id: string; email: string; token: string } | null> {
  const allowed = adminEmails();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!allowed.length || !url || !anon || !token) return null;
  const { data, error } = await createClient(url, anon, { auth: { persistSession: false } }).auth.getUser(token);
  const email = data.user?.email?.toLowerCase();
  if (error || !email || !data.user?.email_confirmed_at || !allowed.includes(email)) return null;
  return { id: data.user.id, email, token };
}

// A Supabase client acting as the signed-in owner, so row level security still applies.
export function ownerDb(token: string) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
    global: { headers: { authorization: `Bearer ${token}` } },
  });
}

const DAY = 86_400_000;
export const CAP = 2000; // enough for a long while; the page says when it was reached
export const LOOKUPS = new Set<string>(Object.values(PLANS).map((p) => p.lookup));

type Sub = {
  id: string; email: string | null; status: string; interval: string | null; amount: number;
  created: number; trialEnds: number | null; cancelsAtEnd: boolean; canceledAt: number | null;
};

export async function moneyStats(s: Stripe) {
  const now = Date.now();
  // Only Still With You Plus subscriptions count, even if the Stripe account sells other things.
  const all = await s.subscriptions.list({ status: "all", limit: 100, expand: ["data.customer"] }).autoPagingToArray({ limit: CAP });
  const subs: Sub[] = [];
  const customers = new Set<string>();
  for (const sub of all) {
    const item = sub.items.data.find((i) => i.price.lookup_key && LOOKUPS.has(i.price.lookup_key));
    if (!item) continue;
    const customer = sub.customer as Stripe.Customer | Stripe.DeletedCustomer | string;
    const id = typeof customer === "string" ? customer : customer.id;
    customers.add(id);
    subs.push({
      id: sub.id,
      email: typeof customer !== "string" && !customer.deleted ? customer.email : null,
      status: sub.status,
      interval: item.price.recurring?.interval ?? null,
      amount: (item.price.unit_amount ?? 0) * (item.quantity ?? 1),
      created: sub.created * 1000,
      trialEnds: sub.trial_end ? sub.trial_end * 1000 : null,
      cancelsAtEnd: sub.cancel_at_period_end || !!sub.cancel_at,
      canceledAt: sub.canceled_at ? sub.canceled_at * 1000 : null,
    });
  }

  const paying = subs.filter((x) => x.status === "active" || x.status === "past_due");
  const trialing = subs.filter((x) => x.status === "trialing");
  const monthly = (x: Sub) => (x.interval === "year" ? x.amount / 12 : x.amount);

  // Payments: paid invoices from Plus customers, newest first.
  const invoices = await s.invoices.list({ status: "paid", limit: 100 }).autoPagingToArray({ limit: CAP });
  const payments = invoices
    .filter((inv) => inv.amount_paid > 0 && typeof inv.customer === "string" && customers.has(inv.customer))
    .map((inv) => ({
      id: inv.id ?? "",
      email: inv.customer_email,
      amount: inv.amount_paid,
      paidAt: (inv.status_transitions?.paid_at ?? inv.created) * 1000,
    }))
    .sort((a, b) => b.paidAt - a.paidAt);

  const sum = (since: number) => payments.filter((p) => p.paidAt >= since).reduce((t, p) => t + p.amount, 0);
  const months: { label: string; start: number; total: number }[] = [];
  const d = new Date(now);
  for (let i = 5; i >= 0; i--) {
    const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    months.push({ label: start.toLocaleString("en-US", { month: "short", timeZone: "UTC" }), start: start.getTime(), total: 0 });
  }
  for (const p of payments) {
    for (let i = months.length - 1; i >= 0; i--) if (p.paidAt >= months[i].start) { months[i].total += p.amount; break; }
  }

  return {
    testMode: !!process.env.STRIPE_SECRET_KEY?.startsWith("sk_test"),
    truncated: all.length >= CAP || invoices.length >= CAP,
    mrr: Math.round(paying.reduce((t, x) => t + monthly(x), 0)),
    trialMrr: Math.round(trialing.reduce((t, x) => t + monthly(x), 0)),
    revenue: { last30: sum(now - 30 * DAY), thisMonth: sum(months[5].start), allTime: sum(0) },
    counts: {
      paying: paying.length,
      trialing: trialing.length,
      pastDue: subs.filter((x) => x.status === "past_due").length,
      monthly: [...paying, ...trialing].filter((x) => x.interval === "month").length,
      yearly: [...paying, ...trialing].filter((x) => x.interval === "year").length,
      cancelling: [...paying, ...trialing].filter((x) => x.cancelsAtEnd).length,
      new30: subs.filter((x) => x.created >= now - 30 * DAY).length,
      cancelled30: subs.filter((x) => x.canceledAt && x.canceledAt >= now - 30 * DAY).length,
    },
    months: months.map(({ label, total }) => ({ label, total })),
    payments: payments.slice(0, 12),
    subscribers: subs.sort((a, b) => b.created - a.created).slice(0, 12),
  };
}

// Sign-ups need the Supabase service role key; without it this part is skipped.
export async function signupStats() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return null;
  const admin = createClient(url, service, { auth: { persistSession: false } }).auth.admin;
  const now = Date.now();
  let total = 0, last7 = 0, last30 = 0;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) {
      total++;
      const t = Date.parse(u.created_at);
      if (t >= now - 7 * DAY) last7++;
      if (t >= now - 30 * DAY) last30++;
    }
    if (data.users.length < 1000) break;
  }
  return { total, last7, last30 };
}
