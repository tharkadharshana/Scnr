# Manual setup: email sign-up, professional email and a branded Google sign-in

Written for: the Scnr owner, who does the steps that need a dashboard login.

This is everything that cannot be done from code. The code changes (email and password sign-up, verification, password reset, `EMAIL_FROM`, domain-from-env) ship in their own pull requests. Steps marked **needs code PR** can only be finished or tested once that PR is merged. Everything else can start today.

Menu names in Resend, Supabase, Cloudflare and Google change now and then. If a label below does not match, look for the closest one. The settings themselves stay the same.

Examples use `tharkak.com` and `mail.tharkak.com`. If you change domain later, see part 8.

## Order of work

| Step | Where | Can start now |
|---|---|---|
| 1. Pick the sending domain | decision | yes |
| 2. Verify the domain in Resend | Resend + Cloudflare DNS | yes |
| 3. Connect Supabase to Resend (SMTP) | Supabase | yes, after step 2 |
| 4. Turn on email sign-up and set URLs | Supabase | yes |
| 5. Paste the email templates | Supabase | needs code PR (templates ship in `docs/email-templates/`) |
| 6. Set the app's own mail variables | Vercel, `.env`, GitHub | yes |
| 7. Fix the Google sign-in screen | Google Cloud, optionally Supabase | yes |
| 8. Later: changing the domain | checklist | reference |
| 9. Final test | browser, Gmail | after steps 2 to 6 and the code PR |

Time: about 1 hour of work. DNS can take up to an hour to be seen. Google verification takes days, but it runs in the background.

---

## 1. Pick the sending domain

Send mail from a subdomain, not the root domain. Use `mail.tharkak.com`. Reason: if a mailbox provider ever marks the mail as spam, only the subdomain's reputation suffers, and the root domain, which carries your website, stays clean.

Sender addresses you will use:

- `Scnr <no-reply@mail.tharkak.com>` for sign-in mail (verification, password reset).
- `Scnr <digest@mail.tharkak.com>` for the weekly digest and form notifications.

Both can share the one verified subdomain.

## 2. Verify the domain in Resend

Resend is already the app's mail provider (`sendEmail` in `server/index.ts`). It also supplies the SMTP service for Supabase.

1. Sign in at resend.com. Open **Domains**, then **Add Domain**.
2. Domain name: `mail.tharkak.com`. Region: pick the one closest to your users (Singapore, if offered, otherwise the nearest).
3. Resend shows a table of DNS records. They are normally:
   - **DKIM**: a `TXT` record named `resend._domainkey.mail` with a long value.
   - **SPF**: a `TXT` record on the `send.mail` name with value `v=spf1 include:amazonses.com ~all`.
   - **MX**: an `MX` record on the `send.mail` name pointing to an Amazon SES feedback host, priority 10.

   Copy the names and values exactly as Resend shows them. Do not retype them from this document.
4. Open Cloudflare, **tharkak.com**, **DNS**, **Records**. Add each record. Cloudflare adds the domain suffix itself, so enter only the part before `.tharkak.com`. If Cloudflare shows a proxy cloud on any of them, set it to **DNS only** (grey cloud). Mail records must never be proxied.
5. Back in Resend, press **Verify DNS Records**. Wait until all rows say **Verified**. This can take a few minutes up to an hour.
6. Add the DMARC record. Without it, Gmail and Yahoo treat bulk mail more harshly. In Cloudflare add a `TXT` record:
   - Name: `_dmarc`
   - Value: `v=DMARC1; p=none; rua=mailto:dmarc@tharkak.com`

   `p=none` only reports and does not block. After one to two weeks of clean reports, change it to `p=quarantine`. The `rua` address must be a mailbox you can read. If you have no mailbox on `tharkak.com`, use a Gmail address instead, or use a free DMARC report service and paste the address it gives you.
7. In Resend open **API Keys** and create **two** keys, so one can be revoked without breaking the other:
   - `scnr-supabase-smtp`, permission **Sending access**, domain `mail.tharkak.com`.
   - `scnr-app`, permission **Sending access**, domain `mail.tharkak.com`.

   Resend shows each key once. Store them in your password manager now.

Check: in Resend, the domain status is **Verified** and the DKIM, SPF and MX rows are green.

## 3. Connect Supabase to Resend (custom SMTP)

Why: Supabase's built-in mail sender is for testing only. It is limited to a few mails per hour, uses a shared sender and often lands in spam. Real users will not receive verification mail reliably without this step.

1. Supabase dashboard, your project, **Authentication**, **Emails** (older layout: **Settings**, **SMTP Settings**). Open **SMTP Settings** and turn on **Enable Custom SMTP**.
2. Fill in:
   - Sender email: `no-reply@mail.tharkak.com`
   - Sender name: `Scnr`
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: the `scnr-supabase-smtp` key from step 2.7
3. Save.
4. Open **Authentication**, **Rate Limits**. Raise **Rate limit for sending emails** to something sensible, for example 60 per hour to start. With the default Supabase limit lifted by custom SMTP, this value is yours to set.

Check: use **Send test email** if Supabase offers it, or finish step 9.

## 4. Turn on email sign-up and set the URLs

1. **Authentication**, **Providers**, **Email**: turn the provider **on**. Turn **Confirm email** **on**. This is the setting that stops anyone using an address they do not own. Leave **Secure email change** on.
2. Set a minimum password length of 8 under the password settings. Turn on **Leaked password protection** if your plan offers it.
3. **Authentication**, **URL Configuration**:
   - **Site URL**: `https://scnr.tharkak.com`
   - **Redirect URLs**: add `https://scnr.tharkak.com/**`. Add `http://localhost:5173/**` too if you test locally. Remove any old entries you do not recognise.

   The Site URL is what email links point to. It is the one place to change if the domain changes.
4. **Authentication**, **Sign In / Providers**, check that **Allow new users to sign up** is on.

## 5. Paste the email templates (needs code PR)

The code PR adds ready-made HTML files in `docs/email-templates/`: Confirm signup, Reset password and Change email. They use Supabase's own `{{ .ConfirmationURL }}` and `{{ .SiteURL }}`, never a typed domain, and include a plain-text link under the button.

1. **Authentication**, **Emails**, **Templates**.
2. For each template, set the **Subject** and paste the matching HTML file into the body:
   - Confirm signup: subject `Confirm your Scnr account`
   - Reset password: subject `Reset your Scnr password`
   - Change email address: subject `Confirm your new email for Scnr`
3. Save each one.

Rules these templates follow, so mail apps do not block them: one clear purpose, a real company name and sender, no link shorteners, no tracking pixels, no big images, a plain-text fallback link, and a short reason line ("You received this because someone signed up with this address").

## 6. Set the app's own mail variables

The app sends two kinds of mail itself through the Resend API: the weekly digest and form-answer notifications. Today it falls back to `digest@scnr.app`, a domain nobody verified, so those mails do not send correctly. The code PR for domain-from-env removes that fallback. Set these:

| Variable | Value | Where |
|---|---|---|
| `RESEND_API_KEY` | the `scnr-app` key from step 2.7 | Vercel, local `.env` |
| `EMAIL_FROM` | `Scnr <digest@mail.tharkak.com>` | Vercel, local `.env` |
| `APP_URL` | `https://scnr.tharkak.com` | Vercel, local `.env` (already set, confirm it) |

Vercel: project, **Settings**, **Environment Variables**. Add for **Production** (and Preview if you test mail there). Then **redeploy** (Deployments, latest, **Redeploy**), because env changes only apply to new deployments.

Never put these under a name that starts with `VITE_`. Those are published inside the public website code.

Keep `DIGEST_FROM` as it is until the code PR lands. The code reads `EMAIL_FROM` first and falls back to `DIGEST_FROM`.

Also, one security item found while exploring: the folder contains `.env.vercel-backup.*` and `.env.backup-*` files with real keys in plain text. They are ignored by git, so they are not in the repository, but delete the ones you no longer need and rotate any key you ever pasted into a chat or ticket.

## 7. Fix the Google sign-in screen

Today Google shows "to continue to `noqstzknowdtpsiafdxw.supabase.co`". That text is the address Google redirects back to, which is your Supabase project. There are two fixes. Do **A** now. Do **B** when you are on the Supabase Pro plan.

### A. Brand the consent screen (free, takes days to verify)

Once Google verifies the branding, the chooser says "to continue to **Scnr**" with your logo, instead of the raw address.

1. Prerequisite: your site needs a public **Privacy Policy** and **Terms** page. You already have `/legal/privacy-policy` and `/legal/terms-and-conditions`.
2. Google Search Console (search.google.com/search-console): add `tharkak.com` as a **Domain** property and verify it with the DNS `TXT` record Google gives you (add it in Cloudflare). Use the same Google account that owns the Cloud project, or add it as an owner.
3. Google Cloud Console, your project, **Google Auth Platform** (older: **APIs & Services**, **OAuth consent screen**), **Branding**:
   - App name: `Scnr`
   - User support email: your support address
   - App logo: 120 by 120 px PNG of the Scnr mark
   - Application home page: `https://scnr.tharkak.com`
   - Privacy policy link: `https://scnr.tharkak.com/legal/privacy-policy`
   - Terms of service link: `https://scnr.tharkak.com/legal/terms-and-conditions`
   - Authorized domains: `tharkak.com` (and `supabase.co`, which Google requires while the redirect is still on Supabase)
   - Developer contact email: yours
4. **Audience**: set **User type** to **External** and **Publishing status** to **In production** (press **Publish app**). Staying in "Testing" limits sign-in to 100 listed test users and shows a warning screen.
5. **Data Access** (scopes): keep only `openid`, `email` and `profile`. These are non-sensitive, so no long security review is needed.
6. Press **Submit for verification** if Google offers it. Answer the questions honestly. Branding verification normally takes a few days. Watch the email of the developer contact.

### B. Use your own domain for the sign-in address (paid, instant)

This makes the redirect address `auth.tharkak.com`, so even before branding verification the screen shows your domain.

Requires the Supabase **Pro** plan and the **Custom Domain** add-on (about 10 US dollars per month). Check the current price in Supabase billing.

1. Supabase: **Project Settings**, **General** or **Add-ons**, enable **Custom Domain**. Enter `auth.tharkak.com`.
2. In Cloudflare add the records Supabase shows: a `CNAME` for `auth` pointing to your project host (set to **DNS only**), and the `TXT` record Supabase gives for ownership. Press **Verify**, then **Activate** once green.
3. Google Cloud, **Clients**, your OAuth client (type Web), **Authorized redirect URIs**: **add** `https://auth.tharkak.com/auth/v1/callback`. Keep the old `https://noqstzknowdtpsiafdxw.supabase.co/auth/v1/callback` until the switch is done and tested.
4. Change `VITE_SUPABASE_URL` to `https://auth.tharkak.com` in **all** of: Vercel (Production and Preview), the GitHub repository secret used by the QA workflow (Settings, Secrets and variables, Actions), and your local `.env`. Redeploy.
5. Expect every signed-in user to be signed out once, because the browser stores the session under a key built from the old address. Do this at a quiet hour.
6. Test Google sign-in, then remove the old redirect URI.

## 8. Later: changing the domain

If you move from `scnr.tharkak.com` to another domain, change these. Nothing else should hold the domain once the domain-from-env PR is merged.

1. DNS for the new domain on Cloudflare (or the new host).
2. Vercel: add the domain to the project. Set `APP_URL` and `VITE_SHORT_DOMAIN` in Vercel, GitHub secrets and `.env`. Redeploy.
3. Worker: `MAIN_HOST` in `worker/wrangler.toml`, the Workers route in Cloudflare, and the `API_URL` secret (`wrangler secret put API_URL`). Then `cd worker && npx wrangler deploy`.
4. Supabase: **URL Configuration**, new Site URL and Redirect URL.
5. Google Cloud: authorized domains and home page, privacy and terms links, and the redirect URI if you use a custom auth domain.
6. Resend: add and verify the new sender domain, then update `EMAIL_FROM`. Update SMTP sender in Supabase.
7. PayHere and Polar dashboards: return, cancel and notify URLs, and the webhook URL.
8. Rebuild static files (the code PR generates `sitemap.xml`, `llms.txt` and the share tags from `APP_URL`).
9. Keep the old domain redirecting to the new one for at least a year. Printed QR codes point at the old short domain.

## 9. Final test (after steps 2 to 6 and the code PR)

1. **Mail authentication.** Create a free address at mail-tester.com, copy its test address, and send a Scnr sign-up mail to it (use "Create account" with that address). Open the result. Aim for 9 or 10 out of 10.
2. **Gmail headers.** Sign up with a real Gmail address. The mail should arrive in the Inbox, not Spam. Open it, three dots, **Show original**. SPF, DKIM and DMARC must each say **PASS**.
3. **Verification.** Click the button. You should land on Scnr signed in. Try the link a second time: it should say it is used or expired.
4. **Unverified login.** Sign up with another address and do not click the link. Try to sign in. You should be told to verify first, and "Resend" should send a new mail.
5. **Wrong password** shows a clear error and no detail about whether the address exists.
6. **Password reset.** "Forgot password", click the link, set a new password, sign in with it.
7. **Google sign-in** still works, and the chooser text reads as expected (Scnr, or your auth domain).
8. **App mail.** Trigger a form notification (submit a form that has a notify address). It should arrive from `digest@mail.tharkak.com`.
9. **Other providers.** Repeat step 2 with an Outlook or Yahoo address.

## If mail does not arrive

- Resend, **Logs**: shows each send attempt and the reason for a failure.
- Supabase, **Logs**, **Auth**: shows whether Supabase tried to send.
- Domain not verified: `550` or "sender not allowed" errors. Re-check step 2.
- Landed in Spam: check SPF, DKIM and DMARC pass in the headers. A brand-new domain also needs a few days of normal use to build a reputation, so do not send bulk mail on day one.
- Link points to `localhost`: the Site URL in step 4 is wrong.
- "Email rate limit exceeded": raise the limit in step 3.4.

## Summary of every manual task

- [ ] Resend: add `mail.tharkak.com`, verify, create two API keys
- [ ] Cloudflare DNS: DKIM, SPF, MX, DMARC, Google Search Console TXT (and auth CNAME if using 7B)
- [ ] Supabase: custom SMTP, rate limit, Confirm email on, password rules, Site URL, Redirect URLs
- [ ] Supabase: paste three email templates (after the code PR)
- [ ] Vercel and `.env`: `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`; redeploy
- [ ] Google Cloud: branding, authorized domains, publish app, submit for verification
- [ ] Optional: Supabase Pro custom domain, new redirect URI, `VITE_SUPABASE_URL` in all three places
- [ ] Run the final test
- [ ] Delete old `.env` backup files and rotate any key that has been shared
