---
name: olef-qa-playwright
description: "Combine Olef Android UI automation with Playwright off-device web flows and domain CLIs in deterministic `tests/olef/*/test.sh` journeys, attaching web screenshots/traces and structured failures into Olef's session bus."
---

# Olef + Playwright Multi-Surface QA

Use this pattern when an Android test hands off to an off-device web page
(QR code upsell, TV device-code sign-in, magic-link checkout, Stripe/3DS
iframes) or calls the system's own test-account API/CLI alongside `olef`.

Keep web automation in Playwright (not inside `olef` CLI) and plug it into the
active Olef session through two bus commands:

- `olef session attach <file> --label "<name>" --kind screenshot|trace|http|log`
- `olef session fail --msg "<reason>" --fault app|test|environment --expected "<v>" --actual "<v>" --attach <file>`

## Required Chromium launch flags (Olef Cloud workers)

Olef Cloud workers enforce egress allowlists via transparent nftables (TCP
only; UDP/QUIC and DoH are blocked) and run without unprivileged user
namespaces. Always launch Chromium with:

```js
const browser = await chromium.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-quic',
    '--disable-features=DnsOverHttps',
  ],
});
```

## Canonical pattern in `test.sh`

```bash
step qr-and-web-checkout
QR_URL="$(olef ui qr --rid offdevice_qr --expect-prefix 'https://')"
node "$(dirname "$0")/../web_checkout.mjs" "$QR_URL"
olef ui wait --rid purchase_success_continue --timeout-ms 15000
olef ui assert --rid detail_title --equals 'Harbor FC vs Tidewater'
```

## Reusable helper (`scripts/olef-pw.mjs`)

Use `withOlefPage(stepLabel, async (page) => { ... })`:
1. Starts Playwright tracing (`screenshots: true, snapshots: true`).
2. Runs your web flow.
3. On success, optionally attaches a verification screenshot via `olef session attach`.
4. On any thrown error/assertion failure, captures `web-failure.png` and
   `trace.zip`, then invokes `olef session fail --msg ... --attach web-failure.png --attach trace.zip`
   so Olef snapshots the Android screen + logcat alongside the Playwright evidence
   into `failures/<step>/report.json` and `report.html`.

## On-device Chrome handoff

When the Android app opens Chrome or a Custom Tab *on the phone itself* (e.g.
email magic link), open the session with `--allow-packages com.android.chrome`
so the foreground guard permits the browser handoff while still catching
unexpected app crashes or launcher escapes.
