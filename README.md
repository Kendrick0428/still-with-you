# Still With You

A Christian grief companion web app. "You don't have to grieve alone."

## Routes

- `/` landing page with a waitlist signup
- `/app` the web app (onboarding, home, heart check-in, hard-day mode, prayers, journal prompt, practical help, settings). It can be installed to a phone's home screen.
- `/privacy` plain-language privacy page
- `/api/waitlist` stores waitlist emails

Without an account, everything a person enters in `/app` is saved only in their own browser (localStorage). With a free account (Supabase), the same entries sync to a private row in the `user_data` table that only that person can read. The app lock code is never uploaded.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deploy on Vercel

1. In Vercel, choose **Add New → Project**, import this GitHub repository, and click **Deploy**. No settings need changing.
2. To turn on the waitlist, open the project's **Storage** tab, add **Upstash for Redis** from the Marketplace, and connect it to the project. That sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`. Redeploy.
3. Read sign-ups in the Upstash console with `SMEMBERS waitlist`.

Until step 2 is done, the waitlist form politely says sign-ups aren't open yet.

## Turn on accounts (Supabase)

1. Create a Supabase project.
2. In **SQL Editor**, run `supabase/schema.sql`. It creates the `user_data` table with row level security.
3. In **Authentication → URL Configuration**, set the Site URL to the production address and add `https://<your-domain>/app` plus `https://*-kendrick0428.vercel.app/**` as redirect URLs.
4. In Vercel → Settings → Environment Variables, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (from Supabase's **Connect** button), then redeploy.

Until those variables exist, the app hides every account option and works on-device only.

## Where things live

- `app/app/device.html` and `public/swy-app.js`: the app screens (plain JavaScript, rendered on the client)
- `app/app/app.css`: the app's design tokens and styles
- `app/app/account-bridge.tsx`: sign-up, sign-in and sync, exposed to the app as `window.swyAccount`
- `supabase/schema.sql`: database table and privacy rules
- `app/page.tsx`, `app/landing.css`: the landing page
