# Updating Olef

[← README](../README.md)

Olef has one version number. The CLI, the service it installs on each
device, the runtime agent it loads into apps, the agent skills and the Claude
Code and Codex plugins all ship together, from the
[releases](https://github.com/olef-dev/olef/releases) of
`olef-dev/olef`. You update the CLI; everything else follows it.

## Update the CLI

```bash
olef update
```

`update` checks the latest release and prints the command that updates your
install. It never runs that command and never changes anything itself, so it
is safe for an agent to call. With `--json` it returns the same as a result
object: `current_version`, `latest_version`, `up_to_date`, `install_method`,
`install_path`, `release_url`, and `update.command` with
`requires_confirmation: true`.

The command depends on how Olef was installed:

| Installed with | `install_method` | Update command |
| --- | --- | --- |
| Homebrew | `homebrew` | `brew update && brew upgrade olef` |
| Scoop | `scoop` | `scoop update olef` |
| The shell or PowerShell installer | `direct_installer` | the installer one-liner again (below) |
| `cargo install` (1.x source builds) | `cargo` | `cargo uninstall olef`, then the installer |
| Something else | `unknown` | all three options |

The installer one-liners always install the latest release:

```bash
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/olef-dev/olef/releases/latest/download/olef-installer.sh | sh
```

```powershell
powershell -ExecutionPolicy Bypass -c "irm https://github.com/olef-dev/olef/releases/latest/download/olef-installer.ps1 | iex"
```

Pass `--version vX.Y.Z` (shell) or `-Version vX.Y.Z` (PowerShell) to the
installer to install a specific release, and `--uninstall` / `-Uninstall` to
remove it.

`brew upgrade` on its own uses Homebrew's cached formula and can miss a release
published minutes ago; `brew update` first refreshes the tap.

**Coming from ShadowDroid (v2) with Homebrew:** run
`brew update && brew upgrade olef-dev/tap/olef` once. Homebrew 7 loads
formulae only from taps you trust, and naming the formula in full trusts it;
a bare `brew upgrade` stops with "Refusing to load formula … from untrusted
tap". After that, `brew upgrade olef` works as above.

### The update notice

You don't have to remember to check. Once a day, after an ordinary command,
the CLI starts a detached check of the latest release (the same request as
`olef update`) and saves the answer in `~/.olef/update-check.json`.
The command you ran never waits for it. Everything below reads only that file:

- **In a terminal**, when a newer release is known, the next command ends with
  a short notice on stderr: the new version, the update command for your
  install and the release notes link. It's shown at most once a day, never with
  `--quiet`, and never when stderr isn't a terminal, so scripts and agents that
  parse the output don't see it.
- **In JSON**, `doctor` and `connect` results carry `update_available` with
  `current_version`, `latest_version`, `release_url`, `command` (the update
  command), `then` (`olef init`) and `hint`. It never changes
  `healthy`, and it's absent when you're up to date or nothing is cached yet.
- **In Claude Code and Codex**, the plugin's SessionStart hook reads the same
  file and shows a one-line note when a newer release is known, so the agent
  can offer the update. The hook makes no network request itself.

The same daily check also fetches the release's list of known issues, which
lets agents tell a problem that is already fixed from a new one (see
[Reporting problems](feedback.md)). When a newer release fixes an issue you
reported, the notice and `update_available.fixes_your_reports` say so.

`OLEF_NO_UPDATE_CHECK=1` turns off the check, the notice, the
`update_available` field and the plugin note. The daily check is also skipped
when `CI` is set. `olef update` still works either way.

### Building from source is no longer supported

ShadowDroid 2.0 and later are distributed as binaries only. Releases up to
1.3.0 could be built with `cargo install --git`; those versions stay available
at their tags, but newer versions can't be built that way. If you installed
with cargo, `olef update` tells you to remove that build first, so it
can't shadow the new binary on your PATH.

### ShadowDroid is now Olef (3.0)

ShadowDroid was renamed to Olef in 3.0. Updating with the command your install
already uses moves you across: Homebrew follows the rename to the `olef`
formula, and the install scripts install `olef`.

- **The command is `olef`.** Every install also puts a `shadowdroid` command
  next to it that runs `olef`, so scripts and CI keep working.
- **Your settings move once.** The first `olef` run moves `~/.shadowdroid` to
  `~/.olef` (leaving a `~/.shadowdroid` link on macOS and Linux) and a
  project's `.shadowdroid/` folder to `.olef/`. The proxy CA moves as it is,
  so devices that trust it keep trusting it. A `~/.olef` that already exists is
  kept as `~/.olef.before-move-<time>`.
- **Environment variables are `OLEF_*`.** `SHADOWDROID_*` names aren't read any
  more; `olef doctor` lists any still set, with their new names.
- **The device service is `dev.olef.server`.** The first `connect` removes the
  old `io.github.andriyo.shadowdroid` service from each device and installs
  the new one.
- **Reinstall the agent plugins.** They are now `olef`; run `olef init`, then
  remove the old `shadowdroid` plugin from Claude Code or Codex.
- **Kept:** recorded tests in `tests/shadowdroid/` and steps that start with
  `shadowdroid`, a `.shadowdroidignore` file, and `--billing shadowdroid`
  still work.

### Moving from `andriyo/ShadowDroid`

ShadowDroid moved to the `shadowdroid-dev` organization in 2.0. The old
repository URLs redirect, so existing installs keep updating with the commands
above. To switch to the new names (optional), reinstall from them:

```bash
brew uninstall shadowdroid && brew untap andriyo/tap
brew install shadowdroid-dev/tap/shadowdroid
```

```powershell
scoop uninstall shadowdroid; scoop bucket rm andriyo
scoop bucket add shadowdroid https://github.com/shadowdroid-dev/scoop-bucket
scoop install shadowdroid
```

## What follows the CLI

### The device service

Each CLI version expects the device service of the same version. On
`olef connect`, a device with a different version gets the matching APK
pair, downloaded once from the CLI's release, checked against the release's
`SHA256SUMS`, and cached under `~/.olef/apks/<version>/`. `doctor`
reports a version mismatch, and `doctor --fix` repairs it. Nothing on the
device updates on its own between `connect`s.

### The runtime agent

The runtime agent that `runtime`, `layout`, `ui dump --deep` and `app apply`
load into a debuggable app is also version-matched. The first time it's needed
for an ABI, the CLI downloads `olef-runtime-<abi>.so` from its release,
verifies it against the checksum built into the CLI, and caches it under
`~/.olef/runtime-agent/<version>/<abi>/`.

`OLEF_HOME` moves `~/.olef` and everything in it.

### Agent skills

`olef init` and `olef skill <agent> --install` write skill files
stamped with the CLI version. After an update, `connect` and
`olef skill --sync` refresh every installed skill you haven't edited.
Skills you customized are left alone.

In Claude Code and Codex the Olef plugin ships the skills and updates
with the plugin. While it's installed, those commands skip that agent's user
skill and set an unedited copy aside as `SKILL.md.retired`, so the agent
doesn't list the skill twice.

### The agent plugins

After updating the CLI, run `olef init`. It updates the Claude Code and
Codex plugins to the CLI's version, asking first (`--plugins` doesn't ask),
and refreshes the skills. A plugin installed some other way, such as from
Anthropic's plugin directory, is left to that source. Then start a new
session. Or update each plugin yourself, as below.

### The Claude Code plugin

The plugin starts the `olef` binary on your PATH and refuses one older
than the version it needs, with an upgrade hint. To pick up a new plugin
version:

```
/plugin marketplace update olef
```

Then restart Claude Code or start a new session. Update the CLI as well; the
two are released together.

### The Codex plugin

```bash
codex plugin marketplace upgrade olef
codex plugin add olef@olef
```

The first command refreshes the marketplace; the second installs the plugin
version it now lists. The plugin's skill is generated from the CLI of the same
version.

## Pinning and offline use

- **A specific version:** use the installer's `--version`, or your package
  manager's pinning (`brew pin olef`, `scoop hold olef`).
- **Offline devices or CI caches:** copy `~/.olef/apks/<version>/` and
  `~/.olef/runtime-agent/<version>/` from a machine that has them, or
  point `OLEF_SERVER_APK` (`OLEF_APK` before 2.0.6) at the
  server's test APK and `OLEF_RUNTIME_DIR` at a directory of per-ABI
  runtime libraries.
- **A mirror:** `OLEF_UPDATE_LATEST_URL` changes where `update` and the
  daily check look for the latest release (a URL returning GitHub's release
  JSON).
- **No update checks:** `OLEF_NO_UPDATE_CHECK=1` (see
  [The update notice](#the-update-notice)).

## Release notes

Every release's notes are in the [changelog](../CHANGELOG.md) and on its
[GitHub release](https://github.com/olef-dev/olef/releases).
