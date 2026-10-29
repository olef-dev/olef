# Coordinating agents on Android devices

A session is a reservation of one device for one driver, with settings that
later commands inherit, facts it keeps so they run faster, guards that stop a
run the moment the app is gone, and a journal of everything done. Test
scripts are built on it: see [test runs](test-runs.md).

## One command opens it

```bash
TOKEN="$(mktemp -d)/session.token"
olef session open --agent explorer --token-out "$TOKEN" \
  --app io.github.andriyo.shadowdroid.sample --launch .MainActivity --expect-rid status_text
export OLEF_SESSION_FILE="$TOKEN"
olef ui tap --rid nav_mission --expect-rid mission_claim_button   # uses the session's settings
olef session close --exit-code 0
```

`session open` observes the device for the new driver (boot id, foreground,
and a fresh crash cursor), so the next command can act directly; a separate
`session observe` is only needed after a handoff. The output names the
`session_id`, the `run_dir`, the effective `settings`, the observation,
`preflight` warnings and the starting state it applied.

### Settings

Settings are declared where the session is opened and are defaults: an
explicit flag on a command always wins. Every command run in the session
reports them back as `session_context` (`id`, `step`, `app`, `wait_ms`,
`timeout_ms`, `capture`, `cached`).

| Flag | Default | Effect |
| --- | --- | --- |
| `--app PKG` | none | The app under test: turns on the guards and is the default package for `app` verbs |
| `--wait-ms N` | 10000 | How long actions that support a target wait for it |
| `--timeout-ms N` | 10000 | How long `--expect-*` checks and `ui wait` wait |
| `--pace-ms N` | 0 | Minimum gap between commands (slow devices, demos); reported as a flake signal |
| `--capture steps\|failures\|off` | `steps`; `failures` under `test run` | Screens before and after every action and a screenshot, or only when a command fails |
| `--no-journal` | journal on | No journal, screens or failure reports |
| `--run-dir DIR` | `$OLEF_RUN_DIR`, else `.olef/sessions/<id>/` | The session folder |
| `--allow-crash` | off | A crash of an app process does not fail a step |
| `--no-preflight` | preflight on | Skip the preflight checks |

### Starting state and cleanup

`--clear-data`, `--reset-permissions`, `--reset-permission PERMISSION`,
`--grant PERMISSION`, `--revoke PERMISSION`, `--deny PERMISSION`,
`--profile automation` (animations off) and `--launch [ACTIVITY]` (with
`--expect-text` / `--expect-rid` to wait for the first screen) run at open, in
that order, each verified. `--reset-permissions` returns every runtime
permission to its fresh-install state, clearing "don't ask again", so the
app's permission dialogs appear as on a first run; `--reset-permission` does
that for one permission. `--deny` is the opposite: revoked with "don't ask
again" (user-set and user-fixed), so the app's dialog for it never shows.
A recorded test opens with the permissions it was recorded with (see
[recording](recording.md#how-the-test-starts)). When the app's start shows a
permission dialog, `--launch` succeeds without waiting for `--expect-*` and
reports `permission_dialog: true`: the next step answers it.

`session close [--exit-code N]` undoes them newest first: a setting or
permission goes back to its prior value (an unset setting is deleted again; a
`--deny` restores the grant and both flags), but only where the device still
shows what the session set; a value someone else changed meanwhile is
reported under `cleanup.conflicts` and left alone. Faults injected while the
session was open are cleared. Launching, clearing data and resetting
permissions have nothing to undo.

Close then writes `summary.json` (result, failing step, steps, cleanup,
notifications the session left behind such as a missed call) and
`report.html`, and releases the device. A trap can call close before open ever
ran: a `--session-file` that was never written closes nothing, and closing an
already closed session is a no-op.

### Preflight

At open, warnings (never failures) for: system UI in front (shade, lock
screen, a system or permission dialog), an `http_proxy` set by something
other than Olef, a device clock more than two minutes off, and leftover
notifications from the dialer or the app.

### Nesting

Opened by a caller that already holds the reservation (an agent running the
test it just recorded), `session open` nests: the new session gets its own
token, settings (the app is inherited when not given), folder and cleanup, and
shares the reservation. Its `session close` returns to the outer session.
Closing the outer session closes nested ones first, innermost first. A nested
session writing into its outer session's folder (a sub-flow script under
`test run`) adds to that journal, and only the outer session writes the
summary.

### Cached facts

The session remembers the device's boot id, its adb transport and the verified
Olef server. While they hold, a command skips the authority anchor
shell and the server probe; any failed command clears the cache, and the next
command re-probes. A boot, a reconnect (new adb transport) or `connect`,
`disconnect`, `test -- …` and `doctor` also re-probe.
`OLEF_SESSION_CACHE=0` turns the cache off. On a Pixel_9 API 36
emulator (debug build), `ui find` in a session took 71 ms p50 without the
cache and 55 ms with it, the same as outside any session; the saving grows
with the device's shell latency (the S14 spike measured 70–80 ms on a slower
emulator).

### Guards

In a session with `--app`:

- **Foreground.** Before an input action, the app must be in front. If it
  isn't, the command fails at once, before any input (`input_delivered:
  false`): `app_not_in_foreground` with `detail.reason` `process_gone` (died
  or killed; the environment's fault when a fault was injected) or
  `other_app` (which one); `app_crashed` / `app_not_responding` when it
  crashed; `covered_by_system_ui` with `detail.panel`
  (`notification_shade`, `permission_dialog`, `system_dialog`, `keyguard`),
  the environment's fault.
- **Crash.** A crash or ANR of any of the app's processes (`pkg:remote`
  too) during an action or `ui wait` fails it with `app_crashed` /
  `app_not_responding` and the parsed stack.
- Per action: `--allow-other-app` (the step leaves the app on purpose),
  `--allow-crash`, `--dismiss-system-ui` (collapse the shade, retry once,
  recorded as a flake signal).

### The session folder

```text
.olef/sessions/<id>/      (or --run-dir / $OLEF_RUN_DIR)
  journal.jsonl     every command: argv, step, kind, outcome, input_delivered, timings, screen identities, crash events, flake signals
  screens/          per-action screens (gzipped JSON) and half-size JPEGs, with --capture steps
  failures/<step>/  the failure report (report.json), the screen and screenshot now, the app's error log lines
  summary.json      result, failing step, steps, cleanup
  report.html       all of the above for people
```

The journal is also what [recording](recording.md) works from: `record save`
turns it into a test folder. While the device viewer records, each touch, key
and run of typing the person does goes into the same journal (`source:
viewer`, resolved against the screen at touch-down, with its screens and
screenshot), and `record start|stop|step|mark|check|discard` leave markers
in it. With `--capture steps`, an action that checked nothing keeps the
screen once it settled, and its entry names the element it acted on; an
action refused before any input (a misspelt id, a refused guard) is
journaled with `input_delivered: false`. The viewer's own helper commands
(`OLEF_NO_JOURNAL=1`) are not journaled.

Steps come from `OLEF_STEP`. PIN digits and tokens are never written;
with `--redact`, argv goes through the redaction policy. Folders are
owner-only, and folders under the default location are pruned after 7 days
(`sessions.retain_days` in config).

### Failure reports

A command that fails in a session carries `detail.test_failure`: where (test,
step, command), the cause in plain words with its `fault` (`app`, `test`,
`environment`, `olef`) and the guard's `reason`, expected versus
actual (the step's recorded screenshot `screens/<step>.jpg` from the test
folder next to the screen now, the closest on-screen texts, error texts the
app shows), near misses (`closest` selectors), the app (in front, processes,
crashes, error logs), the device (airplane, Wi-Fi, data, `http_proxy`,
active and recent faults), timing, and a suggested fix. The envelope's
`fault` follows the report.

## Reserve, observe, act, release

Use one driver per device. Advisers can read immutable artifacts or use `session observe`; separate devices can have independent drivers. Different packages, activities, screens or Git worktrees on one device do not isolate Android's foreground state, input, permissions, debugger or instrumentation slot.

## Reserve, observe, act, release

Select an already running device. Open a reservation with an agent label, then pass the returned opaque `session` value through the root `--session` flag (placed before the subcommand) or the `OLEF_SESSION` environment variable on every driver command. Subcommand-level `--session` flags, such as `net log --session` and `debug stack --session`, name capture and debugger sessions instead.

```bash
olef -d emulator-5554 session open --agent implementer
olef -d emulator-5554 --session TOKEN ui dump
olef -d emulator-5554 session observe --subscription reviewer
olef -d emulator-5554 --session TOKEN session close
```

For redacted output, use a private token file. `--token-out` creates a new file with owner-only permissions and keeps the token out of stdout, even without `--redact`. Existing files (including symlinks) are never overwritten. The root `--session-file` flag, or `OLEF_SESSION_FILE`, reads that token without putting it in the command line. It cannot be combined with `--session` / `OLEF_SESSION`.

```bash
olef -d emulator-5554 --redact session open --agent implementer --token-out driver.token
olef -d emulator-5554 --session-file driver.token --redact ui dump
olef -d emulator-5554 --session-file driver.token session close
```

Redacted `session open` and `session handoff` require `--token-out` before changing ownership. Store the file privately and remove it after the reservation closes. If opening or handing off fails after the file was written, retain it while checking `session status`; ownership publication may already have succeeded.

Tokens coordinate cooperating clients; they are not an authentication boundary against someone with ADB or filesystem access. The agent label is diagnostic, not ownership proof. A new driver must observe fresh state before its first ordinary command: `session open` does that itself, and a handoff recipient runs `session observe`. Observation captures device identity, foreground, the existing server's screen if available, and crashes for that subscription. An unavailable screen remains unavailable; observation never installs, starts, repairs, or reconnects the server. Capture timestamps describe a window, not an atomic screen/device sample.

Use a unique subscription for every adviser. Reading one subscription does not advance another one's cursor. Crash reads are bounded logcat observations, not a durable device event archive; initialize the subscription before the experiment, and retain evidence for long investigations. Logcat rotation can lose older events.

Unreserved ordinary commands acquire a temporary per-command gate. A reservation extends ownership across an entire multi-command journey. Conflicting commands receive `device_reserved` or `device_operation_busy`. Locks are independent per selected device and are held throughout `test -- ...`, including when Olef releases Android's UiAutomation slot. A passive adviser cannot reconnect during that handoff.

## One shared authority

The default ownership directory is `~/.olef/authority`. All cooperating clients must use the same physical directory and a filesystem with reliable cross-process locks. `--authority-dir` / `OLEF_AUTHORITY_DIR` supports a shared mounted directory. Sharing copies of the directory does not share locks. The implementation supports this host's ADB server at `127.0.0.1:5037`.

A device-side marker binds a live reservation to the authority and selected serial. It rejects a competing private registry and another transport alias to the same device. A local owner index protects control of an owned proxy/recorder when Android is offline. Outside a session, a device-changing command claims the marker for its duration; read verbs (`ui dump`, `ui find`, `ui wait`, `app current`, …) skip it unless they must bring the server up or attach the runtime. Markers are removed on clean release; persistent OS lock files are never unlinked. Reservations include the observed boot ID and a monotonically increasing generation. Reusing a serial after reboot does not silently reuse a running session.

This is a cooperative authority for current CLI clients. Direct ADB, older clients, Android Studio and human input can act outside it. Do not run those writers during an experiment. Remote authorities, access control, scoped specialist grants and device pools remain later work. C1 endpoint-level enforcement against arbitrary HTTP/ADB clients is not claimed by this local gate.

## Handoff and recovery

Stop the device's proxy and recorder before closing or handing off. Long-running writers must finish first. A handoff context JSON object should include the candidate/build, verification plan, backend/account namespace, restored or intentionally transferred settings, relevant evidence, and the recipient's starting point.

```bash
olef -d emulator-5554 --session TOKEN session handoff --agent verifier --context handoff.json
olef -d emulator-5554 session status
```

Handoff returns a new token, invalidates the previous token, retains the context and its hash, and requires the recipient to observe again. The caller is responsible for declaring application/backend starting state correctly; the context itself is not proof of cleanup.

With redaction, pass `--token-out recipient.token` to handoff and give the recipient that private file. The recipient uses `--session-file recipient.token`; the old token file no longer authorizes commands.

Reservations never expire automatically. A killed CLI that had already dispatched a device mutation, or a mutation whose delivery is unknown (for example a request that timed out after it was sent), leaves its operation journal unresolved. A command interrupted before its first device mutation, such as a `ui wait` killed by a tool timeout, left the device unchanged: the next command, or `session close`, clears it even on a reserved device and reports `stale_operation_cleared` with outcome `no_device_change`. Failures with a known outcome, such as a stale `--if-screen` guard or an unmet `--expect-*` postcondition, complete normally. On a reserved device, neither elapsed time nor a missing PID authorizes reassignment, and `session status` retains the request, command, start time and prior boot identity. Without a reservation, the next command clears the unresolved entry once the process that wrote it has exited, and its response carries a `stale_operation_cleared` event with outcome `unknown`: observe the device before repeating the command. No action is replayed automatically.

While an operation is quarantined, the current owner may still run `net stop`, `video stop`, or `disconnect` for cleanup. These commands retain the original unknown request.

Recovery is deliberately conservative: inspect the unknown outcome, stop all related external test/build/ADB workers, reboot the selected device, then use the current owner's token with `session recover --external-workers-stopped`. The command verifies a changed boot identity and records the external-worker attestation; it cannot prove that arbitrary external processes were stopped. Observe again before continuing. The interrupted request remains `unknown`, even after recovery succeeds. Do not delete authority state or lock files to bypass this check.

The reboot is not needed when every mutation of the interrupted command was UI input that the Olef server injects itself (taps, gestures, keys, text, scrolls, slider moves), such as a `ui long-tap` whose CLI was killed, and the journal recorded which server process received it. Then `session recover --external-workers-stopped` succeeds on the same boot when that server reports no request still executing (`requests_in_flight` 0 in `/v1/state`, proof `server_idle`), or when that process has exited (proof `server_process_exited`). While the request is still running, recovery refuses: retry once it finishes. Anything sent over adb, a server route that can start device work outliving the request (app lifecycle, settings, files, intents), a server too old to report its requests, or a journal written before this check still requires the reboot. The outcome stays `unknown` and the owner must observe again either way.

A real-device session suite exercises competing drivers, passive observers, private-authority rejection, separate devices, independent crash cursors, handoff, instrumentation handoff and interrupted-process recovery. It intentionally crashes the sample app and reboots its explicitly selected dedicated emulator.
