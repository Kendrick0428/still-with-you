"use client";
import { useEffect } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Snapshot = Record<string, unknown>;

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
