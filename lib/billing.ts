import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// Plans are created in Stripe on first use, so nothing has to be set up by hand in the dashboard.
export const PLANS = {
  month: { lookup: "swy_plus_month", amount: 699, interval: "month" as const, label: "Monthly" },
  year: { lookup: "swy_plus_year", amount: 4900, interval: "year" as const, label: "Yearly" },
};
export type PlanKey = keyof typeof PLANS;
export const TRIAL_DAYS = 7;
const PRODUCT_NAME = "Still With You Plus";

let _stripe: Stripe | null = null;
export function stripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return (_stripe ??= new Stripe(key));
}

export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

// The signed-in person, verified with Supabase from the token the app sends.
export async function currentUser(req: Request): Promise<{ id: string; email: string } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !anon || !token) return null;
  const { data, error } = await createClient(url, anon, { auth: { persistSession: false } }).auth.getUser(token);
  if (error || !data.user?.email) return null;
  return { id: data.user.id, email: data.user.email };
}

// Each account maps to one Stripe customer, tagged with the Supabase user id.
export async function findCustomer(s: Stripe, user: { id: string; email: string }) {
  const list = await s.customers.list({ email: user.email, limit: 20 });
  return list.data.find((c) => c.metadata?.swy_user === user.id) ?? null;
}

export async function findOrCreateCustomer(s: Stripe, user: { id: string; email: string }) {
  return (await findCustomer(s, user)) ?? s.customers.create({ email: user.email, metadata: { swy_user: user.id } });
}

export async function priceFor(s: Stripe, plan: PlanKey): Promise<string> {
  const p = PLANS[plan];
  const found = await s.prices.list({ lookup_keys: [p.lookup], active: true, limit: 1 });
  if (found.data[0]) return found.data[0].id;
  const products = await s.products.search({ query: `metadata['swy']:'plus'` }).catch(() => null);
  const product = products?.data[0] ?? (await s.products.create({ name: PRODUCT_NAME, metadata: { swy: "plus" } }));
  const price = await s.prices.create({
    product: product.id, currency: "usd", unit_amount: p.amount,
    recurring: { interval: p.interval }, lookup_key: p.lookup, transfer_lookup_key: true,
  });
  return price.id;
}

const LIVE = new Set(["active", "trialing", "past_due"]);

export async function planStatus(s: Stripe, customerId: string) {
  const subs = await s.subscriptions.list({ customer: customerId, status: "all", limit: 10 });
  const sub = subs.data.find((x) => LIVE.has(x.status));
  if (!sub) return { plan: "free" as const, everSubscribed: subs.data.length > 0 };
  const item = sub.items.data[0];
  const end = (item as unknown as { current_period_end?: number })?.current_period_end
    ?? (sub as unknown as { current_period_end?: number }).current_period_end ?? null;
  return {
    plan: "plus" as const,
    status: sub.status,
    interval: item?.price.recurring?.interval ?? null,
    trialEnds: sub.trial_end ? sub.trial_end * 1000 : null,
    renews: end ? end * 1000 : null,
    cancelsAtEnd: sub.cancel_at_period_end || !!sub.cancel_at,
    everSubscribed: true,
  };
}
