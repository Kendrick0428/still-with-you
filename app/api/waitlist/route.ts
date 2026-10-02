import { NextResponse } from "next/server";

// Stores waitlist emails in a Redis set via the Upstash REST API.
// On Vercel, add an Upstash Redis store from the Marketplace; it sets KV_REST_API_URL and KV_REST_API_TOKEN.
export async function POST(req: Request) {
  let email = "";
  try {
    ({ email } = await req.json());
  } catch {
    return NextResponse.json({ error: "Please enter your email address." }, { status: 400 });
  }
  email = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return NextResponse.json({ error: "That email address doesn’t look right. Please check it and try again." }, { status: 400 });
  }

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    console.warn("Waitlist storage is not configured; set KV_REST_API_URL and KV_REST_API_TOKEN.");
    return NextResponse.json({ error: "Sign-ups aren’t open yet. Please check back soon." }, { status: 503 });
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(["SADD", "waitlist", email]),
  });
  if (!res.ok) {
    console.error("Waitlist write failed", res.status, await res.text());
    return NextResponse.json({ error: "We couldn’t save your email just now. Please try again in a moment." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
