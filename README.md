# Still With You

A Christian grief companion web app. "You don't have to grieve alone."

Live at https://still-with-you-iota.vercel.app

## Routes

- `/` landing page with a waitlist signup
- `/app` the web app (onboarding, home, heart check-in, hard-day mode, prayers, journal prompt, practical help, settings). It can be installed to a phone's home screen.
- `/privacy` plain-language privacy page
- `/api/waitlist` stores waitlist emails
- `/api/companion` the grief companion (streams a reply from Claude)

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
- `app/api/companion/route.ts`: the grief companion's instructions and safety rules

## Plans and payments (Stripe)

Still With You Plus is $6.99 a month or $49 a year, with a 7-day free trial for first-time subscribers. Hard-day mode, the daily prayer, journaling and crisis help stay free.

- Add `STRIPE_SECRET_KEY` in Vercel (use the `sk_test_…` key until you're ready to take real payments). Without it the app shows no plans and nothing is locked.
- The product and both prices are created in Stripe automatically the first time someone opens checkout (lookup keys `swy_plus_month` and `swy_plus_year`).
- "Manage my plan" opens Stripe's customer portal. In Stripe, open Settings → Billing → Customer portal and click Save once so it's turned on.
- The app asks Stripe directly whether the signed-in person has an active plan (`/api/billing/status`), so no webhook is needed.
- Routes: `/api/billing/checkout`, `/api/billing/status`, `/api/billing/portal`. Helpers are in `lib/billing.ts`.

To try checkout in test mode, use Stripe's test card `4242 4242 4242 4242` with any future date, any CVC and any ZIP.

## Memory Vault

Photos, videos (up to 50 MB), voice recordings, stories, sayings, recipes, songs, letters, special dates and favorite Scriptures, with a Memory of the Day on the home screen. Text memories sync with the rest of the account. Photos, videos and recordings are kept on the device (IndexedDB) and, when signed in, backed up to the private Supabase Storage bucket `vault`, one folder per person. `supabase/schema.sql` creates the bucket and its privacy rules.

Adding memories is part of Plus, but anyone who saved memories can always open them, even after a plan ends. In hard-day mode, "Help me remember" shows one saved memory (or a gentle prompt) for everyone.

## Audio library and Grief Journey

The words for both live in `public/swy-content.js`, loaded the first time either is opened. The audio library has 24 tracks (morning, evening and sleep prayers, Scripture meditations, guided breathing, grief encouragement, short devotionals, "Get through today" and "The next five minutes"), read aloud by the device's own voice one line at a time with quiet pauses, while the line being read is highlighted. People can pick a voice, slow it down, and save favorites. Grief Journey has 18 guides that can be opened in any order; none are stages.

Both are part of Plus, except "The next five minutes" (also offered in hard-day mode) and the guides "The first 7 days" and "When other people stop checking on you", which are free for everyone.

To use real recordings (for example in the pastor's own voice): save each as an MP3 in `public/audio/` and add `file: 'name.mp3'` to that track in `public/swy-content.js`. The player then plays the recording, with a progress bar and 15-second skips, instead of the device voice.

## Memory book

From the Memory Vault, "Make a keepsake book" gathers memories (for one person or everyone, all or only favorites; letters only if chosen) into a book with a cover, one page per memory with its photo, and a closing Scripture. "Save as PDF or print" uses the browser's print, with print styles that give each memory its own page. Part of Plus.

## Important dates

"Important dates" (home screen, under More ways we can help) keeps birthdays, anniversaries of a passing, wedding anniversaries, traditions, and holidays (Mother's Day, Father's Day, Thanksgiving, Christmas, worked out each year). Keeping the list is free. Gentle reminders are part of Plus, never turned on automatically, and chosen one date at a time (the day before, 3 days before, or a week before). When one is due, the home screen shows a gentle note with "Help me plan", which offers ways to honor the day, a prayer, and links to support. "Add to my phone's calendar" posts the date to `/api/calendar`, which returns a yearly calendar event with an alert before it and stores nothing. Dates sync with the account like everything else (`dates` in the snapshot).

## Backup and sync

Free accounts already sync everything to `user_data`. Plus adds, under Settings → Backup and sync:

- A restore point each day the app is opened (kept 30 days) and ones made by hand (the newest 10 are kept), in the `user_backups` table with row level security, so each person sees only their own. Restoring first saves a restore point of how things are now.
- Companion conversations sync across devices.
- Photos and recordings a Plus member deletes stay in their private `vault` folder for 30 days, so restoring an earlier copy brings them back.
- "Download everything": one file with all entries plus photos, videos and recordings, which "Restore from a file" brings back on any device.

`supabase/schema.sql` includes the `user_backups` table.

## Grief companion

A private conversation with Claude, written to listen first, avoid grief clichés and timelines, offer prayer and Scripture when it fits, and point to 988 when someone may be in danger. The app also shows a 988 card on its own when a message mentions self-harm, before any reply.

- Add `ANTHROPIC_API_KEY` in Vercel (from console.anthropic.com → API keys). Without it, the companion says it isn't turned on yet.
- Optional: `COMPANION_MODEL` to use a different Claude model (default `claude-opus-5-5`).
- When accounts and plans are on, only signed-in Plus members can use it, checked on the server. With Upstash connected, each person is limited to 150 messages a day.
- Conversations are kept only on the person's device. Hard-day mode's "Let me talk" opens the companion for Plus members and a free private writing space for everyone else.

## Owner dashboard (`/admin`)

A private page showing monthly recurring revenue, money collected by month, Plus subscribers (paying, in trial, cancelling, failed payments), recent payments and newest subscribers, read live from Stripe. Only Still With You Plus subscriptions are counted, even if the Stripe account sells other things.

- `ADMIN_EMAILS`: comma-separated emails allowed in (required; with it unset nobody can open the page). The account must exist in the app and its email must be confirmed.
- `SUPABASE_SERVICE_ROLE_KEY` (optional): also shows how many accounts have signed up. Keep this key server-only; never prefix it with `NEXT_PUBLIC_`.
- Route: `/api/admin/stats`. Helpers are in `lib/admin.ts`.

### Accounting tab

The **Accounting** tab on `/admin` adds up a year on a cash basis: Plus sales, refunds and Stripe fees (from Stripe), plus business expenses you log there (one-time or monthly, such as Vercel, Supabase, Anthropic or the domain). It shows net profit month by month, an estimated amount to set aside for taxes (a percentage you choose, 25% by default) split by the IRS estimated-payment dates, and exports everything as a CSV for a CPA or a printable PDF. The tax figure is an estimate for saving, not tax advice.

Expenses and the set-aside rate live in the `admin_expenses` and `admin_settings` tables in `supabase/schema.sql`, visible only to the owner's own account.
