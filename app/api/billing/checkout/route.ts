import { PLANS, TRIAL_DAYS, currentUser, findOrCreateCustomer, json, planStatus, priceFor, stripe, type PlanKey } from "@/lib/billing";

// Starts Stripe Checkout for Still With You Plus.
export async function POST(req: Request) {
  const s = stripe();
  if (!s) return json({ error: "Plans aren’t available yet." }, 503);
  const user = await currentUser(req);
  if (!user) return json({ error: "Please sign in first." }, 401);
  const { plan } = (await req.json().catch(() => ({}))) as { plan?: string };
  if (!plan || !(plan in PLANS)) return json({ error: "Please choose a plan." }, 400);

  try {
    const customer = await findOrCreateCustomer(s, user);
    const current = await planStatus(s, customer.id);
    if (current.plan === "plus") return json({ error: "You already have Still With You Plus." }, 409);
    const origin = new URL(req.url).origin;
    const session = await s.checkout.sessions.create({
      mode: "subscription",
      customer: customer.id,
      line_items: [{ price: await priceFor(s, plan as PlanKey), quantity: 1 }],
      // The free week is for first-time subscribers only.
      subscription_data: current.everSubscribed ? undefined : { trial_period_days: TRIAL_DAYS },
      allow_promotion_codes: true,
      success_url: `${origin}/app?plan=welcome`,
      cancel_url: `${origin}/app?plan=cancel`,
    });
    return json({ url: session.url });
  } catch (e) {
    console.error("checkout failed", e);
    return json({ error: "We couldn’t open checkout just now. Please try again." }, 500);
  }
}
