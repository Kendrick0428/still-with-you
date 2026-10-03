import { currentUser, findCustomer, json, planStatus, stripe } from "@/lib/billing";

// Tells the app whether the signed-in person has Still With You Plus.
export async function GET(req: Request) {
  const s = stripe();
  if (!s) return json({ available: false, plan: "free" });
  const user = await currentUser(req);
  if (!user) return json({ available: true, plan: "free" });
  try {
    const customer = await findCustomer(s, user);
    if (!customer) return json({ available: true, plan: "free" });
    return json({ available: true, ...(await planStatus(s, customer.id)) });
  } catch (e) {
    console.error("status failed", e);
    return json({ error: "We couldn’t check your plan just now." }, 500);
  }
}
