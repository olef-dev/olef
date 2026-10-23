<p align="center">
  <img src="docs/assets/shadowdroid-hero.png" alt="A Shadow Droid — a glossy black droid starfighter with a red sensor slash" width="640">
</p>

# ShadowDroid

**Give your coding agent eyes, hands and a debugger for Android.**

ShadowDroid is a CLI that lets Claude Code, Codex, Cursor, Gemini and any
shell-capable agent drive, inspect and debug real Android apps, emulators and
devices. Every answer is compact JSON with the next step built in.

**Website:** [shadowdroid.dev](https://shadowdroid.dev) ·
**Releases:** [latest](https://github.com/shadowdroid-dev/shadowdroid/releases/latest) ·
**Report a bug:** [new issue](https://github.com/shadowdroid-dev/shadowdroid/issues/new/choose)

This repository is ShadowDroid's public home: releases, documentation, the
changelog, and the issue tracker. Development happens in a private repository.

Free for everyone, including commercial use; see [License](#license).

## Install

Homebrew (macOS, Linux):

```bash
brew install shadowdroid-dev/tap/shadowdroid
```

Shell installer (macOS, Linux):

```bash
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/shadowdroid-dev/shadowdroid/releases/latest/download/shadowdroid-installer.sh | sh
```

Windows (Scoop, or the PowerShell installer):

```powershell
scoop bucket add shadowdroid https://github.com/shadowdroid-dev/scoop-bucket
scoop install shadowdroid
```

```powershell
powershell -ExecutionPolicy Bypass -c "irm https://github.com/shadowdroid-dev/shadowdroid/releases/latest/download/shadowdroid-installer.ps1 | iex"
```

You also need Android Platform Tools (`adb`) on your PATH. Binaries for every
platform are attached to each [release](https://github.com/shadowdroid-dev/shadowdroid/releases).

## Quickstart

Start an emulator or plug in a device with USB debugging, then:

```bash
shadowdroid devices          # list devices and emulators
shadowdroid connect          # install the device service and verify it
shadowdroid ui dump          # read the screen as JSON
shadowdroid ui tap --text "Sign in" --expect-text "Welcome"
shadowdroid why              # when something surprises you
shadowdroid init             # add the agent plugins and skills
```

If anything is off, `shadowdroid doctor` diagnoses the setup and
`doctor --fix` repairs it.

## Tests from recordings

Record a flow once, in the device viewer or by letting an agent drive the
app, and `shadowdroid record save` writes it as a test: a Bash script of one
`shadowdroid` command per step, each naming its element and checking its own
result. `shadowdroid test run` replays it without AI and writes JUnit and an
HTML report with screenshots. See [recording tests](docs/recording.md) and
[test runs](docs/test-runs.md).

## ShadowDroid Cloud (invite-only alpha)

No Android SDK on your machine? ShadowDroid Cloud builds your project and runs
it on a cloud emulator; every `shadowdroid` command and the device viewer work
the same way:

```bash
shadowdroid cloud login      # approve this machine at app.shadowdroid.dev
shadowdroid cloud link       # upload this project to your cloud workspace
shadowdroid app apply        # build and run it on the cloud emulator
```

The Codex plugin can also use the hosted MCP server at `mcp.shadowdroid.dev`
with no CLI installed. Cloud is an invite-only alpha in one region: sign in
at [app.shadowdroid.dev](https://app.shadowdroid.dev) to join the list, or
enter your invite code there. See the
[terms](https://shadowdroid.dev/terms) and
[privacy policy](https://shadowdroid.dev/privacy#cloud).

## Real phones from Google Cloud (preview)

Drive real phones from Google Cloud's Developer Device Platform like a USB
device. Sessions are billed to your own Google Cloud project (`ddp.project`
in `.shadowdroid/config.json`). Pick one in the device viewer, or let your
agent ask for one there: the first reserve of the day shows its price and asks
you, and your yes covers that day up to $10 (`ddp.budget_usd_per_day` sets your
own limit):

```bash
shadowdroid devices catalog --physical --available   # specs like ddp:tokay-36
shadowdroid devices reserve ddp:tokay-36             # attached as 127.0.0.1:<port>
shadowdroid -d ddp:tokay-36 app apply                # every command works on it
shadowdroid devices release ddp:tokay-36             # or it is released when idle
```

`net` capture works through a relay in the ShadowDroid server. DDP is a
Google Cloud Preview service; see [configuration](docs/configuration.md).

## Updating

```bash
shadowdroid update
```

prints the command that updates your install and changes nothing itself. The
device service, runtime agent and agent skills follow the CLI's version. See
[updating](docs/updating.md).

## Claude Code and Codex

The Claude Code plugin adds a live device viewer next to the conversation,
with annotations and tap-to-test recording, plus Apply Changes builds. If the
CLI isn't installed yet, the plugin notices when a session starts and Claude
offers the install command for your OS:

```
/plugin marketplace add shadowdroid-dev/shadowdroid
/plugin install shadowdroid@shadowdroid
```

The Codex plugin teaches Codex the CLI:

```bash
codex plugin marketplace add shadowdroid-dev/shadowdroid
codex plugin add shadowdroid@shadowdroid
```

Or let the CLI do both: `shadowdroid init` installs or updates the plugin for
each of the two agents it finds (it asks first; `--plugins` skips the
question) and the skill for Cursor, Gemini and Antigravity.

Details: [Claude Code plugin](claude-plugin/README.md),
[Codex plugin](codex-plugin/README.md).

## Documentation

- [The agent loop](docs/agent-loop.md): how agents read, act and verify
- [Output contract](docs/output-contract.md): the JSON every command returns
- [Debugging](docs/debugging.md): logs, `why`, crashes and the debugger
- [Recording tests](docs/recording.md) and [test runs](docs/test-runs.md):
  record a flow, replay it as a Bash test, read the report
- [Network](docs/network.md): the built-in proxy, interception and rules
- [Updating](docs/updating.md): `shadowdroid update` and what follows the CLI
- [Device state](docs/device-state.md), [sessions](docs/sessions.md),
  [configuration](docs/configuration.md),
  [security and redaction](docs/security-and-redaction.md),
  [verification](docs/verification.md), [evidence](docs/evidence.md)

`shadowdroid commands --guide` lists every command from the CLI itself.

## Reporting issues

If you use ShadowDroid through an agent, let it report for you: errors that are
ShadowDroid's fault suggest `shadowdroid feedback draft`, and the agent shows
you the report before anything is sent. See [reporting problems](docs/feedback.md).

To report by hand, [open an issue](https://github.com/shadowdroid-dev/shadowdroid/issues/new/choose)
and include the output of:

```bash
shadowdroid --version
shadowdroid doctor --json
```

Questions and ideas are welcome in
[Discussions](https://github.com/shadowdroid-dev/shadowdroid/discussions).
Please report security problems privately; see [SECURITY.md](SECURITY.md).

## License

**Free for everyone.** ShadowDroid is free for individuals, teams, and
organizations of any size, for any purpose, including commercial work. No
sign-up, no license key, no per-user fees. The full terms are in the
[ShadowDroid License](LICENSE.md).

The Claude Code and Codex plugins in this repository are licensed under
Apache-2.0 (see their `LICENSE` files). ShadowDroid 1.3.0 and earlier were
released under Apache-2.0, and their source remains available at the
[`v1.3.0` tag](https://github.com/shadowdroid-dev/shadowdroid/tree/v1.3.0).

ShadowDroid includes open-source components under their own licenses. Their
notices ship as `THIRD-PARTY-NOTICES.txt` in every release archive and on each
[release](https://github.com/shadowdroid-dev/shadowdroid/releases/latest), and
`shadowdroid licenses` prints them.

## Contact

[contact@shadowdroid.dev](mailto:contact@shadowdroid.dev)

