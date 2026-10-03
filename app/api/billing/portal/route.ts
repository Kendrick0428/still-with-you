import { currentUser, findCustomer, json, stripe } from "@/lib/billing";

// Opens Stripe's page for changing the plan, updating the card, or canceling.
export async function POST(req: Request) {
  const s = stripe();
  if (!s) return json({ error: "Plans aren’t available yet." }, 503);
  const user = await currentUser(req);
  if (!user) return json({ error: "Please sign in first." }, 401);
  try {
    const customer = await findCustomer(s, user);
    if (!customer) return json({ error: "There’s no plan on this account yet." }, 404);
    const session = await s.billingPortal.sessions.create({ customer: customer.id, return_url: `${new URL(req.url).origin}/app?plan=manage` });
    return json({ url: session.url });
  } catch (e) {
    console.error("portal failed", e);
    return json({ error: "We couldn’t open your plan settings just now. Please try again." }, 500);
  }
}
