import { json } from "@/lib/billing";
import { currentAdmin, ownerDb } from "@/lib/admin";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function clean(body: Record<string, unknown>) {
  const vendor = String(body.vendor ?? "").trim().slice(0, 120);
  const category = String(body.category ?? "").trim().slice(0, 60);
  const amount = Math.round(Number(body.amount) * 100);
  const spent_on = String(body.spentOn ?? "");
  const ends_on = body.endsOn ? String(body.endsOn) : null;
  if (!vendor || !category || !DATE.test(spent_on) || !(amount > 0) || amount > 100_000_000 || (ends_on && !DATE.test(ends_on))) return null;
  return { vendor, category, amount_cents: amount, spent_on, monthly: !!body.monthly, ends_on, note: String(body.note ?? "").trim().slice(0, 500) || null };
}

async function guard(req: Request) {
  const admin = await currentAdmin(req);
  return admin ? { admin, db: ownerDb(admin.token) } : null;
}
const denied = () => json({ error: "This page is only for the owner's account." }, 403);
const failed = (what: string, e: unknown) => { console.error(what, e); return json({ error: "Couldn’t save that just now." }, 500); };

// Adds a business expense.
export async function POST(req: Request) {
  const g = await guard(req); if (!g) return denied();
  const row = clean(await req.json().catch(() => ({})));
  if (!row) return json({ error: "Please fill in the date, who you paid, a category and the amount." }, 400);
  const { error } = await g.db.from("admin_expenses").insert({ ...row, user_id: g.admin.id });
  return error ? failed("add expense", error) : json({ ok: true });
}

// Edits an expense, for example to stop a monthly one.
export async function PATCH(req: Request) {
  const g = await guard(req); if (!g) return denied();
  const body = await req.json().catch(() => ({}));
  const row = clean(body);
  if (!row || typeof body.id !== "string") return json({ error: "Please fill in the date, who you paid, a category and the amount." }, 400);
  const { error } = await g.db.from("admin_expenses").update(row).eq("id", body.id);
  return error ? failed("edit expense", error) : json({ ok: true });
}

export async function DELETE(req: Request) {
  const g = await guard(req); if (!g) return denied();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return json({ error: "Missing expense." }, 400);
  const { error } = await g.db.from("admin_expenses").delete().eq("id", id);
  return error ? failed("delete expense", error) : json({ ok: true });
}
