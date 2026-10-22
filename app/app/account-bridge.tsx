"use client";
import { useEffect } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Snapshot = Record<string, unknown>;
type Backup = { id: string; auto: boolean; label: string | null; created_at: string };
type Plan = { available: boolean; plan: "free" | "plus"; status?: string; interval?: string | null; trialEnds?: number | null; renews?: number | null; cancelsAtEnd?: boolean; error?: string };

declare global {
  interface Window {
    swyAccount?: {
      enabled: boolean;
      email: () => string | null;
      signUp: (email: string, password: string) => Promise<{ error?: string; needsConfirm?: boolean }>;
      signIn: (email: string, password: string) => Promise<{ error?: string }>;
      resetPassword: (email: string) => Promise<{ error?: string }>;
      updatePassword: (password: string) => Promise<{ error?: string }>;
      authLink: () => "recovery" | "expired" | null;
      signOut: () => Promise<void>;
      pull: () => Promise<Snapshot | null>;
      push: (data: Snapshot) => Promise<void>;
      deleteData: () => Promise<{ error?: string }>;
      plan: () => Promise<Plan>;
      checkout: (plan: "month" | "year") => Promise<{ error?: string }>;
      managePlan: () => Promise<{ error?: string }>;
      uploadMedia: (id: string, blob: Blob) => Promise<{ error?: string }>;
      mediaUrl: (id: string) => Promise<string | null>;
      removeMedia: (id: string) => Promise<void>;
      companion: (body: unknown, onText: (t: string) => void) => Promise<{ error?: string }>;
      backups: {
        list: () => Promise<Backup[] | null>;
        save: (data: Snapshot, auto: boolean, label?: string) => Promise<{ error?: string }>;
        get: (id: string) => Promise<Snapshot | null>;
        prune: () => Promise<void>;
      };
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
    // Read what an email link brought us here for before Supabase consumes the address.
    const hash = new URLSearchParams(location.hash.slice(1));
    let link: "recovery" | "expired" | null = hash.get("type") === "recovery" ? "recovery" : hash.get("error_code") ? "expired" : null;
    if (link === "expired") history.replaceState(null, "", location.pathname + location.search);
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
        sb.auth.onAuthStateChange((event, session) => {
          if (event === "PASSWORD_RECOVERY" && link !== "recovery") { link = "recovery"; window.dispatchEvent(new Event("swy-auth-link")); }
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
        async updatePassword(p) {
          if (!sb) return { error: "Accounts aren’t available yet." };
          const { error } = await sb.auth.updateUser({ password: p });
          if (!error) link = null;
          return error ? { error: friendly(error.message) } : {};
        },
        authLink: () => { const l = link; if (l === "expired") link = null; return l; },
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
        // Memory Vault photos, videos and recordings live in a private bucket, one folder per person.
        async uploadMedia(id, blob) {
          if (!sb || !userId) return { error: "You’re not signed in." };
          const { error } = await sb.storage.from("vault").upload(`${userId}/${id}`, blob, { contentType: blob.type || undefined, upsert: true });
          if (error) console.error("Couldn’t upload memory", error);
          return error ? { error: "We couldn’t back this up just now. It’s still saved on this device." } : {};
        },
        async mediaUrl(id) {
          if (!sb || !userId) return null;
          const { data } = await sb.storage.from("vault").createSignedUrl(`${userId}/${id}`, 3600);
          return data?.signedUrl ?? null;
        },
        async removeMedia(id) {
          if (sb && userId) await sb.storage.from("vault").remove([`${userId}/${id}`]);
        },
        // Streams the grief companion's reply, calling onText with each new piece of text.
        async companion(body, onText) {
          try {
            const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
            const res = await fetch("/api/companion", {
              method: "POST",
              headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
              body: JSON.stringify(body),
            });
            if (!res.ok || !res.body) {
              const r = await res.json().catch(() => ({}));
              return { error: (r as { error?: string }).error || "I couldn’t answer just now. Please try again in a moment." };
            }
            const reader = res.body.getReader();
            const dec = new TextDecoder();
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              onText(dec.decode(value, { stream: true }));
            }
            return {};
          } catch {
            return { error: "We couldn’t reach Still With You just now. Please check your connection." };
          }
        },
        // Plus restore points in the user_backups table, private to each person (see supabase/schema.sql).
        backups: {
          async list() {
            if (!sb || !userId) return null;
            const { data, error } = await sb.from("user_backups").select("id, auto, label, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(60);
            if (error) { console.error("Couldn’t list restore points", error); return null; }
            return data as Backup[];
          },
          async save(data, auto, label) {
            if (!sb || !userId) return { error: "You’re not signed in." };
            const { error } = await sb.from("user_backups").insert({ user_id: userId, data, auto, label: label ?? null });
            if (error) console.error("Couldn’t save restore point", error);
            return error ? { error: "We couldn’t make a backup just now. Please try again in a moment." } : {};
          },
          async get(id) {
            if (!sb || !userId) return null;
            const { data } = await sb.from("user_backups").select("data").eq("id", id).eq("user_id", userId).maybeSingle();
            return (data?.data as Snapshot) ?? null;
          },
          // Daily restore points are kept for 30 days; ones made by hand are kept until there are more than 10.
          async prune() {
            if (!sb || !userId) return;
            await sb.from("user_backups").delete().eq("user_id", userId).eq("auto", true).lt("created_at", new Date(Date.now() - 30 * 864e5).toISOString());
            const { data } = await sb.from("user_backups").select("id").eq("user_id", userId).eq("auto", false).order("created_at", { ascending: false }).range(10, 100);
            if (data?.length) await sb.from("user_backups").delete().in("id", data.map((b) => b.id));
          },
        },
        async deleteData() {
          if (!sb || !userId) return { error: "You’re not signed in." };
          await sb.from("user_backups").delete().eq("user_id", userId);
          const { error } = await sb.from("user_data").delete().eq("user_id", userId);
          const { data: files } = await sb.storage.from("vault").list(userId, { limit: 1000 });
          if (files?.length) await sb.storage.from("vault").remove(files.map((f) => `${userId}/${f.name}`));
          return error ? { error: "We couldn’t delete your data just now. Please try again." } : {};
        },
      };
      window.dispatchEvent(new Event("swy-account-ready"));
    };
    ready();
  }, []);
  return null;
}
