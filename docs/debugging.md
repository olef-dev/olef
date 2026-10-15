# Triage and agent debugging

[← README](../README.md)

## When something goes wrong

Three verbs, in the order you'll usually reach for them:

```bash
shadowdroid why                       # verdict + evidence + next steps, in one read
shadowdroid log --last 5m --level e   # structured, app-scoped logcat behind it
shadowdroid collect                   # full offline bundle to hand off
```

**`why`** fuses the last crash/ANR (with stack frames mapped into your source
tree), recent error logs, the current screen, and network failures (when the
`net` proxy is up) into a single `verdict` — `app_crashed`,
`app_not_responding`, `tls_rejected`, `backend_errors`, `app_not_foreground`,
`log_errors_only`, or `no_obvious_cause` — with `evidence` and `hints`. It is
non-mutating: it reads the server only if that server is already reachable and
does not install/start it, create an adb forward, or change device state to get
a screen. Without a reachable server it marks screen evidence unavailable and
continues with adb/host evidence.

**`log`** is logcat shaped for an agent: scoped to the configured app by default
(`--all` for everything), windowed (`--last 60s`), filtered (`--level e`,
`--grep`, `--tag`), deduplicated (repeats collapse with a count), and with
crash/ANR blocks lifted out as parsed `{"type":"crash",…}` events — one JSON
object per line, then an action summary.

**`collect`** is the "I give up, here's everything" bundle: `doctor` output,
device info, logcat + crash buffer, screenshot, screen dump, and app state, all
in one directory. It degrades gracefully — the host-side diagnostics are
captured even if no already-established on-device server session is reachable,
without installing, starting, repairing, or forwarding one. `collect` is
passive with respect to device lifecycle: the selected device/AVD must already
be online, and it never starts an AVD, server, or adb forward. With global
`--redact` (or `redaction.enabled` in config), every JSON/text artifact is
filtered and the manifest records privacy status per file. Screenshot pixels
are never silently treated as safe: they remain marked potentially sensitive;
add `--redact-screenshots` to explicitly black out accessibility bounds
matching the active policy.

## The agent debugger

Driving a UI tells an agent *what* happened on screen; debugging tells it
*why*. ShadowDroid hands a coding agent a live debugger as plain JSON, so when
a tap doesn't do what the agent expected, it can set a breakpoint and read the
actual program state instead of guessing from screenshots. Reads are bounded,
while attach, pause/resume/step, breakpoint/watch changes, and evaluation have
normal debugger side effects. It is a debugger control surface, not a remote
shell.

Two standalone engines sit behind the `debug` verbs, with no IDE involved:

- the [Java/Kotlin engine](#javakotlin-debugger-jdwp), which speaks JDWP to
  the app through the adb connection ShadowDroid already owns;
- the [native engine](#native-and-mixed-debugging), which drives the NDK's
  LLDB for C and C++ code.

`debug attach --mode java|native|mixed` picks them (`java` is the default,
or set `debug_mode` in config); `mixed` attaches both to one process. The
verbs:

- **`debug auto [app]`** — low-effort path: resolve an app alias/name/package,
  launch it, attach the debugger, then return a full snapshot.
- **`debug`** — attach to the running app; set breakpoints (line, exception,
  method, field watchpoint, and for native code function, address and data
  watchpoints; conditional and temporary) and owner-scoped, non-suspending
  logpoints; read the call stack, local variables, and watches;
  evaluate/inspect expressions (`this`, locals, fields, array indexes) and
  follow object handles while the session remains suspended. Treat evaluation
  as real debugger evaluation rather than assuming arbitrary expressions are
  side-effect-free. Requests are bounded — they return structured failure
  instead of blocking without a suspended frame.
- **`debug snapshot`** — one shot: device + build, foreground app, screen tree,
  screenshot, recent logcat, the live debugger stack / variables / breakpoints,
  and a bounded page of recent logpoint events in a single JSON object.
- **`debug record` / `debug replay`** — JSONL timelines of screen changes,
  lifecycle, logcat, debugger state, structured logpoint hits, and replayable
  actions (taps, text, keys, swipes, drags).
- **`debug run-until-crash` / `step-until-screen-change` / `step-until-log`** —
  let the app run until something interesting happens, then return a full
  snapshot; crash waits emit parsed Java/native/ANR events and can write local
  bundles.
- **`debug clients`** — the device's debuggable processes and the sessions
  attached to them.
- **`debug native` / `debug tombstones`** — native readiness, registers,
  memory, disassembly, modules, symbols, instruction stepping, and tombstone
  files (see [native and mixed debugging](#native-and-mixed-debugging)).
- **`debug coroutines`** — conservative suspended-state coroutine insight
  without arbitrary code execution. (For whole-process coroutine dumps from a
  *running* app with no debugger attached, use `runtime coroutines`;
  `runtime attach --startup --restart --coroutine-probes` tracks from process
  start.)
- **`layout`** — UI-tree snapshots and diffs, enriched with Compose source
  locations, semantics, and recomposition counters from the ShadowDroid runtime
  (debuggable apps; attached on demand). Pass `--project-root` so nodes
  resolve to files.

Each engine runs in a small per-process daemon (`~/.shadowdroid/debug/<serial>/`
for JDWP, `~/.shadowdroid/native/<serial>/` for LLDB) that holds the session,
so verbs in later commands find it again; `debug detach` ends it and resumes
the app. The daemons run on macOS, Linux and Windows hosts. A daemon takes CLI
requests over a `0600` unix socket, or on Windows over a loopback port whose
per-daemon secret is kept in an owner-only file under `~/.shadowdroid`.

Sessions follow the same device ownership as every other driver command (see
[sessions](sessions.md)): attach and verbs that change the process (pause,
step, breakpoints, launch) need the reservation's `--session` token when a
device is reserved, and another driver gets `device_reserved`. Read-only
debugger verbs (`debug status`, `stack`, `variables`, ...) keep working while
another command runs, such as a `ui tap` blocked on an app stopped at a
breakpoint; debugger verbs that need the device lock wait up to 10 s for it.

A tap on an app stopped at a breakpoint (or with a busy main thread) cannot be
confirmed: after about 4–5 s `ui tap` returns `tap_unconfirmed`, with
`input_delivered` unknown and `app_unresponsive: true`. The click is queued
and may still run once the app resumes, so do not repeat it blindly; check
`debug status` first.

`shadowdroid doctor --json` (add `--app <pkg>` or configure an app) has two
advisory checks. `debugger`: whether this host can run the daemon, whether the
device's adb `jdwp` service answers, the API level, whether the app is
debuggable and who holds it. `native`: whether an NDK with LLDB is found and
whether it has an `lldb-server` for the app's ABI. Neither attaches anything.

<a id="standalone-debugger-no-android-studio"></a>

## Java/Kotlin debugger (JDWP)

`debug attach` (default `--mode java`) debugs the app directly over JDWP
through adb: no IDE, no plugin, no port forwards. JDWP allows one debugger per
process, so ShadowDroid's debugger and another debugger, such as Android
Studio's, cannot attach to the same process at once. Android Studio is still
a fine IDE to use alongside; it is just not a ShadowDroid backend.

What works:

- `attach`/`detach`/`sessions`/`status`, `pause`/`resume`/`step-*`,
  `continue-until`, `stack`, `threads`, `variables`, `eval`, `inspect`, object
  handles, `watch` (path expressions; `watch add --invoke` allows method
  calls, evaluated only at breakpoint or step stops), and the
  composed `auto`, `snapshot`, `record`, `run-until-crash`, `step-until-log`,
  and `step-until-screen-change`. Stepping the main thread cannot redraw the
  screen, so `step-until-screen-change` steps out to framework code, lets the
  app run, and pauses as soon as a screenshot hash changes
  (`mode: run_to_frame`).
- Line breakpoints resolved from your project sources (lambdas included;
  `--variant outer|lambda` picks the enclosing method or the innermost
  lambda, and a line with no such location reports
  `pending_reason: no_location_for_variant`), exception breakpoints, conditions,
  pass counts, temporary/disabled breakpoints, and
  [logpoints](#non-suspending-logpoints).
- Method breakpoints, set as line breakpoints at the method's first line and
  at each return. Kotlin property watches use the getter/setter. A field
  with no setter (a private property, a Java field) is watched at the
  instructions that write it (`--access`: read it), found in the app's dex
  files: the daemon pulls the APK once (`pm path`, cached by hash under
  `~/.shadowdroid/debug/<serial>/apk-cache/`) and sets a line breakpoint at
  each write in every class as it loads, with no slowdown; the breakpoint
  reports `strategy: write_sites` and its `sites` (class, method, line).
  `break field --accept-slowdown` sets a real field watch for a bounded
  `--duration-ms` (it slows the whole app while armed). A delegated property
  (`by mutableStateOf`, `by lazy`) keeps the getter/setter even then: its
  field holds the delegate and is never reassigned, so a field watch would
  not fire; the breakpoint's `note` says so.
- Startup code: `debug attach --wait-for-launch --package <pkg> --break
  File.kt:LINE` (or `debug auto --from-start --break …`) restarts the app
  under the debugger and installs breakpoints before the first line runs.
  `--break-exception CLASS` there stops only on exceptions app code does not
  catch (like `break exception --caught false`).
  With several launcher activities, pass `--launch-activity .Main`; otherwise
  the root of the app's last task (else the first launcher) is started and
  the result warns. A process launched this way raises no ANR dialog while
  stopped. Ctrl-C during the launch restores the debug-app setting and stops
  the waiting process.
- `run-until-crash` stops on an uncaught exception with the throwing frame
  and its locals still live, before the process dies.
- `debug coroutines snapshot` lists coroutines process-wide (name,
  dispatcher, state, suspended continuations) from a stopped session (pause
  first), read from fields only; coroutines running app code are listed
  first under `--limit`. The first snapshot of a session scans the loaded
  classes; later ones reuse that scan (`discovery.cached`). Add `--invoke`,
  at a breakpoint or step stop, to read each continuation's source line
  through `getStackTraceElement()` (bounded to 64 calls and 2 s; a `debug
  pause` stop reports `needs_event_stop`).

A bare name in an `eval`/`inspect`/`watch` path, a condition, or a log
expression resolves the way source does: a local first (an inlined Kotlin
`it\1` slot answers to `it`), then a field of `this` (inherited fields too),
then a static field of the frame's declaring class (a companion `const val`
included). The result says which one matched as `root_scope` (`local`,
`this_field`, `static_field`, ...), with `root_declaring_class` for fields; an
unknown name fails with the visible locals and the nearest field names.

Method calls are opt-in. Reads (fields, locals, array items, Kotlin
properties with a backing field) never run app code. `--invoke` on `eval`,
`inspect`, conditions, and logpoints allows getters, `toString()`, and other
calls (single-threaded, bounded by `--timeout-ms`); the catalog marks it as
a device mutation. Invocation needs a thread stopped by a breakpoint or step,
not by `debug pause`.

Limits:

- Attaching to an app that is already running keeps Android's ANR timers:
  with input pending, a stop raises "Application Not Responding" about 15 s
  later, and nothing on the device suppresses it safely. A session suspended
  for more than about 4 s warns; while it stays suspended the daemon checks
  `dumpsys window`/`dumpsys activity processes` every 2 s and reports
  `anr: {dialog, not_responding, since}` with a warning in `status`, `stack`,
  and `variables`. It never taps the dialog (Close App kills the app). For a
  long inspection run `debug attach --relaunch --package <pkg>`: it detaches,
  force-stops the app, and starts it again under the debugger with the
  session's line and exception breakpoints (plus any `--break` flags). That
  resets the app's state (`relaunch.app_state_reset`), and a process started
  that way has no ANR timers.
- Compose layout data (`layout`, `ui dump --deep`) does not come from the
  debugger: it comes from the runtime agent (`runtime attach`).
- Expressions use the deterministic path grammar (plus comparisons and, with
  `--invoke`, calls), not Kotlin compiled by an IDE.
- Field watches and method-exit events deoptimize the whole app; the
  defaults avoid them and the opt-in reports the cost.
- macOS, Linux or Windows hosts; Android 9 (API 28) or newer; debuggable apps
  (`android:debuggable`, i.e. debug builds). Only processes adbd lists on its
  `jdwp` service can be attached; a release build reports
  `process_not_debuggable`.

## Native and mixed debugging

`debug attach --mode native` debugs an app's C and C++ code with the NDK's own
LLDB; `--mode mixed` attaches the native engine and the Java engine to the
same process. The examples below use the Native Lab in the sample app
(`samples/shadowdroid-test-app`, activity `.NativeLabActivity`, C++ under
`app/src/main/cpp/`, package `io.github.andriyo.shadowdroid.sample`).

### Requirements

- An Android NDK on the host. ShadowDroid looks in `SHADOWDROID_NDK`,
  `ANDROID_NDK_HOME`, `ANDROID_NDK_ROOT`, `ANDROID_NDK`, then the newest
  `<sdk>/ndk/<version>`. Install one with
  `sdkmanager "ndk;29.0.14206865"`. It provides LLDB and the `lldb-server`
  for each device ABI.
- A debuggable app: the engine copies `lldb-server` into the app with
  `run-as`, which Android allows only for debuggable builds.
- macOS, Linux or Windows hosts.

`debug native status` reports readiness without attaching: the NDK, an
`lldb-server` for the app's ABI, debuggability, the local symbol files it
found, and tombstones on the device. `doctor --app <pkg>` has the same
advisory `native` check.

```bash
shadowdroid debug native status --package io.github.andriyo.shadowdroid.sample
```

### Attaching

Attach to the running app:

```bash
shadowdroid debug attach --mode native --package io.github.andriyo.shadowdroid.sample
```

Or start it under the debugger, so breakpoints are in place before its code
runs. `--wait-for-launch` starts the app under `am set-debug-app -w`; LLDB
attaches while the app waits, sets the breakpoints, then the Java engine
attaches (mixed) or the wait is released (native). `--break FILE:LINE` is
repeatable and goes to the engine its file belongs to: `.c`, `.cc`, `.cpp`,
`.cxx`, `.h`, `.hpp` and other C/C++ files to the native engine, `.kt` and
`.java` to the Java engine. `--break-function NAME` sets a native function
breakpoint; `--break-exception CLASS` stays Java.

```bash
shadowdroid debug attach --mode mixed --wait-for-launch \
  --package io.github.andriyo.shadowdroid.sample \
  --launch-activity .NativeLabActivity \
  --break field_lab_native.cpp:109 --break NativeLab.kt:32
```

A native session has the id `lldb:<serial>:<pid>` (a Java one
`jdwp:<serial>:<pid>`); `debug status` and `debug sessions` list both.
`debug detach` of a native session also detaches the Java session on the same
pid. A native session ends when its process dies.

### Symbols

The engine matches unstripped libraries to the loaded ones by ELF build-id.
Gradle outputs under the project root (`build/intermediates/cxx/...` and
`merged_native_libs`) are found automatically, so pass `--project-root` or set
`project` in config. Point `--symbols` at other files: one unstripped `.so`, a
directory of them, or a directory with `<abi>/` subdirectories (repeatable).
`debug native modules` lists the loaded libraries with load address,
build-id, and whether symbols are loaded (`--all` adds system libraries,
`--filter` narrows by name). `debug native symbols <path>` loads symbols into
a running session.

### Breakpoints and logpoints

```bash
shadowdroid debug break line --file packet.cpp --line 26
shadowdroid debug break function --name fieldlab::fib --condition 'n == 0'
shadowdroid debug break address --address 0x7a3c41b2f0
shadowdroid debug break data --expression g_native_counter --access write
shadowdroid debug logpoint add --file packet.cpp --line 26 --expression sample
```

- `break line` takes C/C++ files in a native or mixed session, with
  `--condition` and `--temporary`. A line in a library that is not loaded yet
  stays pending (`bound: false`) and binds when the library loads (the Native
  Lab's "Load late library" button, `field_lab_late.cpp`).
- `break function` takes a C/C++ name (`fieldlab::fib`), or a regex with
  `--regex`; `--module lib.so` limits it to one library. Conditions and
  `--pass-count N` apply.
- `break address` stops at a code address.
- `break data` is a watchpoint: it stops when memory is written
  (`--access write`, the default), read (`read`), or either (`read-write`).
  `--expression` names a variable in scope or a global; `--address` watches an
  address instead; `--size` is at most 8 bytes. A watchpoint reports after
  the store, so the stop can be on the next line.
- `logpoint add` on a C/C++ line does not suspend the app. Its hits (for
  example `sample = 20`) go to `debug logpoint events`, `follow`, and the
  `watch` and `debug record` timelines, with the same schema as Java
  logpoints.

Native breakpoint ids are `nbp_N` (Java ones `bp_N`); `debug breakpoints`
lists them and `debug break remove --id nbp_1` removes one.

### Inspecting a stop

The usual verbs work on a native stop: `debug stack`, `threads`, `variables`
(C++ STL types are rendered), `eval`, `pause`, `resume`, `step-over`,
`step-in`, `step-out`, and `continue-until`. `debug eval` reads values through
LLDB; an expression that must run code in the app, such as
`packet.samples.size()`, fails with `invalid_expression` and a hint to add
`--invoke`.

```bash
shadowdroid debug stack --limit 4
shadowdroid debug variables --depth 0
shadowdroid debug eval packet.origin.station
shadowdroid debug native registers                  # --set floating for others
shadowdroid debug native memory --expression packet --count 16
shadowdroid debug native disassemble --count 8      # or --function / --address
shadowdroid debug native step-instruction           # --over steps over calls
```

`native memory` reads at most 4096 bytes (`--count`, default 64) from an
`--expression` or an `--address`. Pointer and register expressions such as
`'$pc'` use their value as the address; non-pointer variables read the object's
storage. Cast an integer address to `void*` to read what it points to.

### Crashes

`--signal-policy smart` (the default) passes every signal to the app
untouched, because ART uses SIGSEGV and SIGBUS itself for null checks and its
GC. A SIGSEGV that ART does not own stops at ART's `art_sigsegv_fault` hook,
and SIGABRT, SIGILL, SIGFPE and SIGSYS stop directly. Either way the session
stops at the faulting frame with `suspend_reason: "crash"` and a `signal`
object:

```json
{"suspend_reason": "crash",
 "position": {"source": "field_lab_native.cpp", "line": 48},
 "signal": {"number": 11, "name": "SIGSEGV", "code": 1, "fault_address": "0x0",
            "caught_at": "art_sigsegv_fault"}}
```

The frame's locals are still live. Resuming lets the app die; detaching lets
Android write its tombstone. `debug tombstones list` and
`debug tombstones pull --out <dir>` fetch the tombstone files.
`--signal-policy stop` also stops on every SIGSEGV as it is raised; use it for
diagnosis only, because it can disturb ART. `debug run-until-crash` waits for
native crashes too.

### Mixed mode

With both engines on one process, verbs route by themselves: a file
extension picks the engine for `break line` and `logpoint add`, a breakpoint
id (`nbp_N` or `bp_N`) for `break remove`, and a session id (`lldb:` or
`jdwp:`) for `--session`. The global `--engine java|native` picks one
explicitly. With none of these, the native engine answers while LLDB has the
process stopped or when no Java session exists, else Java.

While LLDB holds the process stopped, Java verbs fail fast with
`native_engine_stopped`: resume the native engine first. In the Native Lab,
"Native callback" calls from C++ into Kotlin's `describe()` and back, which
gives a mixed stack:

```bash
shadowdroid debug stack --engine java     # native_engine_stopped
shadowdroid debug resume --engine native  # runs on to NativeLab.kt:32
shadowdroid debug eval value --engine java
shadowdroid debug resume --engine java
```

A failed Java attach in mixed mode rolls back the native attach.
`debug snapshot`, `debug run-until-crash`, `debug auto`, `debug record` and
`watch` include the native engine.

### Long stops

Like the Java engine, a native stop in an app that was already running keeps
Android's ANR timers, and the session warns when Android may raise an ANR.
For a long inspection, start the app with `--wait-for-launch`: an app launched
under the debugger raises no ANR.

### Troubleshooting

- `SHADOWDROID_LLDB_TRACE=1` prints LLDB process events into the daemon log,
  `~/.shadowdroid/native/<serial>/<pid>.log`.
- `SHADOWDROID_LLDB_LOG=1` also writes LLDB's own gdb-remote packet log to
  `~/.shadowdroid/native/lldb-<pid>.log`. It is slow.

## Non-suspending logpoints

Logpoints observe a source line without leaving the app paused on successful
hits. They need only an attached session; a C/C++ line goes to the native
engine. The source must match the installed build. Conditions and expressions
run in the app's debugger context; with `--invoke` they can call code, mutate
state, block, or throw. Stack rendering and high-frequency hits add more
overhead. "Non-suspending" is not the same as free or side-effect-free.

| Command | Purpose |
| --- | --- |
| `debug logpoint add` | Add or update a line logpoint with `--expression`, `--log-message`, and/or `--log-stack`; optional `--condition`, `--pass-count`, `--temporary`, ownership, rate, and message-size bounds apply in the same operation. |
| `debug logpoint list` | List configured logpoints, optionally filtered by session, id, or owner. |
| `debug logpoint events` | Read one bounded page of structured hit events, optionally strictly after a paired `--after <cursor> --stream-id <stream_id>`. |
| `debug logpoint follow` | Follow new hits as JSONL; it starts at the live tail unless paired `--after` / `--stream-id` values or `--replay-existing` are supplied, and can stop by duration or event count. |
| `debug logpoint remove` | Remove one ShadowDroid-owned logpoint when its id and owner match. |
| `debug logpoint clear` | Remove only ShadowDroid-owned logpoints in the requested owner scope. |

On the Java engine, `debug logpoint add` validates the condition and
expression before the logpoint is armed. A validation or configuration
failure leaves no new logpoint and an existing one unchanged. At least one of
`--expression`, `--log-message`, or `--log-stack` is required. `--force` skips
set-time expression validation; a bad expression can then fail at runtime, where the
failure is recorded as an `evaluation_error` event and the app keeps running.
Use it deliberately because evaluation can still have side effects.
`--temporary` keeps the first hit, then removes the logpoint.

Each hit is a structured event with a monotonic cursor plus logpoint, source,
debugger-session/device, and ownership context. The payload's `message` joins
the optional default hit message, the expression output, and an optional
rendered stack in one string; they are not promised as separately parsed
fields. `debug snapshot` includes a bounded recent page; `debug record` and
`watch` interleave hits as ordered timeline records; the dedicated `events`
and `follow` commands support narrower session/id/owner filters.

The history is bounded and kept by the debugger daemon. Pages report a
`stream_id` and `oldest_cursor`, `latest_cursor`, and `next_cursor`; `--after`
means strictly newer than that cursor. Cursors belong to one stream, so
resuming requires both `--after <cursor>` and the page's
`--stream-id <stream_id>`. A one-shot read rejects a mismatched stream instead
of returning ambiguous events; a follower discards the mismatched page and
resets to the new live tail with a warning. Each daemon start is a new stream.
If a consumer falls behind the retained history, `overflowed:true`,
`evicted_total`, and a cursor-gap warning make the loss explicit. Bound hot
sites with `--condition`, `--pass-count`, or `--max-events-per-second` (Java
default 20, at most 100); page-level `rate_limited_total` reports suppressed
hits instead of allowing memory to grow without limit. `--max-message-chars`
marks oversized events with `message_truncated:true` and retains
`original_message_chars`; its supported range is 256 through 65,536. Global
`--redact` scrubs supported JSON/JSONL output, including snapshots and
recordings, but it cannot stop the expression from being evaluated.

Ownership is the cleanup boundary. The default is `shadowdroid`; concurrent
agents should use distinct `--owner` labels and pass the same label to `remove`
or `clear`. These lifecycle commands neither repurpose nor delete ordinary
breakpoints or logpoints owned by somebody else (`logpoint_not_owned`,
`logpoint_owner_mismatch`). Prefer them over generic `debug break remove` for
temporary agent instrumentation.

## Addressing multiple sessions

`debug sessions` (and `debug status`) report each session's device, stable
`id` (`jdwp:<serial>:<pid>` or `lldb:<serial>:<pid>`), and current numeric
index. Prefer `--session <id>`; the index remains available for convenience
but can change as sessions start/stop. Global `-d <serial>` selects that
device's session when no explicit session is supplied. `debug clients` lists
the device's debuggable processes and the sessions attached to them.

## Graceful degradation

Everything degrades gracefully: with no debugger attached, the device and UI
commands still work. Without an NDK only native debugging is unavailable, and
`debug native status` and `doctor` say what is missing. Layout enrichment
needs a debuggable app, not a debugger.
Run `shadowdroid debug --help` and `shadowdroid layout --help` for the live
command surface.
