# Asma Clock: project guide

Read this whole file before changing anything. It is the source of truth for what we are building and the rules for building it.

## 1. What this is

Asma Clock is a free, open source Islamic app that starts as a clock and grows into a wider learning app. Owner: Maxim (Digital26).

Platforms, all from one repo:
- Web app (installable PWA), hosted on Netlify.
- Windows "island" app (Electron 22, Windows 8 to 11, 64-bit).
- Android app (Capacitor wrapper plus a little native Kotlin).

Languages everywhere: English, French, Arabic (RTL must work).

## 2. Rules for the AI assistant (important)

1. Stay in plain HTML, CSS and vanilla JavaScript for the app. No frameworks, no build step for web/, no npm packages in web/. The only exceptions are desktop/ (Electron) and android/ (Capacitor, Kotlin).
2. Work in small steps. One feature per change. After each change, say which files you touched and how to test it.
3. Never edit files outside the folder the task belongs to. web/ is shared by every platform, so changes there must work in the browser, in Electron and in the Android WebView.
4. Never rewrite working code just to restyle it. Do not rename existing files, globals (AsmaData, AsmaCore, NAMES) or the localStorage key "asma.v1" without asking.
5. Keep the Content Security Policy in index.html and island.html. No inline scripts, no external scripts, no CDN links. Everything is served from the app itself.
6. Never put secrets in the repo: API keys, webhook signing secrets, the licence private key, keystores. They live only in the host's environment settings. If a task seems to need one in code, stop and ask.
7. Never invent religious content. Quran text, hadith, duas, Arabic roots and meanings must come from a cited source and be marked with its evidence level (see section 7). If unsure, leave a TODO marker and ask. Do not "improve" Arabic text or diacritics by guessing.
8. Do not add music, gambling mechanics, images of people or animals, or the Names of Allah as game pieces (see section 8).
9. No em dashes and no emojis in any text the user sees or in documents we write.
10. If something is unclear, ask a question instead of assuming.
11. Add or update a test when changing prayer-time or calendar maths (core.js). Run the tests before saying a change is done.

## 3. Repo structure

```
web/       The real app. Shared by all platforms. Deployed to Netlify.
desktop/   Electron island app. desktop/app is generated from web/ by scripts/sync-web.js, never edit it by hand.
android/   Capacitor project and Kotlin (widget, overlay island, exact alarms). Added when we start the APK.
api/       Serverless functions (payment webhook, licence activation, devices). Added with payments.
content/   Learn, Roots, games, duas as JSON per language. Loaded lazily by web/.
docs/      This guide and notes.
.github/workflows/   Cloud build recipes for Windows and Android.
```

### Existing files in web/
- names.js: window.NAMES, the 99 Names as [transliteration, arabic, english, french].
- content.js: window.AsmaData: UI strings (T), months, events, calculation methods, cities, duas, default routine.
- core.js: window.AsmaCore, prayer times, Hijri date, Qibla. Also runs in Node for tests.
- app.js: the whole UI (clock dial, prayer, calendar, routine, duas, settings, alerts, audio, location).
- island.html, island.css, island.js: the Dynamic Island pill (also reused by Windows and later Android).
- sw.js: service worker (cache name asma-v1). Bump the cache version when files change.
- manifest.webmanifest, _headers, icons/, fonts/ (Amiri, self-hosted).

### Behaviour that already works (do not break)
- Analog dial with the 99 Names ring; the sweep hand does one lap per 60 seconds; Name of the minute cycles in order.
- Arabic-numeral time. The digital time block uses direction:ltr on purpose.
- Prayer times with Muslim World League as default, auto location, device timezone assumed. Hijri day starts at Maghrib, with a plus or minus day adjustment.
- In the desktop app, the island handles all alerts; app.js checkAlerts returns early when window.asmaDesktop exists.

## 4. Feature list

Core (done in v1 web and Windows): clock, prayer times, fasting (suhoor, imsak, iftar), Hijri and Gregorian calendar, routine planner, duas, three languages, Windows island.

Next, in this order:
1. Reliable exact-time adhan alerts on Android (native alarms). Test this first, it is the highest risk.
2. Android widget (native Kotlin): Arabic time, next prayer, Name of the minute.
3. Android island overlay (hosts island.html in a WebView; needs the "display over other apps" permission).
4. Learn: how to pray (original faceless SVG illustrations), fasting, adhkar, duas from Quran and Hadith, the 40 Rabbana duas, etiquette, Islamic finance with calculators.
5. Roots: Arabic root words and meanings, starting with about 20 entries.
6. Games (free, see section 8).
7. Audio: adhan voices and recitation (see section 9).
8. Premium (see section 6).

## 5. Platform notes

- Web: static hosting on Netlify. Works offline through sw.js.
- Windows: Electron 22.3.27 on purpose (last version that supports Windows 7 to 8.1). Do not upgrade Electron without asking. Installer is unsigned for now, so Windows SmartScreen shows a warning.
- Android: Capacitor wraps web/. Needs Local Notifications with exact alarms (SCHEDULE_EXACT_ALARM, or USE_EXACT_ALARM on Android 14), notification permission on Android 13 and up, and a custom sound channel. Tecno, Infinix and Xiaomi kill background work, so the app must guide users to turn off battery optimisation. The widget and the island are native, they cannot be plain HTML.
- We do not run Android Studio on the owner's PC. Builds happen in the cloud (GitHub Actions) and produce an APK for direct install and an AAB for Google Play.

## 6. Premium and licensing

Free forever (never paywall): clock, prayer times, adhan, fasting, calendar, basic duas, routine, basic Learn, all games.

Premium candidates: full Roots library with quiz and review, Islamic finance course and full calculators, extra Arabic word packs, Ramadan kit, extra adhan voices and audio packs, themes and island or widget customisation, backup and sync.

Payment provider: bachs.io. Product: annual subscription, priced at 2.96 USD so the owner nets about 3 USD after fees. Product ID: prod_9b70254ba66e4a59b010 (an identifier, not a secret). API docs: https://docs.bachs.io

### Principles
- The code is open source, so the lock must be on the server. Never trust the app or a "payment success" page.
- Only a verified Bachs webhook creates, renews or revokes a licence.
- Premium content is sent by the server only to a valid device token. The app holds only the public key to check tokens. The private signing key stays on the server.
- No email sending service. We do not send emails ourselves. Identity is proven by Google sign-in or by the licence ID (see Restore).
- Free features always work offline and are never affected by licence state.

### Secrets (host environment variables only, never in the repo)
BACHS_API_KEY (sk_live_... in production, sk_sandbox_... for testing), BACHS_WEBHOOK_SECRET, LICENCE_PRIVATE_KEY, and the database credentials. The public key can ship in the app.

### Functions in api/
1. create-checkout: creates the Bachs checkout session through POST /v1/checkout-sessions on the server. It generates a new random licence ID, saves a pending licence, and sends the licence ID in `metadata` (and in `reference`). It sets `success_url` to our success page. Never expose the Bachs API key to the app.
2. success page: Bachs redirects to success_url with `?checkout_id=...`. The server calls GET /v1/checkout-sessions/{checkout_id} with the secret key and shows the licence ID only if the session is paid and matches a licence we created. Show it once with a copy button and a "save this" message. A redirect can be lost, so the webhook is the real source of truth.
3. bachs-webhook: receives and processes Bachs events (below).
4. activate: app sends email or Google ID token, licence ID (when needed) and a device ID.
5. devices: list the devices of a licence, and remove one.
6. content: serves premium content to a valid token.

### Webhook handling
- Verify the signature before anything else. Use the raw request body, not re-serialised JSON. Prefer header X-Bachs-Signature-V2 (`t=<timestamp>,v1=<hmac>`, HMAC-SHA256 of `<timestamp>.<raw_body>`), accept if any v1 value matches, and reject if the timestamp is more than 300 seconds from now. The Bachs Node SDK has webhooks.constructEvent that does this.
- Reply 2xx within 10 seconds, as soon as the event is stored. Do slow work afterwards. Return 400 only for a bad signature, and 5xx if our own processing fails so Bachs retries (up to 5 tries over about 80 minutes).
- Delivery is at-least-once and can be out of order. Store each event `id` and ignore repeats. Compare the event `created_at` with the stored state before overwriting.
- Ignore unknown fields. New ones can appear.

| Event | Action |
| --- | --- |
| checkout.completed | Find the licence by the licence ID in metadata. Save the buyer email, customer ID, and the subscription ID (data.subscription.subscription_id) if present. Mark the licence active. |
| customer.subscription.created | Grant: status active or trialing. Save current_period_end. |
| customer.subscription.updated | Update status, current_period_end and cancel_at_period_end from the full subscription object. Revoke if status is unpaid. |
| invoice.paid | Renewal paid. Extend the licence, and reactivate if it was past_due. |
| invoice.payment_failed | Mark past_due. Keep access during the retries (retries run about 1, 3 and 5 days after the failure). Show the user a "payment failed, update your card" notice. |
| customer.subscription.deleted | Revoke. Access ends at current_period_end if cancellation was scheduled, otherwise at once. |
| refund.created, refund.paid | Revoke the licence. |
| dispute.created | Suspend the licence until resolved. |

Licence statuses: pending, active, past_due, suspended, expired, revoked. Add a short grace period after expiry before premium stops.

### Database (one record per licence)
licence_id (random, long, unguessable), email (lowercase), google_sub (optional), bachs_customer_id, bachs_subscription_id, status, current_period_end, devices [ {device_id, name, model, first_seen, last_seen} ], processed_event_ids, created_at, updated_at. Choose a small hosted database. Check free plan limits before deciding.

### Devices (maximum 2 per licence)
- The app creates a random device ID on first run and stores it locally.
- Activation checks the licence status and the device list. If the device is already in the list, refresh last_seen and return a token. If there is room (fewer than 2), add it. If two other devices are already registered, refuse and return the list so the user can remove one.
- The token is signed by the server, bound to the device ID, and expires after a few days. The app refreshes it in the background when online and keeps premium content working offline until the token expires.
- The "Manage devices" screen shows each device (name, model, last used) with a Remove button. Removing a device frees a slot, so the user can move to a new phone. Tell the user plainly: "You can use this on 2 devices. Remove an old one to add a new phone."

### Restore (app deleted, new phone, lost token)
1. Sign in with Google. Google returns a verified email, which proves ownership without us sending any email. The server finds the licence with that email.
2. If the buyer paid with a non-Gmail address, or a different address, use email plus licence ID instead. The licence ID is the secret.
3. The server then checks: the licence exists and matches, its status is active (and, when we have a subscription ID, check it against Bachs data we hold, see below), and the device count (maximum 2). If all pass, it issues the device token.
4. Never accept a bare typed email with no proof. The email typed at Bachs checkout is not verified by Bachs, and a typed email alone would let anyone claim a licence.
5. If the licence ID is lost and Google sign-in cannot match, the fallback is manual support: the owner checks the customer in the Bachs dashboard and resets the licence.

### Checking status against Bachs
- Main source of truth: webhooks stored in our database.
- Safety check: once per day per active licence, and at each activation, verify the checkout or subscription still matches Bachs through the API if a retrieve endpoint is available (the docs list a subscription object and GET /v1/checkout-sessions/{checkout_id}; confirm that a retrieve-subscription endpoint exists before building on it). If a webhook was missed, Bachs replay-events in the dashboard can resend it.

### Customer portal
Bachs has a hosted customer portal where subscribers can cancel, view invoices, and update their card. Use a portal session (created by our server) for a "Manage subscription" button. Cancellation arrives by webhook.

### To verify in the sandbox before launch (do not guess)
- Run a full test purchase with sk_sandbox keys: checkout, webhook, success page, activation, renewal, cancel, refund.
- Confirm that a yearly recurring product can be bought with the payment methods our users actually use (mobile money, bank transfer, local cards). The subscriptions guide currently says only USD cards are billed for subscriptions. The owner reports subscriptions work. Test it with real local methods. If recurring billing does not work for them, fall back to a one-time payment that gives 365 days with a Renew button, using the same licence logic.
- Confirm where the subscription ID appears in checkout.completed and subscription events, and what the retrieve endpoints are.
- Confirm fees, payout support for Cote d'Ivoire, and what emails Bachs sends the buyer (the docs only mention the failed-payment email and the portal login code).

## 7. Content accuracy (Learn, Roots, duas)

Every religious entry has: Arabic with full diacritics, English, French, a source, and an evidence badge:
- Language fact: from a dictionary.
- Classical scholars: a cited comment from a lexicon or tafsir (Lisan al-Arab, Maqayis al-Lugha, Mufradat al-Raghib, recognised tafsir).
- Reflection: a reading that is not a ruling, clearly labelled.

Rules:
- Do not copy viral or social media explanations. Write from dictionaries and cite them.
- Use only public-domain or properly licensed translations.
- Every entry gets a "report a mistake" link. A qualified scholar reviews before release.
- Example already checked: the root of عَظِيم (great) and عَظْم (bone) is ع ظ م, the middle letter is ظ (zha). The idea that bone is the strongest thing and so greatness is stronger is NOT verified, so it must be a Reflection at most.

## 8. Games (free, no music)

Planned: XO with Arabic letters, Dots and Boxes, Arabic Word Connect, crossword-style Arabic puzzle (words share letters), Memory Match, Kalima (Wordle-style), 99 Names Match, Salah Steps, Quiz Duel.

Rules:
- No betting, stakes, purchases inside games, or random reward boxes. Nothing to earn or buy.
- No sound except soft effects, with a silent mode. No music.
- No pictures of people or animals. Use letters, shapes, objects.
- Never use the Names of Allah as game tokens.
- Pause automatically at adhan time.
- Online play only by invite link or code. No public lobby. No free chat, only preset phrases (for example "Good game", "Your turn", "MashaAllah").
- Arabic letters change shape by position. Game logic uses the letter identity, and the display draws the right form.
- Word games show the word, play the pre-recorded pronunciation, then show transliteration and meaning in the user's language. Use pre-recorded audio, not phone text-to-speech.
- Vocabulary starts with everyday words, then prayer and Quran words. Each word needs Arabic with diacritics, transliteration, English, French and an audio file.

## 9. Audio

- Only use audio with a clear licence that allows redistribution and modification (CC0, CC BY, public domain) or with signed permission from the reciter or muezzin. Never "non-commercial" only. Keep a licences file listing each audio file, its source and its licence.
- Real human recordings for adhan and Quran. No synthetic or cloned voices for Quran or adhan. Synthetic narration is allowed for lessons only if clearly labelled.
- Compress before adding: mono .m4a at 64 kbps (96k if thin). A full adhan should be roughly 1 to 3 MB. Keep audio out of the first load, fetch it when needed.
- Offer a silent and vibration-only option.

## 10. Quality and safety

- Test on a real phone, not only in a desktop browser. Many different Android phones are targeted, including low-end ones.
- Prayer time maths changes need tests against known values for several cities.
- Respect RTL: check Arabic layout for every new screen.
- Accessibility: readable text sizes, contrast, touch targets at least 44 px.
- Privacy: location stays on the device, except the Windows island which uses an IP lookup (ipwho.is then ipapi.co) because Electron has no system location. No analytics or trackers without asking.

## 11. Build and release

- Web: push to GitHub, Netlify deploys web/ (publish directory web, functions directory api when added).
- Windows: GitHub Action on a Windows runner runs npm ci and npm run dist inside desktop/ and uploads the installer.
- Android: GitHub Action runs the Capacitor sync and Gradle build, signs with a keystore stored as a GitHub secret, and uploads the APK and AAB. Back up the keystore in two places, losing it means the app cannot be updated.
- Release notes go in docs/.

## 12. Open source

The code is intended to be open source (MIT or Apache-2.0, to be confirmed with a lawyer). Content and audio have their own licences, and paid content is not in the repo. Do not add a LICENSE file until the owner decides.

## 13. First tasks for the AI

1. Read all files in web/ and write a short summary of how app.js is organised, without changing anything.
2. Add a minimal Node test for core.js prayer times (3 cities, known values supplied by the owner).
3. Create the Android project with Capacitor in android/ and a test screen that schedules an exact notification 1 minute from now.
Stop after each task and wait for the owner to test.
