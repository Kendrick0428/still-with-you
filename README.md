# Still With You

A Christian grief companion web app. "You don't have to grieve alone."

## Routes

- `/` landing page with a waitlist signup
- `/app` the web app (onboarding, home, heart check-in, hard-day mode, prayers, journal prompt, practical help, settings). It can be installed to a phone's home screen.
- `/privacy` plain-language privacy page
- `/api/waitlist` stores waitlist emails

Everything a person enters in `/app` is saved only in their own browser (localStorage). Nothing is sent to a server yet.

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

## Where things live

- `app/app/device.html` and `public/swy-app.js`: the app screens (plain JavaScript, rendered on the client)
- `app/app/app.css`: the app's design tokens and styles
- `app/page.tsx`, `app/landing.css`: the landing page
