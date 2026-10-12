# Updating ShadowDroid

[← README](../README.md)

ShadowDroid has one version number. The CLI, the service it installs on each
device, the runtime agent it loads into apps, the agent skills and the Claude
Code and Codex plugins all ship together, from the
[releases](https://github.com/shadowdroid-dev/shadowdroid/releases) of
`shadowdroid-dev/shadowdroid`. You update the CLI; everything else follows it.

## Update the CLI

```bash
shadowdroid update
```

`update` checks the latest release and prints the command that updates your
install. It never runs that command and never changes anything itself, so it
is safe for an agent to call. With `--json` it returns the same as a result
object: `current_version`, `latest_version`, `up_to_date`, `install_method`,
`install_path`, `release_url`, and `update.command` with
`requires_confirmation: true`.

The command depends on how ShadowDroid was installed:

| Installed with | `install_method` | Update command |
| --- | --- | --- |
| Homebrew | `homebrew` | `brew update && brew upgrade shadowdroid` |
| Scoop | `scoop` | `scoop update shadowdroid` |
| The shell or PowerShell installer | `direct_installer` | the installer one-liner again (below) |
| `cargo install` (1.x source builds) | `cargo` | `cargo uninstall shadowdroid`, then the installer |
| Something else | `unknown` | all three options |

The installer one-liners always install the latest release:

```bash
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/shadowdroid-dev/shadowdroid/releases/latest/download/shadowdroid-installer.sh | sh
```

```powershell
powershell -ExecutionPolicy Bypass -c "irm https://github.com/shadowdroid-dev/shadowdroid/releases/latest/download/shadowdroid-installer.ps1 | iex"
```

Pass `--version vX.Y.Z` (shell) or `-Version vX.Y.Z` (PowerShell) to the
installer to install a specific release, and `--uninstall` / `-Uninstall` to
remove it.

`brew upgrade` on its own uses Homebrew's cached formula and can miss a release
published minutes ago; `brew update` first refreshes the tap.

### Building from source is no longer supported

ShadowDroid 2.0 and later are distributed as binaries only. Releases up to
1.3.0 could be built with `cargo install --git`; those versions stay available
at their tags, but newer versions can't be built that way. If you installed
with cargo, `shadowdroid update` tells you to remove that build first, so it
can't shadow the new binary on your PATH.

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
`shadowdroid connect`, a device with a different version gets the matching APK
pair, downloaded once from the CLI's release, checked against the release's
`SHA256SUMS`, and cached under `~/.shadowdroid/apks/<version>/`. `doctor`
reports a version mismatch, and `doctor --fix` repairs it. Nothing on the
device updates on its own between `connect`s.

### The runtime agent

The runtime agent that `runtime`, `layout`, `ui dump --deep` and `app apply`
load into a debuggable app is also version-matched. The first time it's needed
for an ABI, the CLI downloads `shadowdroid-runtime-<abi>.so` from its release,
verifies it against the checksum built into the CLI, and caches it under
`~/.shadowdroid/runtime-agent/<version>/<abi>/`.

`SHADOWDROID_HOME` moves `~/.shadowdroid` and everything in it.

### Agent skills

`shadowdroid init` and `shadowdroid skill <agent> --install` write skill files
stamped with the CLI version. After an update, `connect` and
`shadowdroid skill --sync` refresh every installed skill you haven't edited.
Skills you customized are left alone.

In Claude Code and Codex the ShadowDroid plugin ships the skills and updates
with the plugin. While it's installed, those commands skip that agent's user
skill and set an unedited copy aside as `SKILL.md.retired`, so the agent
doesn't list the skill twice.

### The Claude Code plugin

The plugin starts the `shadowdroid` binary on your PATH and refuses one older
than the version it needs, with an upgrade hint. To pick up a new plugin
version:

```
/plugin marketplace update shadowdroid
```

Then restart Claude Code or start a new session. Update the CLI as well; the
two are released together.

### The Codex plugin

```bash
codex plugin marketplace upgrade shadowdroid
codex plugin add shadowdroid@shadowdroid
```

The first command refreshes the marketplace; the second installs the plugin
version it now lists. The plugin's skill is generated from the CLI of the same
version.

## Pinning and offline use

- **A specific version:** use the installer's `--version`, or your package
  manager's pinning (`brew pin shadowdroid`, `scoop hold shadowdroid`).
- **Offline devices or CI caches:** copy `~/.shadowdroid/apks/<version>/` and
  `~/.shadowdroid/runtime-agent/<version>/` from a machine that has them, or
  point `SHADOWDROID_APK` at a test APK and `SHADOWDROID_RUNTIME_DIR` at a
  directory of per-ABI runtime libraries.
- **A mirror:** `SHADOWDROID_UPDATE_LATEST_URL` changes where `update` looks for
  the latest release (a URL returning GitHub's release JSON).

## Release notes

Every release's notes are in the [changelog](../CHANGELOG.md) and on its
[GitHub release](https://github.com/shadowdroid-dev/shadowdroid/releases).
