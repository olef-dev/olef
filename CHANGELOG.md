# Changelog

Release notes for ShadowDroid. Every release, with its binaries, is on the
[Releases page](https://github.com/shadowdroid-dev/shadowdroid/releases).


## v2.0.6

This release keeps `app apply` fast on large multi-module apps when an edit
touches a library's API, and makes annotations in the device viewer point at
the right code.

- **Additions don't rebuild every module:** any change to a library class's
  API used to rebuild every library module and the app module; adding a
  public constant took 47 s on a 429-module app. Code compiled before an
  addition can't refer to it, so new fields, constants, static or final
  methods and constructors no longer rebuild anything. Removals, re-typing,
  changed constant values, supertypes, new abstract or overridable methods,
  new enum constants and annotations still do. A change is judged against
  what the other modules were last compiled with, not the previous apply.
  The same edit now takes 4–6 s.
- **Library modules without edits are skipped:** a class-level apply had
  Gradle check every library module's classes jar (~2.4 s on a 428-module
  app). Modules whose sources and build file haven't changed since the last
  build are skipped, unless the change can reach them. `libraries` reports
  `modules_skipped` and `unskipped`; opt out with `SHADOWDROID_APPLY_SKIP=0`.
- **A default module and variant:** `.shadowdroid/config.json` takes `module`
  and `variant`, at the top level and per app alias, and
  `config init --module/--variant` writes them. `app apply` and the MCP
  `build` tool use them when not told, so a project whose app isn't `:app`
  in `debug` no longer needs `--module` and `--variant` on every apply.
- **Restarts on request:** `--at-least restart-activity` restarts the
  activity even when nothing changed, and the new `--fresh-viewmodels` (the
  MCP `build` tool's `fresh_viewmodels`) restarts it with new ViewModels.
- **Timeouts with units:** `ui wait` and `app wait` take `--timeout 30s`
  (also `500ms`, `2m`) besides `--timeout-ms`.
- **`--server-apk`:** the global `--apk` is ShadowDroid's own device server,
  not the app's APK, so it's `--server-apk` (and `$SHADOWDROID_SERVER_APK`)
  now. `--apk` and `$SHADOWDROID_APK` still work.
- **Annotations on View screens** name the layout file and the code that
  uses the view (its binding, its id), not just view classes like
  `ConstraintLayout`.

#### Fixes

- **Annotations resolved to what was underneath:** an area over a bottom
  bar's tab could resolve to a card scrolled under the bar. The device
  server now reports each element's drawing order, and clicks, areas and
  recorded taps resolve to what's drawn on top. The source is looked up by
  the element itself, not by its first text.
- **The viewer shut down someone else's emulator:** the MCP server killed
  emulators it booted by serial, and serials are reused, so after a plugin
  reconnect it could stop an emulator another session had started on the
  same port. It now checks it's the same emulator run before shutting it
  down, and never shuts down one it can't tell.
- **A fix after a composition error didn't show:** a change that threw while
  composing paused the composition, and the fix never resumed it. The
  runtime now resets the error and retries the failed composition.
- **Every apply waited 600 ms for crashes:** after a restart or reinstall it
  waits 150 ms; after a hot change, until the app draws a frame with it. A
  hot apply that redraws takes ~0.45 s less.
- **Library resources went unnoticed:** edits to a library module's
  resources, assets, JNI/AIDL sources, manifest or build file now reinstall.
- **Composables without a group** (ones that return a value) reported a hot
  apply that redrew nothing; their callers are recomposed now.
- **Body-only edits to suspend functions** rebuilt every module: moving the
  lines Kotlin lists in a coroutine's `@DebugMetadata` read as an API change.
  It's ignored now.
- **Suspend functions fell back to the slow merged-dex path** on apps with
  over 65,536 strings in a merged dex (26–53 s instead of ~5). Methods with a
  `switch` or `try/catch` are compared up to their encoding now, and changes
  to a `when` case's value or an array literal alone are noticed.
- **Notes after a restart** no longer suggest `--at-least restart-activity`
  when the activity was just restarted.
- **`ui wait --stable` returned before the app drew anything:** an empty
  screen isn't settled now (with `--pixels`, a still screen without elements
  counts).
- **"Send to Claude" in the viewer** arrived framed as a message from the
  plugin; it's submitted as your own prompt now.

Update with `shadowdroid update` and run the command it prints. In Claude Code,
run `/plugin marketplace update shadowdroid`; in Codex,
`codex plugin marketplace upgrade shadowdroid`.

## v2.0.5

This release makes `app apply` fast on large multi-module apps. On a
428-module app (AGP 9.4), a one-line edit in a library module went from
~20 s to 4.6–6 s as a hot apply, and from ~5 minutes with 2.0.4.

- **Library edits skip the merged dex:** AGP 9 dexes library modules into
  merged buckets, so one changed class rewrote a ~13 MB bucket and finding
  the change meant splitting it again. `app apply` now brings the library
  modules' class jars up to date (through an init script it adds to the
  build), diffs them class by class, and dexes only the changed classes with
  AGP's own D8 and classpath. Before anything is sent, the old classes are
  checked against what the device runs; anything it can't vouch for builds
  the merged dex as before, and `libraries.fallback` says why. The app
  module's own dex is rebuilt only when its sources changed or the library
  change can reach into it (a new signature, constant or annotation, or an
  inline function it uses). Turn it off with `SHADOWDROID_APPLY_LIBS=0`.
- **One Gradle connection per project:** builds go through a small JVM that
  keeps a Gradle Tooling API connection open and runs D8 in-process, instead
  of starting the Gradle wrapper and a D8 JVM every time. It's compiled on
  first use against the project's own Gradle distribution and exits after
  30 idle minutes. Builds it can't run use `./gradlew` as before. Turn it
  off with `SHADOWDROID_GRADLE_WORKER=0`.
- **Splits and callers once per content:** per-class splits of dex files and
  the index of which composables call a method are kept by content hash, so
  the old side of a diff, and a library bucket that didn't change, are read
  once.
- **Timings say more:** `timings` in `app apply` and `build` results adds
  `libs_ms`, `archives_ms` and `callers_ms`, and `libraries` reports which
  path library code took.

#### Fixes

- **`app apply` took ~5 minutes on a large app** to analyze a one-line
  library edit: it ran `dexdump` on every class of the changed merged dex.
  It now reads only the classes that differ.
- **Apps with product flavors** couldn't reinstall: `app apply` and `build`
  looked for the APK in `outputs/apk/<variant>/`, but AGP writes a flavored
  variant's APK to `outputs/apk/<flavors>/<buildType>/`.
- **A long `build` lost the device reservation:** the MCP server released a
  reservation unused for 3 minutes, counting a build still running as unused,
  and every later call failed with `device_reserved` until the lease was
  closed by hand.
- **Compose 1.11:** the runtime read the composition's old slot-table field,
  so every hot apply on Compose 1.11 said the change wasn't on screen. It now
  reads the new one, and says "unknown" rather than "not on screen" when it
  can't tell.
- **Shared helper classes:** D8 generates helpers like
  `…$$ExternalSyntheticBackport0` per class, and the APK keeps one copy under
  another class's name. A hot apply could send a class that calls a helper
  the app doesn't have; now that helper is loaded with it.

Update with `shadowdroid update` and run the command it prints. In Claude Code,
run `/plugin marketplace update shadowdroid`; in Codex,
`codex plugin marketplace upgrade shadowdroid`.

## v2.0.4

This release adds ShadowDroid's license and its open-source notices, brings the
device viewer to Codex, and makes the Claude Code and Codex plugins set
themselves up on a machine that doesn't have the CLI yet.

- **License:** released binaries are licensed under the
  [ShadowDroid License](https://github.com/shadowdroid-dev/shadowdroid/blob/main/LICENSE.md):
  free for personal use, education, open-source projects, and organizations
  with up to 10 users; organizations with more than 10 users need a commercial
  license for the users beyond the first 10. The Claude Code and Codex plugins
  are Apache-2.0. Every release archive includes `LICENSE.md`; the Homebrew
  formula and Scoop manifest declare it.
- **Open-source notices:** `THIRD-PARTY-NOTICES.txt` lists the licenses and
  notices of every open-source component ShadowDroid includes (the Rust crates
  in the CLI, the libraries in the on-device service, the code in the runtime
  agent). It ships in every release archive and as a release asset, and the
  new `shadowdroid licenses` command prints it with the license.
- **Claude Code plugin, first run:** when a session starts and the
  `shadowdroid` CLI or `adb` is missing or too old, the plugin tells Claude the
  install command for the machine (Homebrew or the installer on macOS and
  Linux, Scoop or the PowerShell installer on Windows) and shows you a
  one-line note. Claude runs it only with your approval. It stays silent when
  everything is installed.
- **Codex: the device viewer:** the Codex plugin now ships the MCP server,
  an `android-device` skill and the same first-run install check, so Codex
  can show the live device viewer in its in-app browser. `shadowdroid mcp`
  recognizes the agent app it serves (Claude, Codex or another client) and
  words instructions, consent and hints for it; the viewer sends notes and
  recorded steps to Codex through a thread deep link. Device reservations
  follow the Codex thread, so parallel Codex threads don't share a device.
- **`show_device` setting:** choose how the agent shows you the device, the
  live viewer (default) or the emulator's own window:
  `shadowdroid config init --user --show-device <viewer|window>`, or per
  project. It works the same in Claude Code and Codex.
- **The CLI skill comes with the plugins:** both plugins ship the generated
  `shadowdroid` skill next to `android-device`. With a plugin installed,
  `init`, `skill --sync` and `connect` stop installing that agent's separate
  user skill and set an unedited copy aside, so the skill isn't listed twice.
  `shadowdroid skill` still installs it for Cursor, Gemini CLI and
  Antigravity.
- **Plugin listing details:** the Claude Code plugin declares its icon,
  documentation, support, privacy policy and terms links for plugin
  directories, and both plugins carry an icon.

#### Fixes

- **Config files with unknown keys** no longer make every command fail. Keys
  a newer ShadowDroid wrote are ignored, kept by `config init`, and reported
  by `config validate` as warnings. Versions before 2.0.4 still reject them,
  so the plugins now require 2.0.4 or newer.
- **`app apply` errors:** a stack trace the app logs is reported once, by the
  line that starts it, with its first frame and last cause, instead of a
  run of `at …` frames.

Update with `shadowdroid update` and run the command it prints. In Claude Code,
run `/plugin marketplace update shadowdroid`; in Codex,
`codex plugin marketplace upgrade shadowdroid`.

## v2.0.3

ShadowDroid 2 puts the whole Android development loop in your agent's hands,
with no IDE in the middle. It applies each code change to the running app,
debugs Kotlin, Java, C and C++ on its own debuggers, inspects layouts and
coroutines from inside the app, and opens a live device viewer in Claude Code
so you can watch, point and record. This is the first 2.x release; it includes
everything since v1.3.0.

Highlights:

- **Apply Changes from the CLI:** `app apply` puts each edit on the device the
  cheapest correct way, usually in place in about two seconds with app state
  kept.
- **Its own debuggers:** Java/Kotlin over JDWP and native C/C++ over the NDK's
  LLDB, with no Android Studio.
- **The ShadowDroid runtime:** layout trees, Compose recomposition counts and
  coroutine dumps from any debuggable app, with no build changes.
- **Plugins for Claude Code and Codex,** including a live device viewer with
  annotations and tap-to-test recording.
- **Windows** support for the CLI, debuggers, runtime and viewer.
- **Breaking:** the Android Studio integration and the in-app AAR are removed,
  ShadowDroid moved to the `shadowdroid-dev` organization, and it is now
  distributed as binaries only.

### Apply Changes

`shadowdroid app apply` builds incrementally, compares the new code with what
the device runs, and picks how the change reaches the app:

- **hot:** redefines the changed classes in the running app and recomposes
  only the composables you edited, keeping state above them. On API 30+ new
  methods, fields and classes apply in place too.
- **restart_activity:** when code that already ran changed (lifecycle,
  ViewModel init, a started flow).
- **reinstall:** when nothing safer is possible, with the reason.

The result reports `action`, `reasons`, `takes_effect`, what changed on
screen, crashes, Compose composition errors, errors the app logged and failed
requests. It covers library modules, lists, dialogs, Views and fragments.

### Debuggers

This release gives ShadowDroid its own debuggers and removes the Android
Studio integration. An agent can now attach to a debuggable app, stop it, read
its state and step through it, in Kotlin, Java, C and C++, using only the adb
connection ShadowDroid already owns and, for native code, the NDK's LLDB. No
IDE is involved.

- **Java/Kotlin debugger:** the `debug` verbs talk JDWP to the app through
  adb, held by a small per-process daemon. Attach to a running app, or launch
  it under the debugger with `debug attach --wait-for-launch --break
  File.kt:LINE` so breakpoints are in place before the first line runs.
  Line, exception and method breakpoints support conditions, pass counts,
  temporary and disabled states, and lambda selection with `--variant`.
  Logpoints have a bounded, cursored event stream and are rate-limited.
  Stepping, stacks, threads, variables, `eval` and `inspect` with object
  handles work, as do watches, coroutine listing and crash capture with
  `run-until-crash`. See [debugging](docs/debugging.md).
- **Native and mixed debugging:** `debug attach --mode native` debugs C and
  C++ code on the NDK's LLDB, and `--mode mixed` attaches both engines to one
  process. Attach to a running app or at launch (`--wait-for-launch`).
  Symbols come from the project's unstripped Gradle outputs, matched by
  build-id, or from `--symbols`. Line, function, address and data
  (watchpoint) breakpoints, native logpoints in the same event stream as Java
  ones, stack, threads, variables with C++ STL types rendered, `eval`, and
  `debug native registers|memory|disassemble|modules|symbols|step-instruction`.
  Real crashes stop at the faulting frame with `suspend_reason: "crash"` and
  the signal; ART's own SIGSEGV/SIGBUS use passes through untouched
  (`--signal-policy smart`, the default). Detaching lets Android write the
  tombstone (`debug tombstones list|pull`). In mixed mode verbs route by file
  extension, breakpoint id, session id or `--engine java|native`, and Java
  verbs fail fast with `native_engine_stopped` while LLDB holds the process.
  `snapshot`, `run-until-crash`, `auto`, `record` and `watch` include the
  native engine. Needs an NDK on the host (`SHADOWDROID_NDK`,
  `ANDROID_NDK_HOME`, ... or `<sdk>/ndk/<version>`); works on Linux, macOS
  and Windows. See the "Native and mixed debugging" section of
  [debugging](docs/debugging.md).
- **Method calls are opt-in:** `--invoke` lets `eval`, conditions, logpoints,
  watches and coroutine snapshots call methods such as `toString()`, getters
  and Kotlin properties. A thrown exception comes back as a result. Without
  the flag, nothing runs app code.
- **Property watches without slowing the app:** Kotlin properties are watched
  through their setter or getter. A field with no setter is watched at the
  instructions that write it, found in the app's dex files, so the app keeps
  full speed. A real field watch, which slows the whole app, needs
  `--accept-slowdown` and expires after `--duration-ms`.
- **ANRs:** a stop in an app that was already running can trigger Android's
  "not responding" dialog. The session reports it and suggests
  `debug attach --relaunch`, which restarts the app under the debugger with the
  same breakpoints. Apps launched under the debugger never raise ANRs.
- **`debug clients`, `debug record` and `watch`:** these now run on the
  standalone debugger. `debug clients` lists the device's debuggable
  processes and the sessions attached to them; `debug record` and `watch`
  take debugger state and logpoint hits from the debugger daemons.
- **Debugger reads during other commands:** read-only debugger verbs
  (`debug status`, `stack`, ...) keep working while another command runs,
  such as a `ui tap` blocked on an app stopped at a breakpoint. Debugger verbs
  that need the device lock wait up to 10 s for it.
- **`ui tap` on an unresponsive app:** a click the app never answers within
  about 4–5 s (main thread busy or stopped at a breakpoint) now returns
  `tap_unconfirmed` instead of `tap_failed`. The click is queued and may still
  run, so do not repeat it blindly; `input_delivered` is unknown,
  `app_unresponsive` is true, no coordinate fallback is injected, and the next
  actions point at `debug status`.
- **Doctor:** an advisory `debugger` check reports whether the standalone
  debugger can run, whether the app is debuggable and who holds it. An
  advisory `native` check reports the NDK, LLDB and an `lldb-server` for the
  app's ABI.
- **Testing:** CI jobs run the debuggers end to end on an emulator:
  `scripts/e2e-jdwp-debugger.sh`, and `scripts/e2e-native-debugger.sh` for
  native and mixed debugging against the sample app's new Native Lab.

### Android Studio integration removed

Breaking: the Android Studio plugin, the Studio debugger backend and the
Studio Layout Inspector bridge are gone. Every `debug` verb runs on
ShadowDroid's own debuggers, and layout data comes from the
[ShadowDroid runtime](#shadowdroid-runtime). Android Studio still works as
your IDE alongside ShadowDroid; it is just not a backend. JDWP allows one
debugger per process, so ShadowDroid's and Studio's debuggers cannot attach to
the same process at once.

- `shadowdroid init` installs the agent skills only. `--no-studio-plugin`,
  `--install-studio-plugin`, `--studio` and `--plugin` are hidden and ignored,
  so old scripts keep working.
- `shadowdroid studio`, `debug attach --dialog`, and the backend auto-routing
  (`backend_reason`) are removed. The hidden `debug --backend` still accepts
  `auto` and `jdwp`; `studio` is rejected.
- Config keys `studio_url`, `android_studio`, `studio_plugin`, `debugger`,
  `debug_backend` and `run_configuration` are deprecated and ignored. They
  still parse so configs load, and `config validate` warns.
  `debug_mode` still sets the default attach mode, now `java`, `native` or
  `mixed`.
- `doctor` no longer checks Studio or the plugin.

### ShadowDroid runtime

Layout inspection, Compose recomposition counts and coroutine dumps no longer
need Android Studio or an app dependency: the CLI attaches its own in-process
runtime to any debuggable app, the mechanism Android Studio's Layout Inspector
uses.

- **`runtime attach|status|detach`:** a JVMTI agent (`libshadowdroid_agent.so`,
  published per ABI and verified by checksum) is copied in with `run-as` and
  loaded with `attach-agent`, or at process start with `--startup`. A
  per-process host daemon talks to it over an adb abstract socket that accepts
  only adbd and requires a per-attach token. Detach restores every hooked
  class.
- **Layout on the runtime:** `layout snapshot --compose/--semantics/--source-map`,
  `layout recompositions`, `layout source`, `ui dump --deep` and
  `ui tap --fallback-id` read the app's own Compose inspector (version-matched
  from the app's Compose UI dependency) and a built-in view inspector, and
  attach on demand. Source files resolve under `--project-root`, with the
  Compose package hash telling same-named files apart. Results carry
  `backend: runtime` and `backend_reason`.
- **`runtime coroutines`:** live coroutines (state, context, suspension and
  creation stacks) from the app's kotlinx DebugProbes, with no build changes;
  `runtime attach --startup --restart --coroutine-probes` tracks from process
  start.
- **Doctor:** `doctor --app <pkg>` adds an advisory `runtime` check (run-as,
  API level for attach and startup attach).

Removed, with no compatibility shims:

- The in-app debug AAR, its OkHttp companion, and the `aar` verbs
  (`install/status/remove/agent/capture/intercept/resume/drop/coroutines`),
  including the Gradle dependency rewriting and the coroutine-probes ASM
  block. Coroutine dumps moved to `runtime coroutines`; interception stays on
  the `net` proxy, and in-process network capture is planned for the runtime.
- The Android Studio plugin's Layout Inspector routes (`/v1/layout/*`).
- `--studio-url` on `layout` and `ui dump/tap`, and the hidden
  `--studio-wait-ms` alias (use `--timeout-ms` / `--deep-timeout-ms`).
- The layout payload key `android_studio_layout` is now `layout_inspector`
  (also `fallback.layout_inspector` in `ui dump --deep`), and
  `sample.studio_required` is `sample.enrichment_required`.

### Device viewer and plugins

- **`shadowdroid mcp` and `shadowdroid pane`:** an MCP server and a live
  device viewer (H.264 from the device, in Claude Desktop's browser pane or
  Chrome). Tap, drag, type, pinch (Option-drag on emulators), rotate, zoom,
  hear the emulator, take screenshots and recordings.
- **Annotations** (Cmd+E): point at an element or area and write what should
  change; Claude gets the element, a selector, a crop and, in debuggable
  Compose apps, the composable and source line that drew it.
- **Record steps** (Cmd+T): your taps and typing become selector-based steps
  Claude can turn into a UI test.
- **Claude Code plugin:** `/plugin marketplace add shadowdroid-dev/shadowdroid`
  and `/plugin install shadowdroid@shadowdroid`. Claude works through the CLI
  and opens the viewer when you ask to see the device. Device control needs
  your consent in the viewer, kept for 12 hours; APK installs always ask.
  Each session reserves the devices it uses, so parallel sessions never share
  one.
- **Codex plugin:** `codex plugin marketplace add shadowdroid-dev/shadowdroid`
  and `codex plugin add shadowdroid@shadowdroid`.
- **The same from the CLI:** `emulator list|boot|kill`, `ui path` (one or two
  fingers along timed points), `pane annotations` and `pane steps`.

### Agent experience

- **Leaner by default:** a satisfied `--expect-*` returns a screen summary
  instead of the whole screen (`--full` for everything), `commands --json` is
  compact, and the skill leads with the core loop. In a 21-task benchmark,
  agents finished 48% faster with 34% fewer tokens than with adb and the
  `android` CLI.
- **Occlusion-aware taps:** a target covered by the keyboard, a dialog, a
  system bar or another view is refused with `element_occluded`, naming the
  cover; `--allow-occluded` overrides.
- **`ui wait --stable`:** waits until the screen stops changing
  (`--stable-ms`, `--pixels`); `screen_unstable` names what kept moving.
- **`ui audit --a11y`:** missing labels, 48dp touch targets, WCAG text
  contrast, duplicate names, stacked clickables.
- **Popup windows** (tooltips, dropdowns, menus) are part of the UI tree, so
  selectors and `ui wait` find them.
- **`SHADOWDROID_HOME`** moves all host state, for sandboxed agents.
- Parallel read commands wait for the device instead of failing, and an
  interrupted read no longer leaves the device locked inside a session.

### Windows

The CLI and its test suite, the Java and native debuggers, the runtime agent
and Compose layout inspector, and the device viewer all run on Windows. SDK
tools are found without extra setup, and the proxy CA is trusted without
openssl.

### Security and reliability

- **The proxy verifies upstream TLS by default.** A self-signed, expired or
  wrong-host certificate fails the request with a 502 that says why;
  `net start --insecure-upstream` (or `proxy.verify_upstream: false`) opts out
  for a backend you trust.
- **Local control channels are authenticated:** the network proxy and video
  daemons require a per-daemon token and cap request sizes.
- Slow devices and CI emulators get more time: `connect` waits up to 30 s for
  the device service to start, and re-attaching a debugger right after a
  detach waits up to 40 s for Android to release the previous one.
- The device service restarts when it loses UI Automation after adbd restarts;
  `net trust --auto` restarts adbd as root on debuggable builds; `watch`
  streams logcat over the ADB protocol so it stops with `watch`; `doctor` warns
  when the device's proxy is dead; `app start` waits up to 15 s for the
  foreground; TV focus reaches targets across axes; toast capture, Android 17
  permission resets, legacy CA key import and several fault-injection edge
  cases are fixed.

### Distribution and updating

- **New home:** ShadowDroid moved to the
  [`shadowdroid-dev`](https://github.com/shadowdroid-dev) organization and
  [shadowdroid.dev](https://shadowdroid.dev). Install with
  `brew install shadowdroid-dev/tap/shadowdroid` or
  `scoop bucket add shadowdroid https://github.com/shadowdroid-dev/scoop-bucket`.
  The old `andriyo/...` URLs redirect, so existing installs keep updating.
- **Binaries only:** releases are no longer built from source with
  `cargo install`; v1.3.0 and earlier remain available at their tags. For a
  cargo-installed CLI, `shadowdroid update` now prints `cargo uninstall
  shadowdroid` followed by the installer.
- **`shadowdroid update`** is documented in [updating](docs/updating.md): it is a
  read-only check that prints the command for your install method.

### Known issues

- **Native debugging on macOS needs NDK 30 or newer.** NDK 29's LLDB does not
  start on macOS (it cannot find its bundled Python library);
  `debug native status` reports this. Install NDK 30 and point
  `ANDROID_NDK_HOME` (or `SHADOWDROID_NDK`) at it.
- **Native crash stops on arm64 emulators** can show ART's fault hook
  (`art_sigsegv_fault`) instead of the faulting line: LLDB does not unwind
  past it there. The signal and fault address are still reported, and x86_64
  emulators and devices stop at the faulting line.

Update with `shadowdroid update` and run the command it prints.

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
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/andriyo/ShadowDroid/releases/download/v1.3.0/shadowdroid-installer.sh | sh -s -- --version v1.3.0
```

Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -c "irm https://github.com/andriyo/ShadowDroid/releases/download/v1.3.0/shadowdroid-installer.ps1 | iex"
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

Read the [verification guide](https://github.com/andriyo/ShadowDroid/blob/v1.2.0/docs/verification.md)
and [session guide](https://github.com/andriyo/ShadowDroid/blob/v1.2.0/docs/sessions.md).

Install or upgrade on macOS/Linux:

```sh
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/andriyo/ShadowDroid/releases/download/v1.2.0/shadowdroid-installer.sh | sh -s -- --version v1.2.0
```

Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -c "irm https://github.com/andriyo/ShadowDroid/releases/download/v1.2.0/shadowdroid-installer.ps1 | iex"
```

Homebrew: `brew upgrade andriyo/tap/shadowdroid`. Scoop: `scoop update shadowdroid`
with the ShadowDroid bucket configured. APKs, agent AARs, Studio plugin, installers,
CLI archives, checksums and release provenance accompany this GitHub release.
Crates.io and IDE marketplace publication are separate distribution channels.

## Earlier releases

See the [Releases page](https://github.com/shadowdroid-dev/shadowdroid/releases) for v1.1.0 and earlier.
