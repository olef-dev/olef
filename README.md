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
shadowdroid init             # teach your agent the loop
```

If anything is off, `shadowdroid doctor` diagnoses the setup and
`doctor --fix` repairs it.

## Documentation

- [The agent loop](docs/agent-loop.md): how agents read, act and verify
- [Output contract](docs/output-contract.md): the JSON every command returns
- [Debugging](docs/debugging.md): logs, `why`, crashes and the debugger
- [Network](docs/network.md): the built-in proxy, interception and rules
- [Device state](docs/device-state.md), [sessions](docs/sessions.md),
  [configuration](docs/configuration.md),
  [security and redaction](docs/security-and-redaction.md),
  [verification](docs/verification.md), [evidence](docs/evidence.md)

`shadowdroid commands --guide` lists every command from the CLI itself.

## Reporting issues

[Open an issue](https://github.com/shadowdroid-dev/shadowdroid/issues/new/choose)
and include the output of:

```bash
shadowdroid --version
shadowdroid doctor --json
```

Questions and ideas are welcome in
[Discussions](https://github.com/shadowdroid-dev/shadowdroid/discussions).
Please report security problems privately; see [SECURITY.md](SECURITY.md).

## License

ShadowDroid up to and including v1.3.0 is licensed under Apache-2.0; its source
is available at the [`v1.3.0` tag](https://github.com/shadowdroid-dev/shadowdroid/tree/v1.3.0).
<!-- TODO(license): state the license for releases after v1.3.0 before publishing. -->

## Contact

[contact@shadowdroid.dev](mailto:contact@shadowdroid.dev)
