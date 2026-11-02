# PWA and order push notifications — design

2 November 2026. The owner decided the goal, the push recipients and the events; items marked "assistant" are the assistant's calls.

## Why

On the DevFest demo the owner installs BarberHQ on a phone as a salon user and shows it as a PWA: HQ acts on a laptop, the phone in hand receives a notification. Today the app has no manifest, no service worker and no push.

## Goals

- BarberHQ installs to the home screen on Android (Chrome) and iPhone (Safari, iOS 16.4+), opens full screen with its own icon, name and splash colours.
- The app shell (HTML, JS, CSS, i18n, icons) loads from cache on the second visit; a new deploy reaches users without a manual cache clear.
- Salon users get a push notification when HQ changes the status of their salon's request:
  - approve → `RESERVED`
  - reject → `REJECTED` (body includes the rejection reason)
  - dispatch → `DISPATCHED`
- Every user with access to the salon (`SalonAccess`) gets it, on every device where they enabled notifications (owner: all with access, no per-person rules).
- Tapping the notification opens `/salons/:salonId/requests/:requestId`.

## Non-goals

- No push to HQ (owner: HQ works from the desktop). HQ keeps today's behaviour: the queue refreshes on focus and on reconnect (`BrowserActivity.refreshTick`).
- No push for transitions the salon makes itself (submit, receive) and none for delivery issues (assistant).
- No offline data or offline writes. Without network the shell starts, data screens show the existing stale/offline states (assistant).
- No notification preferences UI beyond enable/disable on the device.

## Anti-goals

- A status change must never fail or slow noticeably because a push failed. Send after the status write commits; errors only go to logs.
- No duplicate notification for the same change: retries of a command (the stock command replays with the same action key after an "outcome unknown" error) must not produce a second visible notification.
- Never ask for notification permission on page load; iOS only allows it after a user tap and an unprompted browser prompt on stage looks bad.

## Decisions

### PWA shell (assistant)

- `@angular/service-worker` (ngsw) with a manifest `web/public/manifest.webmanifest`: name "BarberHQ", `display: standalone`, `start_url: /`, `theme_color: #171614`, `background_color: #f6f5f2`, icons 192, 512 and a 512 maskable in the brand red `#dc241f` (simple generated "B" mark is fine), plus `apple-touch-icon` and iOS meta tags in `index.html`.
- ngsw caches the app shell and lazy chunks (prefetch app, lazy assets); Google Fonts CSS and gstatic files as a data group with a long cache; no caching of Functions, Data Connect, Auth or Storage requests.
- Updates: on `VERSION_READY` show a snackbar "New version available — Reload" (Transloco keys in en and pl).
- Hosting: `ngsw.json` and `ngsw-worker.js` keep `Cache-Control: no-cache` (today's `**` rule already does this; keep it when headers change). The `** → /index.html` rewrite does not affect them because Hosting serves existing files before rewrites; no CSP exists.
- Cold start from a notification: the access guard already redirects to `/login?returnUrl=…`; an e2e check confirms a signed-out open of a request URL lands on that request after sign-in.
- Service worker is only registered in production builds; dev and emulator builds stay without it so local development and e2e are unchanged.

### Push transport (assistant)

- Firebase Cloud Messaging for web (`firebase/messaging`). The public config gains `firebase.messagingSenderId` and `messaging.vapidKey`, both added to `config/public.example.json` and the config loader/validator; the owner puts the real values in the local config.
- Owner prerequisites before the manual proof (production console steps, each with the owner's approval): generate the Web Push certificate (VAPID key pair) in Firebase console → Project settings → Cloud Messaging; confirm the Firebase Cloud Messaging API (v1) is enabled; the Functions runtime service account `baberhq-runtime@notbad-6be95.iam.gserviceaccount.com` can send (it needs `cloudmessaging.messages.create`, e.g. role Firebase Cloud Messaging API Admin). The plan lists these as a checklist, not as code.
- One service worker: ngsw plus a small custom script imported into it that handles `push` display and `notificationclick` (open or focus the request URL). FCM `getToken` gets the ngsw registration, so there is no second `firebase-messaging-sw.js` scope clash. If FCM's SDK proves unable to use the ngsw registration, fall back to a single custom worker that imports `ngsw-worker.js`; record the choice in the plan.
- Notification payload: title and body already localised by the server, `tag` = `request:<requestId>:<state>` so a duplicate replaces rather than stacks, `data.url` = target route.

### Enabling notifications (assistant)

- Salon users see an "Enable notifications" action (salon dashboard toolbar or salon settings — plan decides, reuse shared UI). It shows only when the browser supports push and permission is not yet granted. On iPhone outside the installed app it shows a short hint "Add to Home Screen to get notifications" instead.
- On grant: get the FCM token and register it with a new `commands` op (`registerPushToken`, input `{ token, locale }`); on sign-out the token is unregistered (`unregisterPushToken`) and deleted locally.
- All text through Transloco, en and pl.

### Token storage (assistant)

- New Data Connect table `PushToken @table(key: "token")`: `token: String!`, `membership: Membership!` (Membership is keyed by uid, the same reference `SalonAccess` uses), `locale` (`en` | `pl`), `createdAt`, `updatedAt`. Registering an existing token moves it to the current user. Operations live only in the server connector (`dataconnect/server/`); no browser operation touches the table.
- Database migration to production follows the usual `deploy:db:diff` then `deploy:db` with the owner's approval.

### Sending (assistant)

- After `APPROVE`, `REJECT` and `DISPATCH` succeed in the stock command, the function looks up tokens of all memberships with `SalonAccess` to the request's salon and sends with `firebase-admin/messaging` `sendEachForMulticast`. The send is awaited with a short timeout (≈3 s) so it finishes before the callable returns, and never changes the callable's result.
- Tokens FCM reports as unregistered or invalid are deleted.
- Replays do not send: `StockRepository.execute` already returns `replayed: boolean`; send only when `replayed === false`. The `tag` is only a second safety net on the device.
- Recipients are resolved at send time: tokens whose membership currently has `SalonAccess` to the request's salon. A token left on a user who lost access, or who signed out offline, gets nothing for that salon. Unregister on sign-out is best effort (assistant).
- The send is awaited inside the callable with a 2 s timeout (Cloud Run throttles CPU after the response, so fire-and-forget is unreliable); no Cloud Task (assistant: FCM calls normally take a few hundred ms).
- Texts: en and pl templates in functions, e.g. pl "Zamówienie zatwierdzone", "Zamówienie odrzucone", "Dostawa w drodze"; body names the salon and the request's short reference (builder picks the existing short form shown in the UI). The rejection reason is shown in the body, truncated to 100 characters (assistant: demo data, HQ-written operational text, acceptable on a lock screen). Recipient locale comes from the token row.

## Constraints

- Global rules in `AGENTS.md`: TDD, i18n parity, 300-line logic files, one model per file, layering (components never call Firebase directly — messaging goes through `core/` and a data-access service), no production write without the owner's approval for that step.
- Commands keep `maxInstances: 5`; App Check behaviour of the router unchanged.
- No change to existing behaviour of approve, reject and dispatch beyond the notification.

## Left to the builder

- Exact placement of the enable action, icon artwork, notification copy wording within the meaning above.
- Emulator story: the messaging emulator does not exist; unit-test the sender with a fake messaging client and e2e-test only the enable flow with a mocked `commands` op.

## Proof

- Unit: manifest fields and icon files exist; ngsw config excludes API hosts.
- Unit (functions): approve, reject and dispatch call the sender with the salon's tokens and the right localised text; a sender failure does not change the command result; invalid tokens are removed; submit and receive send nothing.
- Web unit: enable action visibility rules (unsupported, denied, granted, iOS not installed); token registration via the data-access API.
- Manual on the preview channel: install on an Android phone and an iPhone, enable notifications, approve and dispatch from HQ on a laptop, notification arrives with the app closed, tap opens the request.
