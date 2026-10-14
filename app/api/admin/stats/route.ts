import { json, stripe } from "@/lib/billing";
import { currentAdmin, moneyStats, signupStats } from "@/lib/admin";

// Money, subscribers and sign-ups for the private admin page. Admins only.
export async function GET(req: Request) {
  const admin = await currentAdmin(req);
  if (!admin) return json({ error: "This page is only for the owner's account." }, 403);
  const s = stripe();
  const [money, signups] = await Promise.all([
    s ? moneyStats(s).catch((e) => { console.error("admin money failed", e); return { error: "Stripe didn’t answer just now." }; }) : null,
    signupStats().catch((e) => { console.error("admin signups failed", e); return { error: "Supabase didn’t answer just now." }; }),
  ]);
  return json({ email: admin.email, money, signups, at: Date.now() });
}
