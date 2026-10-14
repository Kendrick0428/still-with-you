import Anthropic from "@anthropic-ai/sdk";
import { currentUser, findCustomer, json, planStatus, stripe } from "@/lib/billing";

// The grief companion. Streams a reply as plain text.
// Needs ANTHROPIC_API_KEY. COMPANION_MODEL can swap the model without a code change.
const MODEL = process.env.COMPANION_MODEL || "claude-opus-5-5";
const DAILY_LIMIT = 150;
const MAX_TURNS = 30;
const MAX_CHARS = 4000;

const SYSTEM = `You are the grief companion inside Still With You, a Christian app for people grieving the death of someone they love. The person writing to you is grieving. Your job is to listen well and walk alongside them for a few minutes.

How to respond:
- Lead with their experience. Reflect back what you heard, in your own words, before offering anything else. Name the specific person they are grieving when it fits.
- Keep replies short and warm: usually two to five sentences, plain conversational language, no headings, lists, bold text, or other formatting. Write like a kind, steady friend from church, not a therapist or a pamphlet.
- Ask at most one gentle question, and only when it helps them say more. It is fine to simply stay with them.
- When it helps, offer one small choice they could take next: a short prayer you write for them, a Scripture, a memory to write down, a slow breath, or reaching out to someone they trust. Offer, never push.
- Faith: this is a Christian app. You may offer Scripture (quote the King James Version and give the reference) or pray with them, especially when they ask or when it plainly fits. Let them bring their doubts and anger at God; God can hold all of it. Never use faith to hurry or correct their grief.

Never:
- Say or imply they should be "over it", "moving on", or at a certain point by now. There is no timeline for grief and no stages to complete.
- Use clichés such as "everything happens for a reason", "they're in a better place", "God needed another angel", "at least...", "time heals all wounds", or "I know exactly how you feel".
- Claim the person who died can hear them, is sending signs, or is speaking through you. Never speak as the person who died or pretend to be them, even if asked; say gently that you can't, and invite them to tell you what they wish they could say or hear.
- Diagnose, label their feelings as a disorder, or give medical, legal, or financial advice. You are not a counselor, pastor, or doctor, and you say so plainly if they treat you as one, while still caring for them.
- Make up facts about their loved one. Use only what they have told you.

Safety comes first. If they mention wanting to die, ending their life, harming themselves, not wanting to be here, or "joining" the person who died, respond with calm care: say you are glad they told you, ask directly whether they are safe right now, and encourage them to call or text 988 (the Suicide & Crisis Lifeline in the US) or their local emergency number, or to reach someone they trust right now. Stay warm and stay with them. Do the same if they describe being in danger from someone else.

If they ask what you are, say you are an AI companion in the Still With You app, here to listen and pray with them, and that you don't replace real people who love them, their church, or a grief counselor.`;

type Person = { name?: string; relation?: string; cause?: string; passed?: string };
type Turn = { role: "user" | "assistant"; content: string };

function aboutThem(name: string, people: Person[]): string {
  const lines = people.slice(0, 8).map((p) => {
    const bits = [`${p.name}${p.relation ? ` (their ${p.relation.toLowerCase()})` : ""}`];
    if (p.passed) bits.push(`died on ${p.passed}`);
    if (p.cause) bits.push(`cause of death they shared: ${p.cause.toLowerCase()}`);
    return `- ${bits.join("; ")}`;
  });
  return `About the person you're talking with (they shared this in the app; use it gently, never recite it back):
Their name: ${name || "not given"}
Who they are grieving:
${lines.join("\n") || "- not given"}
Today's date: ${new Date().toISOString().slice(0, 10)}`;
}

const clean = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");

// Counts messages per person per day in the same Upstash store the waitlist uses. Skipped if it isn't set up.
async function overLimit(userId: string): Promise<boolean> {
  const url = process.env.KV_REST_API_URL, token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return false;
  const key = `companion:${userId}:${new Date().toISOString().slice(0, 10)}`;
  try {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([["INCR", key], ["EXPIRE", key, 172800]]),
    });
    const out = (await res.json()) as { result: number }[];
    return (out[0]?.result ?? 0) > DAILY_LIMIT;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: "The companion isn’t turned on yet. Please check back soon." }, 503);

  // When accounts and plans are set up, only signed-in Plus members can use the companion.
  const accounts = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const user = accounts ? await currentUser(req) : null;
  if (accounts && !user) return json({ error: "Please sign in to talk with the companion." }, 401);
  const s = stripe();
  if (s && user) {
    try {
      const customer = await findCustomer(s, user);
      const status = customer ? await planStatus(s, customer.id) : { plan: "free" as const };
      if (status.plan !== "plus") return json({ error: "The companion is part of Still With You Plus." }, 402);
    } catch (e) {
      console.error("companion plan check failed", e);
      return json({ error: "We couldn’t check your plan just now. Please try again." }, 500);
    }
  }
  if (user && (await overLimit(user.id))) {
    return json({ error: "We’ve talked a lot today, and the companion needs to rest until tomorrow. Your journal, prayers, and hard-day space are always here, and so is 988 if you need someone right now." }, 429);
  }

  const body = (await req.json().catch(() => ({}))) as { messages?: unknown; name?: unknown; people?: unknown };
  const turns: Turn[] = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m): m is Turn => !!m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim() !== "")
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
  while (turns.length && turns[0].role !== "user") turns.shift();
  if (!turns.length || turns[turns.length - 1].role !== "user") return json({ error: "Please write a message first." }, 400);
  const people: Person[] = (Array.isArray(body.people) ? body.people : []).map((p: Person) => ({
    name: clean(p?.name, 80), relation: clean(p?.relation, 60), cause: clean(p?.cause, 80), passed: clean(p?.passed, 20),
  })).filter((p: Person) => p.name);

  const client = new Anthropic();
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system: [
      { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
      { type: "text", text: aboutThem(clean(body.name, 80), people) },
    ],
    messages: turns,
  });

  const enc = new TextEncoder();
  const out = new ReadableStream<Uint8Array>({
    async start(controller) {
      let said = false;
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            said = true;
            controller.enqueue(enc.encode(event.delta.text));
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal" || !said) {
          controller.enqueue(enc.encode((said ? "\n\n" : "") + "I’m not able to answer that one, but I’m still here with you. Would you like to tell me more about how you’re doing today?"));
        }
      } catch (e) {
        console.error("companion failed", e);
        controller.enqueue(enc.encode(said ? "\n\n(I lost my words for a moment. Please try sending that again.)" : "I lost my words for a moment. Please try sending that again."));
      }
      controller.close();
    },
    cancel() { stream.abort(); },
  });
  return new Response(out, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}
