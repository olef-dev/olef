<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/brand/olef-logo-on-dark.svg">
    <img src="docs/assets/brand/olef-logo-on-light.svg" alt="Olef" width="320">
  </picture>
</p>

# Olef

**Give your coding agent eyes, hands and a debugger for Android.**

Olef is a CLI that lets Claude Code, Codex, Cursor, Gemini and any
shell-capable agent drive, inspect and debug real Android apps, emulators and
devices. Every answer is compact JSON with the next step built in.

**Website:** [olef.dev](https://olef.dev) ·
**Releases:** [latest](https://github.com/olef-dev/olef/releases/latest) ·
**Report a bug:** [new issue](https://github.com/olef-dev/olef/issues/new/choose)

This repository is Olef's public home: releases, documentation, the
changelog, and the issue tracker. Development happens in a private repository.

Free for everyone, including commercial use; see [License](#license).

## Install

Homebrew (macOS, Linux):

```bash
brew install olef-dev/tap/olef
```

Shell installer (macOS, Linux):

```bash
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/olef-dev/olef/releases/latest/download/olef-installer.sh | sh
```

Windows (Scoop, or the PowerShell installer):

```powershell
scoop bucket add olef https://github.com/olef-dev/scoop-bucket
scoop install olef
```

```powershell
powershell -ExecutionPolicy Bypass -c "irm https://github.com/olef-dev/olef/releases/latest/download/olef-installer.ps1 | iex"
```

You also need Android Platform Tools (`adb`) on your PATH. Binaries for every
platform are attached to each [release](https://github.com/olef-dev/olef/releases).

## Quickstart

Start an emulator or plug in a device with USB debugging, then:

```bash
olef devices          # list devices and emulators
olef connect          # install the device service and verify it
olef ui dump          # read the screen as JSON
olef ui tap --text "Sign in" --expect-text "Welcome"
olef why              # when something surprises you
olef init             # add the agent plugins and skills
```

If anything is off, `olef doctor` diagnoses the setup and
`doctor --fix` repairs it.

## Tests from recordings

Record a flow once, in the device viewer or by letting an agent drive the
app, and `olef record save` writes it as a test: a Bash script of one
`olef` command per step, each naming its element and checking its own
result. `olef test run` replays it without AI and writes JUnit and an
HTML report with screenshots. See [recording tests](docs/recording.md) and
[test runs](docs/test-runs.md).

## Olef Cloud (invite-only alpha)

No Android SDK on your machine? Olef Cloud builds your project and runs
it on a cloud emulator; every `olef` command and the device viewer work
the same way:

```bash
olef cloud login      # approve this machine at app.shadowdroid.dev
olef cloud link       # upload this project to your cloud workspace
olef app apply        # build and run it on the cloud emulator
```

The Codex plugin can also use the hosted MCP server at `mcp.shadowdroid.dev`
with no CLI installed. Cloud is an invite-only alpha in one region: sign in
at [app.shadowdroid.dev](https://app.shadowdroid.dev) to join the list, or
enter your invite code there. See the
[terms](https://olef.dev/terms) and
[privacy policy](https://olef.dev/privacy#cloud).

## Real phones from Google Cloud (preview)

Drive real phones from Google Cloud's Developer Device Platform like a USB
device. Sessions are billed to your own Google Cloud project (`ddp.project`
in `.olef/config.json`). Pick one in the device viewer, or let your
agent ask for one there: the first reserve of the day shows its price and asks
you, and your yes covers that day up to $10 (`ddp.budget_usd_per_day` sets your
own limit):

```bash
olef devices catalog --physical --available   # specs like ddp:tokay-36
olef devices reserve ddp:tokay-36             # attached as 127.0.0.1:<port>
olef -d ddp:tokay-36 app apply                # every command works on it
olef devices release ddp:tokay-36             # or it is released when idle
```

`net` capture works through a relay in the Olef server. DDP is a
Google Cloud Preview service; see [configuration](docs/configuration.md).

## Your own device lab (preview)

Lease devices on your own machine (a phone, a Fire TV stick, any adb device)
from anywhere through Olef Cloud, for Cloud accounts with remote
devices enabled:

```bash
olef lab register --name desk --reset lease_only   # this machine becomes a lab
olef lab add 192.168.1.20:5555 --name firetv       # the device asks once to trust the lab's key
olef lab service install                           # keep the lab agent running (prints one sudo command)

# from any machine signed in to the same account:
olef devices reserve lab:desk/firetv               # attached as 127.0.0.1:<port>
olef -d lab:desk/firetv app apply
olef devices view lab:desk/firetv                  # a view.shadowdroid.dev link
olef devices release lab:desk/firetv               # the lab resets the device
```

The lab uses its own adb server and key and offers only the devices you
enrol. After each lease it undoes what the lease did and checks the device;
`--reset lease_only` is for devices you also use yourself.

## Updating

```bash
olef update
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
/plugin marketplace add olef-dev/olef
/plugin install olef@olef
```

The Codex plugin teaches Codex the CLI:

```bash
codex plugin marketplace add olef-dev/olef
codex plugin add olef@olef
```

Or let the CLI do both: `olef init` installs or updates the plugin for
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
- [Updating](docs/updating.md): `olef update` and what follows the CLI
- [Device state](docs/device-state.md), [sessions](docs/sessions.md),
  [configuration](docs/configuration.md),
  [security and redaction](docs/security-and-redaction.md),
  [verification](docs/verification.md), [evidence](docs/evidence.md)

`olef commands --guide` lists every command from the CLI itself.

## Reporting issues

If you use Olef through an agent, let it report for you: errors that are
Olef's fault suggest `olef feedback draft`, and the agent shows
you the report before anything is sent. See [reporting problems](docs/feedback.md).

To report by hand, [open an issue](https://github.com/olef-dev/olef/issues/new/choose)
and include the output of:

```bash
olef --version
olef doctor --json
```

Questions and ideas are welcome in
[Discussions](https://github.com/olef-dev/olef/discussions).
Please report security problems privately; see [SECURITY.md](SECURITY.md).

## License

**Free for everyone.** Olef is free for individuals, teams, and
organizations of any size, for any purpose, including commercial work. No
sign-up, no license key, no per-user fees. The full terms are in the
[Olef License](LICENSE.md).

The Claude Code and Codex plugins in this repository are licensed under
Apache-2.0 (see their `LICENSE` files). ShadowDroid 1.3.0 and earlier were
released under Apache-2.0, and their source remains available at the
[`v1.3.0` tag](https://github.com/olef-dev/olef/tree/v1.3.0).

Olef includes open-source components under their own licenses. Their
notices ship as `THIRD-PARTY-NOTICES.txt` in every release archive and on each
[release](https://github.com/olef-dev/olef/releases/latest), and
`olef licenses` prints them.

## Contact

[contact@olef.dev](mailto:contact@olef.dev)

