# Deploying Drill's sync API

The worker in this folder is built and tested locally (`npm ci && npm test`, `npm run dev`). Putting it
online needs Joseph: an account, DNS and one deploy. Everything is on Cloudflare's free plan.

There are **no secrets to set**. Devices derive their own tokens from their recovery code and the
server stores only SHA-256 hashes of them, so nothing secret lives in the worker or its config.

## 1. Cloudflare account

1. Sign up at <https://dash.cloudflare.com/sign-up> (free plan; no card needed).
2. Turn on two-factor authentication: profile icon → My Profile → Authentication.

## 2. Move knowhowit.com.au's DNS from FreeDNS to Cloudflare

The API has to live at `api.knowhowit.com.au`, an address we own. Workers can only serve a custom
domain on a zone Cloudflare runs (a CNAME to `workers.dev` doesn't work), so the domain's DNS moves.

1. Before anything, write down every record FreeDNS has for knowhowit.com.au (FreeDNS → Subdomains,
   and the domain's own records). At least the GitHub Pages ones:
   - `knowhowit.com.au` A → 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153
     (and AAAA 2606:50c0:8000::153 … 8003::153 if FreeDNS has them)
   - `www` CNAME → joebywan.github.io
   - any MX/TXT records (mail, domain verification).
2. Cloudflare dashboard → **Add a domain** → `knowhowit.com.au` → Free plan. Cloudflare scans
   the current records. Compare with the list from step 1 and add anything missing.
3. Set the GitHub Pages records to **DNS only** (grey cloud), so GitHub keeps issuing the site's
   certificate as it does today.
4. Cloudflare shows two nameservers (like `xxx.ns.cloudflare.com`). At the **registrar** for
   knowhowit.com.au (where the domain was bought, not FreeDNS), replace the nameservers with those two.
   .com.au changes usually apply within a few hours, at most 48.
5. Wait for Cloudflare to mark the domain **Active** (it emails you). Check the site still loads:
   <https://knowhowit.com.au/drill/>.
6. Then remove the domain from FreeDNS.

## 3. Database and deploy

From this folder (`server/`), on your machine:

```bash
npm ci
npx wrangler@4.156.0 login                    # opens the browser to authorise wrangler
npx wrangler@4.156.0 d1 create drill-sync     # prints a database_id
```

Paste that `database_id` into `wrangler.toml` (replacing `REPLACE_WITH_DATABASE_ID`), commit it
(it isn't secret), then:

```bash
npx wrangler@4.156.0 d1 migrations apply drill-sync --remote   # creates the tables from migrations/
npx wrangler@4.156.0 deploy
```

## 4. The `api.` route

`wrangler.toml` already declares the route:

```toml
[[routes]]
pattern = "api.knowhowit.com.au"
custom_domain = true
```

With the zone active (step 2), `wrangler deploy` creates the `api` DNS record and its certificate
itself. Nothing to add by hand. `workers_dev = false` keeps the worker off `*.workers.dev`.

## 5. Check it

```bash
curl -i -X OPTIONS https://api.knowhowit.com.au/v1/progress   # 204, Access-Control-Allow-Origin: *
curl -i https://api.knowhowit.com.au/v1/progress              # 401 {"error":"no token"}
```

Then in Drill (the merged PR, published by the Pages workflow): ⋯ → Friends → Turn on sync, and a
friend code appears. Watch requests and errors in the dashboard: Workers & Pages → drill-sync → Logs.

## Later changes

- **Schema:** add `migrations/0002_….sql`, then `npx wrangler@4.156.0 d1 migrations apply drill-sync --remote`
  before deploying code that needs it. Never edit a migration that has been applied.
- **Code:** `npx wrangler@4.156.0 deploy` from `server/`.
- **Restore:** D1 Time Travel restores the database to any minute in the last 7 days on the free plan
  (`npx wrangler@4.156.0 d1 time-travel restore drill-sync --timestamp=…`).

## Limits and costs

Free plan: 100,000 worker requests a day, 5 GB of D1 storage, 5 million D1 row reads a day. Past
those, requests fail; nothing is billed. Workers Paid ($5/month) is the next step. One D1 database
holds up to 10 GB, about 200,000 learners at ~50 KB each.

## Play Store and privacy

- Privacy policy: <https://knowhowit.com.au/drill/privacy.html> (from `privacy.html`, published with the site).
- Data deletion URL for the Play Console's Data safety form: <https://knowhowit.com.au/drill/privacy.html#delete>
  (delete with a recovery code, no app needed). In the app: ⋯ → Delete my data.
- Data safety answers: no data collected unless sync is on; then app activity (encrypted, not readable
  by us), and a user ID (the friend code). Not shared, not sold, encrypted in transit, deletable.
- The Android wrapper has no internet permission and keeps it that way: with its bridge
  (`DrillBridge`) present, the ⋯ sync section is hidden and sync never runs. Allowing sync in the APK
  is a decision for Joseph (it needs `android.permission.INTERNET` and the section shown again).

## Known gaps

- **No QR code.** Pairing is a 6-digit code only. A QR code carrying the recovery code itself would
  never touch the server.
- **Pairing strength.** A 6-digit code is a million possibilities. The recovery code it carries is
  wrapped with PBKDF2 (200,000 rounds) under that code, so the server itself (or anyone who took
  its database) could try every code within the 10 minutes the pairing lives. Outsiders can't: a
  code works once and claims are limited to 10 per IP per 10 minutes. A QR code would close it.
