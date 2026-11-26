---
name: olef
description: "Drive Android devices and apps via the `olef` CLI with structured JSON: deploy, UI automation, logs/crashes, debugger and layout inspection, network/OkHttp capture and intercept, permissions, files. Use for Android development, testing, and debugging."
---

# Olef

`olef` deploys, controls, and debugs Android apps. Gradle or `android`
builds; Olef verifies on devices.

## Core loop

For an unfamiliar verb run `olef <verb> --help` (or
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
olef ui wait --stable [--pixels]      # until settled; --pixels: fades too
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

Confirming: add `--expect-*` for a known destination (returns a summary;
`--full` for elements), else act then `ui wait`/`ui find` (`--observe` returns
the full screen). `--if-screen <screen_hash>` guards actions using element ids
from an earlier read; `--rid`/`--text` don't need it. Re-read cheaply with
`ui dump --since <screen_hash>`. Never repeat delivered input (`retryable:false`)
without observing first.

## Devices and setup

Prefer a named target (`--target mobile`); otherwise `devices` and `-d`.
Never guess devices or boot an AVD unless its target allows `start:if-needed`.
The first device command installs and starts the on-device server. It holds
Android's single `UiAutomation` slot, so `uiautomator dump`, `android layout`
and Espresso fail while connected: wrap them in `olef test -- <command>`,
or `disconnect` first. `doctor --json` diagnoses the host-device pipe.
`config init --project` and `config validate --json` manage project config.
No Android SDK or adb? Ask: local setup, or Olef Cloud (`ocloud`).
A contract with `confirm_with_person`: ask first.

## Output contract

Stdout is data; exit code is authoritative. Actions return `ok`, `cmd`, and
`next_actions`; raw reads (`ui dump`) return the payload. Failures add
`ok:false`, `code`, `msg`, `retryable`, `detail`, `hints` (prose advice) and
`next_actions`: branch on `code`, read `hints`, never parse `msg`. Use
`next_actions` as hints of what is possible next—for recovery or 2–3 brief user
ideas at turn boundaries/blockers (never mid-loop; ask before billed, sign-in,
or destructive actions). `watch`, `log` and `net log` stream JSONL (skip
`heartbeat`). Logs go to stderr (`--quiet` silences). Keep batch exits
(`pipefail`); serialize mutations; reserve shared work with a session
(`--guide verification`).

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
(report an `olef` bug: `fault: "olef"`). Cloud workflows live in `ocloud`.

Prefer typed verbs (`app install|inspect|applinks|open-intent`, `perm`,
`appops`, `files --run-as`, `storage`, `work`, `perf`, `web`,
`device notifications`, `ui diff-image`, `fault inject`) over `device shell`.
`debug auto <pkg>` starts debugging; expression eval can have side effects.
`--redact` masks structured output (`--redact-pixels` for screenshots).

## Maintenance

`update --apply` updates `olef` and syncs skills; `skill --sync` preserves
customizations. Opt-in `usage enable` + `usage report` tracks local commands.

## Command reference

Core groups below. For an unfamiliar command run `olef <group> <sub> --help`; `commands --depth 1` lists every member.

- **`devices`** — List attached local devices, emulators, and remote devices attached via Attachment Records
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

Other commands (`olef <command> --help` for details): session, verify, evidence, test, record, licenses, storage, work, perf, web, update, init, commands, usage, feedback, skill, mcp, pane, emulator, debug, runtime, appops, profile, files, fault, layout.

