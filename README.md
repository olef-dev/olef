<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/brand/olef-logo-on-dark.svg">
    <img src="docs/assets/brand/olef-logo-on-light.svg" alt="Olef" width="320">
  </picture>
</p>

# Olef CLI for Android

**Give your coding agent eyes, hands, and a debugger for Android.**

Olef CLI for Android (`olef`) connects Claude Code, Codex, Cursor, Gemini CLI,
Antigravity, and any shell-capable coding agent to real Android apps, emulators,
and physical devices. Every call returns compact, structured JSON with the next
step built in.

**Website:** [olef.dev](https://olef.dev/engineers) ·
**Docs:** [olef.dev/docs](https://olef.dev/docs) ·
**Releases:** [latest](https://github.com/olef-dev/olef/releases/latest) ·
**Report a bug:** [new issue](https://github.com/olef-dev/olef/issues/new/choose)

## What it does

Once it's installed, your coding agent uses `olef` behind the scenes while you
talk to it in plain language.

- **Output for agents.** Commands return short JSON: the screen as a list of
  elements, whether a step did what it should, and suggested next commands.
  `olef watch` streams screen changes, crashes, logs and network calls as they
  happen. In our benchmark with Codex, tasks took about half the time and a
  third fewer tokens than with `adb` and the Android CLI
  ([comparison](https://olef.dev/docs/engineers/compare)).
- **Applying code changes.** `olef app apply` builds the app and swaps the
  changed code into the running process, keeping the screen and its state, also
  when composables and functions are added, removed or moved, or a string or
  colour changes. When that isn't possible it restarts the activity or
  reinstalls, and says why. It reports crashes, errors and what changed on
  screen. `olef app preview` shows a `@Preview` on the device.
- **Live device view.** In Claude Desktop and Codex, the device can be shown
  next to the chat. You can use it directly, mark problems on the screen for
  the agent, or record a flow for it to turn into a test.
- **UI automation.** Taps and reads use text, labels or test tags rather than
  coordinates, also inside WebViews. Elements can be traced back to the source
  line that drew them, and commands wait for the screen to settle.
- **Debugging.** `olef why` summarises the last crash or error. There's a
  debugger for Kotlin, Java and native code, and a view of running coroutines.
  App databases and settings can be read and changed while the app runs, and
  WorkManager jobs can be run on demand.
- **Performance.** Measures startup time (cold, warm or hot), slow and dropped
  frames, and screens or ViewModels kept in memory after they close, with the
  references holding them. Frame checks can fail when they go over a set limit.
- **Network.** A built-in proxy shows the app's requests and flags failed ones.
  It can replay saved responses with no backend running, or change responses as
  they arrive, including WebSocket messages.
- **Fault injection.** Kills the app in the background, cuts or slows the
  network, fills storage, puts the device into Doze or moves the clock, and
  undoes each change afterwards.
- **Device control.** Starts and stops emulators, grants and revokes
  permissions, copies files to and from the app's private folders, saves and
  restores app state, and records the screen.
- **Sessions.** Several agents can run at once, each on its own reserved
  device. A session keeps the app and wait settings, records what happened, and
  restores permissions, settings and faults when it ends
  ([sessions](docs/sessions.md)).
- **Tests.** A recorded flow becomes a Bash script that runs in CI without AI
  and writes JUnit and HTML reports. Repeated runs mark flaky tests, a failed
  test gets a suggested fix, and screenshots can be compared.
- **Verification.** An agent can check a change against a list of requirements
  and keep the screen, network calls and screen recording for each check, lined
  up in time.

## Install

Requires Android Platform Tools (`adb`) on your `PATH` for local devices and
emulators. If you don't want an Android SDK or emulator on your machine, see
[Olef Cloud](#olef-cloud-for-android-developers).

### 1. Install the CLI

macOS and Linux (Homebrew):

```bash
brew install olef-dev/tap/olef
```

<details>
<summary>Other platforms (shell installer, Windows Scoop, PowerShell)</summary>

Shell installer (macOS, Linux):

```bash
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/olef-dev/olef/releases/latest/download/olef-installer.sh | sh
```

Windows (Scoop):

```powershell
scoop bucket add olef https://github.com/olef-dev/scoop-bucket
scoop install olef
```

Windows (PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -c "irm https://github.com/olef-dev/olef/releases/latest/download/olef-installer.ps1 | iex"
```

Prebuilt binaries for every platform are also attached to each
[release](https://github.com/olef-dev/olef/releases).

</details>

### 2. Connect your coding agent

Run `olef init` to install or update the plugins for Claude Code and Codex (it
asks first) and add the skill for Cursor, Gemini CLI, and Antigravity.

<details>
<summary>Or install the Claude Code / Codex plugin directly</summary>

In Claude Code:

```
/plugin marketplace add olef-dev/olef
/plugin install olef@olef
```

In Codex:

```bash
codex plugin marketplace add olef-dev/olef
codex plugin add olef@olef
```

</details>

See the [Claude Code plugin](claude-plugin/README.md) and
[Codex plugin](codex-plugin/README.md) guides for viewer options, annotations,
and permissions.

### 3. Ask your agent

Start an emulator or connect a device with USB debugging, then ask your agent
about your app rather than typing `olef` commands by hand:

- *"Build the app, run it on the Pixel 9 emulator, and check why sign-in fails."*
- *"Show me the device so I can try the onboarding flow and annotate what looks off."*
- *"Capture network traffic while checking out and tell me which request failed."*
- *"Turn the flow I just recorded into a deterministic test and run it."*

If anything looks wrong in your local environment, `olef doctor` checks the
setup (`olef doctor --fix` repairs common issues). Run `olef update` to check
for newer versions; the on-device service, runtime agent, and skills follow the
CLI automatically.

## Olef Cloud for Android developers

Local `olef` works offline against your own emulators and USB devices with no
account. When you want cloud build and device infrastructure, **Olef Cloud**
adds optional cloud capabilities for Android work:

- **Build and run Android apps in the cloud:** Offload Gradle builds and Android
  emulators to persistent cloud workspaces with warm caches, so you and your
  agents can build, apply changes, and inspect screens with no Android Studio,
  SDK, or emulator installed locally.
- **Real physical phones and shared device labs:** Lease physical phones on
  demand via Google Cloud's Developer Device Platform, or share your own desk
  phones and TV devices across your team with automatic state reset between
  sessions.
- **Cloud agents and CI workflows:** Run named Claude Code or Codex agents in
  cloud workspaces, keep working with them from any device, run deterministic
  cloud tests, and share private test builds.

Install the companion `ocloud` CLI (`brew install olef-dev/tap/ocloud` or from
[olef-dev/ocloud](https://github.com/olef-dev/ocloud/releases/latest)); the
`olef@olef` plugin for Claude Code and Codex includes the `ocloud` skill that
drives it. Olef Cloud is in invite-only
alpha: sign in at [app.olef.dev](https://app.olef.dev) to join the waitlist or
redeem an invite, or read more at [olef.dev](https://olef.dev). See the
[terms](https://olef.dev/terms) and
[privacy policy](https://olef.dev/privacy#cloud).

## Documentation

- [The agent loop](docs/agent-loop.md): how agents read, act, and verify
- [Apply Changes](docs/apply.md): how `olef app apply` updates running apps in place
- [Debugging](docs/debugging.md): logs, `olef why`, crashes, and JDWP/LLDB
- [Recording tests](docs/recording.md) and [test runs](docs/test-runs.md):
  turn recorded flows into deterministic CI scripts and HTML/JUnit reports
- [Network](docs/network.md): built-in proxy, capture, and fault injection
- [Output contract](docs/output-contract.md): the structured JSON schema
- [Updating](docs/updating.md): `olef update` and versioned components
- [Device state](docs/device-state.md), [sessions](docs/sessions.md),
  [configuration](docs/configuration.md),
  [security and redaction](docs/security-and-redaction.md),
  [verification](docs/verification.md), [evidence](docs/evidence.md)

Browse the full documentation at [olef.dev/docs](https://olef.dev/docs), or run
`olef commands --guide` to print command guides from the CLI.

## Reporting issues

When using Olef through an agent, errors that look like Olef bugs suggest
`olef feedback draft`, and your agent lets you review the report before anything
is sent ([details](docs/feedback.md)).

To report manually, [open an issue](https://github.com/olef-dev/olef/issues/new/choose)
and attach the output of `olef --version` and `olef doctor --json`. Questions
and ideas are welcome in
[Discussions](https://github.com/olef-dev/olef/discussions). Please report
security problems privately; see [SECURITY.md](SECURITY.md).

## License

**Free for everyone.** Olef is free for individuals, teams, and organizations of
any size, for any purpose, including commercial work. No sign-up, no license
key, no per-user fees. The full terms are in the [Olef License](LICENSE.md).

The Claude Code and Codex plugins in this repository are licensed under
Apache-2.0 (see their `LICENSE` files). ShadowDroid 1.3.0 and earlier were
released under Apache-2.0, and their source remains available at the
[`v1.3.0` tag](https://github.com/olef-dev/olef/tree/v1.3.0).

Olef includes open-source components under their own licenses. Their notices
ship as `THIRD-PARTY-NOTICES.txt` in every release archive and on each
[release](https://github.com/olef-dev/olef/releases/latest), and `olef licenses`
prints them.

## Contact

[contact@olef.dev](mailto:contact@olef.dev)
