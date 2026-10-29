---
name: olef
description: "Drive Android devices and apps via the `olef` CLI with structured JSON: deploy, UI automation, logs/crashes, debugger and layout inspection, network/OkHttp capture and intercept, permissions, files. Use for Android development, testing, and debugging."
---

# Olef

`olef` deploys, controls, and debugs Android apps. Gradle or `android`
builds; Olef verifies on devices.

## Core loop

These commands cover most work. Don't browse the catalog first; for one
unfamiliar verb run `olef <verb> --help` (or
`olef commands --describe '<verb>' --json`).

```bash
olef devices                          # pick a serial; pass -d <serial>
olef app start <pkg>                  # also: app stop|clear|current|info
olef ui dump                          # compact elements: rid/text/desc/tap[x,y]
olef ui find --rid <id>               # or --text "<label>" [--exact]
olef ui tap --rid <id> --expect-text "<next screen text>"
olef ui text "<value>" --rid <id> --clear
olef ui hide-keyboard
olef ui wait --text "<expected>" --timeout-ms 5000
olef ui wait --stable                 # until animations/loading settle
olef ui scroll-to --rid <id> [--tap]
olef ui set-progress --rid <slider> --value <n>
olef ui long-tap --rid <id> --duration-ms 800
olef ui key back|home|enter|dpad_center
olef why --app <pkg>                  # crash / ANR / network / not-foreground verdict
olef log --app <pkg> --last 2m        # app logcat, crash blocks parsed
```

Selectors, best first: stable `--rid`, Compose test tag, `--desc`, exact
`--text`, XPath; coordinates only for gesture-only surfaces. `--text`/`--desc`
match case-insensitive substrings (`--exact` for the full value; values
starting with `-` need `--text=-50%`). Selectors fail on ambiguity; taps need
an enabled clickable target or ancestor that a finger could reach (a target
under the keyboard or a dialog fails `element_occluded`). `ui tap` is an accessibility click and
works on TV too; use `ui focus` and `ui key dpad_*` only to test D-pad focus.

Confirming an action: with a known destination add one `--expect-*` flag; on
success it returns a screen summary (`--full` for elements). Otherwise act, then
`ui wait`/`ui find`. `--observe` returns the whole post-action screen.
`--if-screen <screen_hash>` guards an action that uses element ids from an
earlier read; selectors by `--rid`/`--text` don't need it. Re-read cheaply
with `ui dump --since <screen_hash>`. Never repeat delivered input
(`retryable:false`) without observing first.

## Devices and setup

Prefer a named target (`--target mobile`); otherwise `devices` and `-d`.
Never guess devices or boot an AVD unless its target allows `start:if-needed`.
The first device command installs and starts the on-device server. It holds
Android's single `UiAutomation` slot, so `uiautomator dump`, `android layout`
and Espresso fail while connected: wrap them in `olef test -- <command>`,
or `disconnect` first. `doctor --json` diagnoses the host-device pipe.
`config init --project` and `config validate --json` manage project config.
No Android SDK or adb? Ask whether to set up locally or use Olef
Cloud; `--guide cloud` covers sign-in, linking, usage and `cloud_*` errors.

## Output contract

Stdout is data; the exit code is authoritative. Actions return one object with
`ok`, `cmd` and `next_actions`; raw reads (`ui dump`) return the payload. A
failure has `ok:false`, `code`, `msg`, `retryable`, `detail` and
`next_actions`: branch on `code`, never parse `msg`. `watch`, `log` and
`net log` stream JSONL. Operational logs go to stderr (`--quiet` silences).
In batches keep every exit status (`pipefail`); serialize device mutations;
reserve multi-step shared work with a driver session (`--guide verification`).

## Network

```bash
olef net trust --auto      # once per device (rootable emulator: system CA)
olef net start             # proxy the device; upstream TLS is verified
olef net log               # flows: id, url, status
olef net show <id> --body  # one flow's headers and bodies
olef net stop              # always stop when done
```

A `tls_error` event means the app rejected the CA: run `net trust --auto`
(`net check <pkg>` explains why), then repeat the request.

## Guides, read before first use of a domain

`olef commands --guide <topic>`: `--guide workflow` (selectors, hashes,
recovery), `--guide net` (proxy, rules, intercept), `--guide debugger`
(debugger, layout, runtime), `--guide state` (app/device/permission/files
state), `--guide evidence` (checkpoints, video), `--guide faults` (failure
injection), `--guide verification` (coding-task checks, concurrent agents),
`--guide test` (test scripts, session settings, `test run`), `--guide feedback`
(report an Olef bug: errors with `fault: "olef"`).

Prefer typed verbs (`app install --grant-all`, `perm grant`, `appops set`,
`files pull --run-as`) over `device shell`. `debug auto <pkg>` starts a
debugging workflow; expression evaluation can have side effects.
`--redact` masks structured output (`--redact-pixels` for screenshots).

## Maintenance

`skill --sync` updates pristine skills and preserves customizations. Opt-in
`usage enable` + `usage report` records local command metadata.

## Command reference

Core groups below. For an unfamiliar command run `olef <group> <sub> --help`; `commands --depth 1` lists every member.

- **`devices`** — List attached devices / emulators, or reserve billed remote ones
- **`connect`** — Install the server APK, start it, and verify
- **`disconnect`** — Stop the server and remove the port forward
- **`doctor`** — Diagnose (and optionally repair) the host↔device pipe
- **`collect`** — Gather a self-contained diagnostic bundle
- **`log`** — Structured, bounded logcat
- **`why`** — One bounded triage read: what just went wrong?
- **`config`** — Inspect, generate, and validate user/project JSON config
- **`video`** — Screen-record a device into a timestamped, crash-safe evidence bundle
- **`watch`** — Watch the app timeline
- **`app`** — Application lifecycle, info, and install rituals
- **`perm`** — Runtime permission grants
- **`device`** — Device & system controls (info, shell, power, orientation, clipboard, …)
- **`net`** — Network MITM proxy: enable, inspect, intercept, and modify HTTP(S) traffic
- **`ui`** — Live UI automation: dump, find, tap, type, and wait for screen state

Other commands (`olef <command> --help` for details): session, verify, evidence, cloud, lab, test, record, licenses, update, init, commands, usage, feedback, skill, mcp, pane, emulator, debug, runtime, appops, profile, files, fault, layout.

