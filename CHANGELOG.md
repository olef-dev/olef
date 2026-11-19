# Changelog

Release notes for Olef. Every release, with its binaries, is on the
[Releases page](https://github.com/olef-dev/olef/releases).


## v3.11.2

Workspaces on your own Mac or Linux host now get their emulator when the host runs as a service.

- A host installed with `olef host service install` finds the machine's Android SDK, so its workspaces boot an emulator. Run `olef host service install` again after upgrading, then restart the service.

## v3.11.1

Steadier device resets on your own hosts, and host pools for workspaces and agents.

- Device resets no longer quarantine a Fire TV or a Galaxy phone because of
  changes the system makes on its own, such as caches, HDMI modes and
  settings logs.
- A phone on wireless debugging is no longer rebooted by a reset, so it
  stays connected.
- `olef host unquarantine <device>` offers a quarantined device again.
- `olef host pools` and `olef host grant` choose who may use your hosts;
  `olef cloud agent ... --pool` runs an agent's work on them.
- `olef host set runtime vm` now runs workspaces in VMs on a Linux host.
- Fixes agent runs on your own hosts.

## v3.11.0

Run Olef Cloud workspaces on your own Mac or Linux machine.

- `olef lab` is now `olef host`. A machine you register with
  `olef host register` can lease its devices, run workspaces, or both.
- `olef host set runtime native` lets the machine run workspaces; sessions
  use its own Android SDK and emulator, and the viewer, sync and SSH work as
  they do in the cloud.
- `olef cloud link --on host:<name>` puts a new workspace on one of your
  org's hosts; the web app's New workspace page has the same choice.
- Workspaces on your own hosts don't count against your plan's workspace
  and session limits.

## v3.10.0

Share your app with testers: they install it, and get new versions, from
the Olef Android app.

- `olef builds push` builds your app (or takes the APK you name) and stores
  it in your Olef Cloud project; `--share Testers` sends it to testers.
- `olef testers add EMAIL…` invites people by email, including people
  outside your org.
- `olef builds list` and `olef builds share` show and share stored builds.
- The project's module and variant can be set in `.olef/config.json`
  (`"distribution"`) or on the project page.

## v3.9.2

- `ui text --value-env NAME` on a cloud device types the workspace's stored
  secret (`olef secret set NAME`) when NAME isn't set on your machine, and
  says so with `value_source: "workspace_secret"`. A value set on your
  machine still wins.

## v3.9.1

Fixes for cloud workspaces and agents, and a cloud emulator you can use as a
local adb device.

- `olef cloud attach` makes the cloud emulator a local adb device for Android
  Studio, scrcpy and your own scripts; `olef cloud detach` removes it.
- `ui text --value-env` and the new `olef cloud run --env NAME` send values
  from this machine as secrets that never show up in logs.
- Cloud sync skips files over 16 MiB and lists them all, with lines to add
  to `.olefignore`.
- Fewer false alarms from the secret guard on `gradle.properties` and debug
  keystores; a failed build names the files it held back.
- `app apply` in the cloud uses the module and variant from
  `.olef/config.json`, and says where they came from.
- A session someone stopped stays stopped, and commands say so clearly; an
  outdated CLI is told to update.
- Agents: a follow-up no longer loses its work when the branch moved; at the
  agent-slot limit a request fails right away and says how to free a slot;
  queued requests can be cancelled.

## v3.9.0

Cloud agents that review pull requests, and a Linux desktop in every
cloud workspace.

- `olef secret` and `olef file` replace the old cloud secret commands, with
  credentials bound to hosts and files in the agent's home.
- Ask an agent to review a pull request; it returns findings with tests
  Olef verified, and posts the review when asked. Pull requests from forks
  run without credentials.
- `olef cloud agent create` takes a template, a repository and
  instructions; `olef cloud agent apply -f` sets one up from a file.
- New guide: `olef commands --guide review`.
- Every cloud workspace has a Linux desktop (a terminal, Chrome, a file
  manager): `olef cloud desktop` opens it in the browser, `--vnc` in a VNC
  viewer. One person drives at a time; others watch.
- Agents can be given the desktop too; you can take control of it during a
  run at any time.
- `olef-apt install` adds Ubuntu packages to a workspace.

## v3.8.0

Olef Cloud on networks that allow only HTTPS.

- `olef cloud doctor` has a `network` check that says what's blocking each
  Olef host.
- `HTTPS_PROXY` and `NO_PROXY` are honored by every cloud command.
- Only outbound TCP 443 is needed.
- The cloud guide and skill cover general and web workspaces, previews,
  hibernation and restricted networks.
- A malformed preview link now says it isn't valid.

## v3.7.0

Hibernation, and a clear lifecycle for cloud workspaces.

- Idle general and web workspaces hibernate after 30 minutes and resume in
  seconds with processes kept; Android workspaces can opt in.
- `olef cloud hibernate`, and `olef cloud status` shows the lifecycle.
- Hibernated workspaces stop after 3 days; a stopped workspace's files are
  deleted 90 days after last use, with emailed notices.
- Org owners and admins can adjust these policies.

## v3.6.0

Previews: a web app running in a cloud workspace, in your browser.

- `olef cloud preview open <port>` opens a workspace port at a private
  address, starting the workspace if needed; hot reload works.
- Only the workspace's owner and collaborators can open a preview.
- `olef cloud preview ls|rm`, `--no-browser` and `--workspace`.
- The hosted MCP has `open_preview`.

## v3.5.0

SSH and port forwarding for cloud workspaces.

- `olef cloud ssh` opens a shell or runs a command in the workspace, with no
  passwords or host-key prompts.
- `olef cloud ssh-config` lets `ssh`, `scp`, `rsync` and IDE Remote-SSH reach
  workspaces.
- `olef cloud forward <port>` brings a workspace port to this machine;
  `forward ls|stop` manage background forwards.
- `olef cloud ssh-key ls|add|rm`, and `--workspace` reaches shared
  workspaces.

## v3.4.0

Cloud workspaces that aren't Android.

- `olef cloud link --template general|web` links any project to a workspace
  with Node, Python and build tools (web adds a Vite starter); they start
  faster and cost about half as much.
- Device commands on those workspaces answer `capability_missing`.
- The cloud connection works through a corporate `HTTPS_PROXY` and needs
  only port 443.
- Idle stop now defaults to 30 minutes.

## v3.3.2

A cleanup release.

- `olef commands --guide cloud` covers inboxes, agents, schedules and event
  sources.
- Clearer error hints; a webhook with a bad signature gets
  `invalid_signature`.
- An agent run replaced by a newer attempt can no longer push to the
  repository.
- The API reference documents escalation, admission, typed services,
  validators, schedules and owner transfer.

## v3.3.1

One way to connect event sources, and one way to share things.

- `olef cloud connect <github|jira|webhook>` and
  `olef cloud connection ls|show|rm|rotate-secret`.
- `olef cloud route add|ls|rm` sends a connection's events to an inbox;
  `olef cloud events ls|show|replay` shows what arrived.
- Signed webhooks let any system send events to an agent.
- `olef cloud account`, `olef cloud repos`, and `olef cloud grant|grants` for
  sharing.
- Removed: `olef cloud jira`, `olef cloud share`, `olef cloud project grant`.

## v3.3.0

Agents can now be started on a schedule and from Jira.

- `olef cloud schedule create` sends a request on a recurring (`--rrule`) or
  one-off (`--at`) schedule, with `ls|show|preview|occurrences|pause|resume|rm`.
- `olef cloud jira connect` and `jira route` let people send Jira issues to
  an agent, or send JQL matches automatically.
- A run started from Jira text needs approval to message another team's
  inbox.

## v3.2.0

Unanswered agent questions escalate step by step, up to the org owner, until
someone answers.

- `olef cloud escalation preview|show|ack|replan`, and
  `escalation policy show|set|rm` for custom paths.
- `olef cloud team set --parent --responder --owner` nests teams and names
  who answers for each.
- `olef cloud inbox publish` publishes typed services with checked request
  and response schemas; `olef cloud validator upload` adds validators.
- Outside messages to a public inbox wait for admission
  (`olef cloud inbox admissions`, `olef cloud msg admit`).

## v3.1.0

Olef Cloud agents now work through inboxes: send a request to an agent and
it opens a draft pull request.

- `olef cloud inbox ls|show|create|send|messages|watch` sends messages and
  follows changes.
- `olef cloud msg` inspects, cancels or retries requests and answers an
  agent's questions.
- `olef cloud thread show|timeline` and
  `olef cloud agent ls|create|show|run|events|stop` show conversations and
  manage agents.
- The hosted MCP has six generic inbox tools; the alpha tasks API is removed.
- Org owners and admins get an audit log of agent actions.

## v3.0.3

Fixes for the device viewer, Codex plugin and Olef Cloud builds.

- Codex finds your project's Cloud workspace even when the plugin starts
  outside the project.
- The viewer's Logs, Network and Builds rows render correctly.
- Public certificate files upload with your project; a build that fails on a
  held-back file shows how to allow it.
- Cloud builds can add SDK platforms and build tools, and include Android
  platform 37.0.

## v3.0.2

A reliability and security release from a full code audit, with a few new
options.

- JSON errors carry a `hints` list; read it instead of the prose in `msg`.
- `olef watch` prints a heartbeat line after 15 s of quiet (`--heartbeat-ms`).
- `net start --block-host`/`--block-local` and `net passthrough add --host`
  for hosts that pin their certificate.
- `olef devices` in a linked project lists this machine's devices first.
- Fixes for apps left frozen by the debugger, leased phones and labs, and
  Cloud sync.

## v3.0.1

A smoother move from ShadowDroid, plus fixes.

- `olef init` removes the old `shadowdroid` plugin after installing Olef's,
  and sets aside outdated ShadowDroid skills.
- `olef cloud login` signs in through olef.dev; existing logins keep working.
- Tests recorded with v2 run unchanged: `SHADOWDROID_*` variables are read
  when the `OLEF_*` ones aren't set.
- Fixes for leased lab TVs in the viewer, missing remote error output, native
  watchpoints on x86_64 emulators, and the lab service after a Homebrew
  upgrade.

## v3.0.0

**ShadowDroid is now Olef:** the same product under a new name, with a new
home at [olef.dev](https://olef.dev). Updating moves you across.

- The command is `olef`; a `shadowdroid` command is installed next to it, so
  scripts keep working.
- Settings and project folders move to their Olef names on first run, and
  environment variables are now `OLEF_*` (`olef doctor` lists old ones).
- The agent plugins are `olef`: run `olef init`, then remove the old
  `shadowdroid` plugin.
- Install with `brew install olef-dev/tap/olef`; see
  [Updating Olef](https://github.com/olef-dev/olef/blob/main/docs/updating.md).
- Sign in to Olef Cloud with an email link.

## v2.7.4

Lab fixes.

- A lab phone on wireless debugging stays online when its adb name changes
  after a restart.
- Your own lab works without access to the real-phones preview.
- On a lab host, run `shadowdroid lab service install` with the new CLI, then
  `lab service stop` and `lab service start`.

## v2.7.3

Viewer fixes for lab devices.

- The lease tooltip no longer shows a nonsense idle timeout for lab devices.
- The viewer names the leased device by its kind ("Release this TV").

## v2.7.2

A device viewer that's easier to use on tablets, phones and narrow panes.

- Bigger toolbar and zoom buttons, with zoom moved to the status bar.
- Narrow panes keep one toolbar row and move the rest into the settings menu.
- "Live · idle" on a still screen instead of "0 fps", and sharper video on
  wide panes.
- Primary buttons use the ShadowDroid red.

## v2.7.1

A lab fix for Samsung phones.

- Labs no longer quarantine a Samsung phone over Galaxy continuity settings
  that change on their own.
- On a lab host, run `shadowdroid lab service install` with the new CLI, then
  `lab service stop` and `lab service start`.

## v2.7.0

Pair with teammates on ShadowDroid Cloud workspaces.

- A shared workspace's viewer shows who is here and who is driving; Take
  control and Hand back pass control between you.
- `shadowdroid cloud share add|rm` invites a teammate to pair on (or
  `--watch`) a workspace.
- `shadowdroid cloud project` defines a team's app: its repository, shared
  environment, secrets and members.
- Org owners decide whether admins may look inside a member's workspace; the
  member sees who and why.

## v2.6.3

Viewer video and lab fixes.

- No more smeared video after a late frame: the viewer restarts the stream
  with a fresh key frame.
- Lab devices show their own name in the viewer, which stops cleanly when
  the lease ends.
- Labs come back within seconds after a device host restart.
- ShadowDroid Cloud: streamed output no longer lags in workspaces with
  secrets.

## v2.6.2

Steadier live video.

- Older devices (Android 9, Fire TV sticks) no longer show half frames and
  "Decoder error" restarts in the viewer over Wi-Fi or a device lab.

## v2.6.1

Fixes for device labs and hot apply.

- Live video works on Android 9 devices such as Fire TV sticks.
- Hot apply works on machines without the emulator package, such as CI
  runners.
- A lab lease that ends before it's ready says why (`cloud_device_offline`).
- `lab` reports a device's screen as width, height and density.

## v2.6.0

Today's approval for billed phones now lives on your ShadowDroid Cloud
account.

- Approve real phones billed to ShadowDroid once a day (up to $10), and
  agents on any of your machines reserve within it.
- `ddp.budget_usd_per_day` no longer stands in for that approval; it can
  only lower it.

## v2.5.0

Your own device lab: phones, TV sticks and other devices on your machine,
leased through ShadowDroid Cloud from anywhere.

- `shadowdroid lab register|add|pair|serve` (preview) turns this machine into
  a lab; your own lab devices are free.
- `devices reserve lab:<lab>/<device>` attaches a lab device from any machine;
  every command works on it, and the lab resets it after each lease.
- TV devices get an on-screen remote in the viewer.
- Team orgs with `cloud org list|use|create|invite|members|leave`, and
  `cloud plan` for plans.

## v2.4.0

One device picker for everything your app can run on, and secrets for
ShadowDroid Cloud workspaces.

- The viewer, the MCP `devices` tool and `devices list` show attached
  devices, AVDs, your Cloud emulator and real phones with price and
  availability.
- Billed devices need a daily budget or your approval for the day (up to $10).
- `cloud secret set|list|rm` stores write-only environment variables and
  files for your cloud workspace, masked in output.
- Reserved phones stay connected through repeated stream drops.

## v2.3.0

Real phones from Google Cloud, driven like a USB device (preview), and
annotations that show where each note is.

- `devices catalog`, `devices reserve ddp:<id>` and `-d ddp:<id>` reserve and
  drive phones from Google's Developer Device Platform, billed to your Google
  Cloud project or (limited preview) your ShadowDroid account.
- Spending guardrails: `ddp.budget_usd_per_day`, a confirmation before
  reserving, `devices leases`, and release after idle time.
- `net` works on devices that refuse `adb reverse`.
- Viewer annotations come back as one image per screen with every note
  outlined and numbered.

## v2.2.0

Record a flow once and replay it as a test without AI, and try ShadowDroid
Cloud, an invite-only alpha.

- `shadowdroid record save <name>` turns a viewer or agent recording into a
  test script with a screenshot of every step.
- `shadowdroid test run` runs tests with repeats, parameters and retries and
  writes JUnit, HTML and flake reports; also `test lint|show|heal`.
- `session open` sets up the starting state: app, cleared data, launch and
  permission state.
- ShadowDroid Cloud: `cloud login` and `cloud link` run commands, builds and
  the viewer on a cloud emulator, with no Android SDK on your machine.
- `ui long-tap`, `swipe` and `drag` now take their requested duration.

## v2.1.0

ShadowDroid is now free for everyone, tells you when a new release is out,
and lets your agent report ShadowDroid bugs for you.

- The [ShadowDroid License](https://github.com/shadowdroid-dev/shadowdroid/blob/main/LICENSE.md)
  v1.1 drops the 10-user limit and the commercial license.
- A once-a-day update notice; turn it off with `SHADOWDROID_NO_UPDATE_CHECK=1`.
- `shadowdroid feedback draft` writes a redacted report you review before
  `feedback submit` sends it.
- Every JSON error has a `fault` (`shadowdroid`, `environment`, `usage` or
  `app`), and internal crashes are an `internal_panic` error.

## v2.0.8

Hardened UI automation, Apply Changes and Java/native debugging.

- Debugger snapshots and native crash capture work while the app is paused,
  with several LLDB fixes.
- An uncertain tap is never repeated automatically, and text actions report
  requested and observed text separately.
- Apply Changes rejects paused apps before building and shows live progress,
  timings and compiler diagnostics.
- `session open` and `session handoff` take `--token-out`; `--session-file`
  reads a private token file.

## v2.0.7

`shadowdroid init` now adds ShadowDroid to Claude Code and Codex for you.

- `init` installs or updates the agent plugins, asking first; `--plugins`
  skips the question and `--no-plugins` leaves plugins alone.
- Claude Code asks before device actions by default; skip the prompts with
  `/config` or `shadowdroid init --auto-approve-device-actions`.
- Every MCP tool says whether it only reads, can undo work on the device, or
  reaches outside it.

## v2.0.6

Faster `app apply` when an edit touches a library's API, and viewer
annotations that point at the right code.

- Adding fields, constants, methods or constructors to a library no longer
  rebuilds every module (47 s to 4–6 s on a 429-module app).
- Project config takes a default `module` and `variant`
  (`config init --module/--variant`).
- `--fresh-viewmodels` restarts the activity with new ViewModels, and
  `ui wait`/`app wait` take `--timeout 30s`.
- The global `--apk` is now `--server-apk`.
- Annotations resolve to what's drawn on top, and the viewer no longer shuts
  down another session's emulator.

## v2.0.5

Much faster `app apply` on large multi-module apps: a one-line library edit
on a 428-module app went from about 5 minutes to 4.6–6 s.

- Library edits rebuild and send only the classes that changed.
- Builds reuse one Gradle connection per project.
- `app apply` and `build` timings report more detail.
- Fixes: apps with product flavors reinstall, a long `build` keeps its device
  reservation, and hot apply works on Compose 1.11.

## v2.0.4

A license, open-source notices, the device viewer in Codex, and plugins that
help set themselves up.

- Released binaries are under the
  [ShadowDroid License](https://github.com/shadowdroid-dev/shadowdroid/blob/main/LICENSE.md);
  `shadowdroid licenses` prints it with the open-source notices.
- The Claude Code and Codex plugins tell you how to install a missing or
  outdated CLI or adb on first run.
- The Codex plugin now shows the live device viewer.
- `config init --user --show-device <viewer|window>` picks how the agent
  shows you the device.
- Config files with unknown keys no longer make every command fail.

## v2.0.3

ShadowDroid 2 puts the whole Android development loop in your agent's hands,
with no IDE in the middle.

- `app apply` puts each edit on the device the cheapest correct way, usually
  in place in about two seconds with app state kept.
- Its own debuggers: Java/Kotlin, and native C/C++ on the NDK's LLDB
  (`debug attach --mode native|mixed`), with no Android Studio.
- `runtime` gives layout trees, Compose recomposition counts and coroutine
  dumps from any debuggable app, with no build changes.
- Claude Code and Codex plugins with a live device viewer, annotations and
  tap-to-test recording; Windows support.
- Breaking: the Android Studio integration and the in-app AAR are removed,
  and ShadowDroid now ships as binaries from the `shadowdroid-dev` org.

## v1.3.0

Fault injection, deeper Android Studio integration and incremental UI reads,
plus more than 90 reliability fixes.

- `shadowdroid fault` puts the device or app into 37 failure conditions
  (network, power, lifecycle, configuration, interruptions) and undoes them;
  proxy faults and seeded `fault run` scenarios too.
- Android Studio: layout snapshots link elements to Compose source,
  `layout recompositions` can show only what recomposed, and the debugger is
  more reliable.
- `ui dump --since <screen_hash>` reports only what changed.
- Network: more complete HAR and curl exports; `net replay --clear` stops
  serving fixtures.
- Breaking: the root `--session` flag must come before the subcommand (or
  set `SHADOWDROID_SESSION`).

## v1.2.0

Experimental requirement verification and coordinated agent sessions.

- Verification plans map requirements to checks and record evidence, with
  baseline regression comparison (`shadowdroid commands --guide verification`).
- Android behavior checks: guarded journeys, lifecycle experiments,
  configuration matrices, SQLite/Room snapshots, visual comparisons and
  accessibility findings.
- Concurrent agents: one driver per device, passive observers, explicit
  handoff and recovery after interrupted operations.
- TLS dependency update for RUSTSEC-2026-0285, plus proxy, font-scale and
  theme-restoration reliability fixes.

## Earlier releases

See the [Releases page](https://github.com/olef-dev/olef/releases) for v1.1.0 and earlier.
