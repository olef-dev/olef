# Changelog

Release notes for ShadowDroid. Every release, with its binaries, is on the
[Releases page](https://github.com/shadowdroid-dev/shadowdroid/releases).

## v1.3.0

This release adds fault injection, deeper Android Studio integration and
incremental UI reads. It also includes a full audit and a release-wide QA pass
with more than 90 reliability fixes since v1.2.0.

- **Fault injection:** `shadowdroid fault` puts the device or app into 37
  failure conditions and undoes them reliably: network (airplane mode, network
  flaps, DNS failure), power (Doze, standby buckets, low battery), lifecycle
  (process death, don't-keep-activities), configuration (font scale, display
  size, locale, orientation), resources, interruptions (calls, SMS, PiP) and
  emulator-only kinds. Each fault records how to undo itself before touching the
  device, verifies it took effect, and shows up in `watch` and `why`.
  Proxy faults (`http-errors`, `http-latency`, `bandwidth`, `connection-reset`,
  `truncated-response`, `tls-failure`) mark every request they hit and pick
  requests from a seed. `fault run` replays seeded multi-step scenarios.
  See `shadowdroid commands --guide faults`.
- **Android Studio:** layout snapshots link elements to their Compose source,
  `layout recompositions` can show only the nodes that recomposed, and layout
  commands open the device in Running Devices and turn on Layout Inspector
  themselves. `studio status` and `debug status` report installed and running
  plugin versions and which Studio internals the plugin can reach. Debugger
  steps wait for their pause, all suspended threads are listed, method,
  exception and Kotlin field breakpoints work, breakpoint files are found by
  name, and reads right after a pause wait for Studio to settle it instead of
  failing.
- **UI:** `ui dump --since <screen_hash>` reports only what changed. Taps
  resolve focus on the intended target, and `watch` stdin taps accept selectors.
- **Network:** captures record the HTTP version on both legs and the origin's
  content-encoding when the proxy decodes a body. HAR exports carry query
  strings, cookies and redirect URLs. curl exports replay HEAD requests, quote
  methods, never read local files named by a body, and flag replays that cannot
  resend the app's body. Upstream errors keep their cause, a crashed proxy
  daemon recovers, and `net replay --clear` stops serving fixtures.
- **Verification:** journey steps retry a guarded action the server refused
  before injecting anything, instead of failing while the screen settles after
  text entry, and `ui wait` decides on a consistent snapshot. Commits that leave
  the verified sources unchanged no longer make results stale.
- **Safer defaults:** interrupted operations quarantine a device only when a
  mutation's outcome is unknown, `doctor` without `--fix` is read-only and only
  repairs state ShadowDroid owns, cross-signed server installs recover
  automatically, and captured bodies, reports and logs are written owner-only.
- **Agent contract:** more failures carry typed codes instead of the generic
  fallback, and usage errors name the missing arguments. Contradictory or no-op
  flags are refused rather than ignored, and a rule or override with no matcher
  warns that it hits all traffic. The catalog lists every guide topic and root
  flag.
- **Supply chain and release:** the ADB client now speaks the ADB protocol
  in-tree, which removes `adb_client` and its `rsa` dependency, and
  `cargo audit` passes without exceptions. Releases publish only after CI
  passes on the tagged commit.

Compatibility: the root `--session` driver token is no longer a global flag.
Pass it before the subcommand (`shadowdroid --session TOKEN ui dump`), as the
documentation already did, or set `SHADOWDROID_SESSION`. Placed after a
subcommand it used to leak into that subcommand's own `--session`.

Fault injection changes real device settings; destructive kinds need
`--allow-physical` on a phone. Layout Inspector stays on after layout commands,
and Studio then injects its inspector agent into each app launch; turn it off
in Studio before timing- or crash-sensitive runs.

Validation includes 814 Rust tests, strict Clippy, Studio plugin tests, and an
API 36 emulator sweep across lifecycle, UI, apps, permissions, files, video,
debugging and `watch`. An isolated Android Studio ran debugger, logpoint and
layout checks. Every fault kind was injected, verified and cleared live, and
the fault contracts were checked. The verification, Android surface and
reliability end-to-end suites also passed.

Install or upgrade on macOS/Linux:

```sh
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/shadowdroid-dev/shadowdroid/releases/download/v1.3.0/shadowdroid-installer.sh | sh -s -- --version v1.3.0
```

Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -c "irm https://github.com/shadowdroid-dev/shadowdroid/releases/download/v1.3.0/shadowdroid-installer.ps1 | iex"
```

Homebrew: `brew upgrade andriyo/tap/shadowdroid`. Scoop: `scoop update shadowdroid`
with the ShadowDroid bucket configured. APKs, agent AARs, Studio plugin, installers,
CLI archives, checksums and release provenance accompany this GitHub release.
Crates.io and IDE marketplace publication are separate distribution channels.

## v1.2.0

This release adds experimental requirement verification and coordinated local
agent sessions. It also includes the reliability fixes developed since v1.1.0.

- **Verification plans and evidence:** versioned requirement/check mappings,
  bounded execution, JUnit ingestion and baseline regression comparison,
  durable evidence, source/artifact freshness and explicit unresolved outcomes.
- **Android behavior checks:** guarded journeys, distinct lifecycle experiments,
  configuration matrices with owned-state restoration, SQLite/Room snapshots,
  visual comparison bundles and accessibility findings.
- **Build and platform contracts:** fresh APK build/install identity, resolved
  Gradle dependencies, source constraints, and named instrumentation assertions
  for intents, MediaSession release, widget updates and Picture-in-Picture.
- **Concurrent agents:** one driver per device, passive observers, independent
  crash subscriptions, explicit handoff, interrupted-operation quarantine and
  recovery. Independent devices can proceed concurrently.
- **Agent guidance and evaluation:** `shadowdroid commands --guide verification`,
  independent Android acceptance tests, and a frozen local coding-agent trial
  harness that retains unsuccessful and timed-out attempts.
- **TLS dependency fix:** rustls 0.23.45 addresses
  [RUSTSEC-2026-0285](https://rustsec.org/advisories/RUSTSEC-2026-0285).
- **Reliability:** preserve unknown network observations, verify proxy teardown,
  normalize JSON discovery, bound target contention, and release CA leases
  explicitly when concurrent child processes inherit file descriptors.
  Journey keys use guarded input and mandatory observed postconditions, without
  replaying Android's ambiguous injection results.
  Font-scale recovery waits for delayed framework configuration writes to settle.
  Theme restoration preserves custom schedule and bedtime modes.

The new adapters remain experimental. Local cooperative sessions do not fence
direct ADB/HTTP/IDE clients. Pixel comparison is not a semantic visual judge;
SQLite checks stop the app; platform assertions cover only their named tests.
Camera/Wear, distributed coordination and deeper headless inspection remain
conditional work. No Android Bench score or agent-performance uplift is claimed.

Validation includes positive/defective emulator fixtures, two-device concurrency
and interruption recovery, 701 Rust tests, Android lint/unit tests, strict
Clippy, minimum Rust 1.91, and package/consumer checks. Both two-minute coding
trial patches passed independent Android checks; both agents timed out without
completion claims. Workflow outcomes and public artifact validation are recorded
in the release's companion documentation after publication.

Read the [verification guide](https://github.com/shadowdroid-dev/shadowdroid/blob/v1.2.0/docs/verification.md)
and [session guide](https://github.com/shadowdroid-dev/shadowdroid/blob/v1.2.0/docs/sessions.md).

Install or upgrade on macOS/Linux:

```sh
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/shadowdroid-dev/shadowdroid/releases/download/v1.2.0/shadowdroid-installer.sh | sh -s -- --version v1.2.0
```

Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -c "irm https://github.com/shadowdroid-dev/shadowdroid/releases/download/v1.2.0/shadowdroid-installer.ps1 | iex"
```

Homebrew: `brew upgrade andriyo/tap/shadowdroid`. Scoop: `scoop update shadowdroid`
with the ShadowDroid bucket configured. APKs, agent AARs, Studio plugin, installers,
CLI archives, checksums and release provenance accompany this GitHub release.
Crates.io and IDE marketplace publication are separate distribution channels.

## Earlier releases

See the [Releases page](https://github.com/shadowdroid-dev/shadowdroid/releases) for v1.1.0 and earlier.
