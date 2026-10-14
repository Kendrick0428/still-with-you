import { json, stripe } from "@/lib/billing";
import { currentAdmin, ownerDb } from "@/lib/admin";
import { stripeLedger } from "@/lib/accounting";

const DAY = 86_400_000;

// One year of sales, refunds, Stripe fees and logged expenses for the accounting tab. Admins only.
export async function GET(req: Request) {
  const admin = await currentAdmin(req);
  if (!admin) return json({ error: "This page is only for the owner's account." }, 403);
  const year = Number(new URL(req.url).searchParams.get("year")) || new Date().getUTCFullYear();
  if (year < 2020 || year > 2100) return json({ error: "Pick a year between 2020 and 2100." }, 400);
  // A day of margin each side; the browser files each row under its own local date.
  const from = Date.UTC(year, 0, 1) - DAY, to = Date.UTC(year + 1, 0, 1) + DAY;

  const s = stripe();
  const db = ownerDb(admin.token);
  const [ledger, expenses, settings] = await Promise.all([
    s ? stripeLedger(s, from, to).catch((e) => { console.error("ledger failed", e); return { error: "Stripe didn’t answer just now." }; }) : null,
    db.from("admin_expenses").select("id, spent_on, vendor, category, amount_cents, monthly, ends_on, note")
      .lte("spent_on", `${year}-12-31`).order("spent_on"),
    db.from("admin_settings").select("tax_rate").maybeSingle(),
  ]);
  if (expenses.error) console.error("expenses failed", expenses.error);
  return json({
    year,
    testMode: !!process.env.STRIPE_SECRET_KEY?.startsWith("sk_test"),
    ledger,
    expenses: expenses.error ? null : expenses.data,
    taxRate: settings.data ? Number(settings.data.tax_rate) : 25,
  });
}

// Saves the tax set-aside percentage.
export async function PUT(req: Request) {
  const admin = await currentAdmin(req);
  if (!admin) return json({ error: "This page is only for the owner's account." }, 403);
  const { taxRate } = await req.json().catch(() => ({}));
  const rate = Number(taxRate);
  if (!Number.isFinite(rate) || rate < 0 || rate > 60) return json({ error: "Use a percentage between 0 and 60." }, 400);
  const { error } = await ownerDb(admin.token).from("admin_settings")
    .upsert({ user_id: admin.id, tax_rate: Math.round(rate * 10) / 10, updated_at: new Date().toISOString() });
  if (error) { console.error("tax rate failed", error); return json({ error: "Couldn’t save that just now." }, 500); }
  return json({ ok: true });
}
