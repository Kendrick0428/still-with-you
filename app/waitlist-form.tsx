"use client";
import { useState } from "react";

export default function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    try {
      const res = await fetch("/api/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setState("done");
      setMessage("Thank you. We’ll write when it’s ready, and only then.");
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  if (state === "done") return <p className="l-thanks">{message}</p>;
  return (
    <form className="l-form" onSubmit={submit}>
      <label htmlFor="wl-email" className="sr-only">Email address</label>
      <input id="wl-email" type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      <button className="l-btn" disabled={state === "sending"}>{state === "sending" ? "Joining…" : "Join the waitlist"}</button>
      {state === "error" && <p className="l-error" role="alert">{message}</p>}
    </form>
  );
}
