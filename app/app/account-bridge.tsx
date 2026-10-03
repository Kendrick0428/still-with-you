"use client";
import { useEffect } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Snapshot = Record<string, unknown>;
type Plan = { available: boolean; plan: "free" | "plus"; status?: string; interval?: string | null; trialEnds?: number | null; renews?: number | null; cancelsAtEnd?: boolean; error?: string };

declare global {
  interface Window {
    swyAccount?: {
      enabled: boolean;
      email: () => string | null;
      signUp: (email: string, password: string) => Promise<{ error?: string; needsConfirm?: boolean }>;
      signIn: (email: string, password: string) => Promise<{ error?: string }>;
      resetPassword: (email: string) => Promise<{ error?: string }>;
      signOut: () => Promise<void>;
      pull: () => Promise<Snapshot | null>;
      push: (data: Snapshot) => Promise<void>;
      deleteData: () => Promise<{ error?: string }>;
      plan: () => Promise<Plan>;
      checkout: (plan: "month" | "year") => Promise<{ error?: string }>;
      managePlan: () => Promise<{ error?: string }>;
    };
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Plain-language messages for the auth errors people actually hit.
function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "That email and password don’t match. Please try again.";
  if (m.includes("already registered")) return "There’s already an account with that email. Try signing in instead.";
  if (m.includes("password")) return "Please use a password with at least 8 characters.";
  if (m.includes("email not confirmed")) return "Please confirm your email first. Check your inbox for a link from us.";
  if (m.includes("rate limit")) return "Too many tries in a short time. Please wait a minute and try again.";
  return "Something went wrong. Please try again in a moment.";
}

// Exposes a small account API to the app screens in public/swy-app.js.
export default function AccountBridge() {
  useEffect(() => {
    let sb: SupabaseClient | null = null;
    let email: string | null = null;
    let userId: string | null = null;
    if (url && key) sb = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });

    // Calls the billing routes with the signed-in person's token so the server knows who is asking.
    const billing = async (path: string, method: string, body?: unknown): Promise<Record<string, unknown>> => {
      try {
        const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
        const res = await fetch(`/api/billing/${path}`, {
          method,
          headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
          body: body ? JSON.stringify(body) : undefined,
        });
        return await res.json();
      } catch {
        return { error: "We couldn’t reach Still With You just now. Please check your connection." };
      }
    };

    const ready = async () => {
      if (sb) {
        const { data } = await sb.auth.getSession();
        email = data.session?.user.email ?? null;
        userId = data.session?.user.id ?? null;
        sb.auth.onAuthStateChange((_e, session) => {
          email = session?.user.email ?? null;
          userId = session?.user.id ?? null;
        });
      }
      window.swyAccount = {
        enabled: !!sb,
        email: () => email,
        async signUp(e, p) {
          if (!sb) return { error: "Accounts aren’t available yet." };
          const { data, error } = await sb.auth.signUp({ email: e, password: p, options: { emailRedirectTo: `${location.origin}/app` } });
          if (error) return { error: friendly(error.message) };
          return { needsConfirm: !data.session };
        },
        async signIn(e, p) {
          if (!sb) return { error: "Accounts aren’t available yet." };
          const { error } = await sb.auth.signInWithPassword({ email: e, password: p });
          return error ? { error: friendly(error.message) } : {};
        },
        async resetPassword(e) {
          if (!sb) return { error: "Accounts aren’t available yet." };
          const { error } = await sb.auth.resetPasswordForEmail(e, { redirectTo: `${location.origin}/app` });
          return error ? { error: friendly(error.message) } : {};
        },
        async signOut() { if (sb) await sb.auth.signOut(); },
        async pull() {
          if (!sb || !userId) return null;
          const { data, error } = await sb.from("user_data").select("data").eq("user_id", userId).maybeSingle();
          if (error) { console.error("Couldn’t load account data", error); return null; }
          return (data?.data as Snapshot) ?? null;
        },
        async push(data) {
          if (!sb || !userId) return;
          const { error } = await sb.from("user_data").upsert({ user_id: userId, data, updated_at: new Date().toISOString() });
          if (error) console.error("Couldn’t save account data", error);
        },
        async plan() {
          const r = await billing("status", "GET");
          return r.error ? { available: false, plan: "free", error: String(r.error) } : (r as Plan);
        },
        async checkout(plan) {
          const r = await billing("checkout", "POST", { plan });
          if (r.url) { location.href = r.url as string; return {}; }
          return { error: (r.error as string) || "We couldn’t open checkout just now. Please try again." };
        },
        async managePlan() {
          const r = await billing("portal", "POST");
          if (r.url) { location.href = r.url as string; return {}; }
          return { error: (r.error as string) || "We couldn’t open your plan settings just now. Please try again." };
        },
        async deleteData() {
          if (!sb || !userId) return { error: "You’re not signed in." };
          const { error } = await sb.from("user_data").delete().eq("user_id", userId);
          return error ? { error: "We couldn’t delete your data just now. Please try again." } : {};
        },
      };
      window.dispatchEvent(new Event("swy-account-ready"));
    };
    ready();
  }, []);
  return null;
}
