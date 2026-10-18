# ShadowDroid plugin for Codex

Teaches Codex the `shadowdroid` CLI, so it can run, test and debug your
Android app on emulators and devices: build and apply each edit in place, drive
and wait on the UI by selector, explain crashes from logs and network traffic,
intercept HTTP(S), inject faults and debug without Android Studio.

## Install

The plugin needs the CLI and `adb` on PATH:

```bash
brew install shadowdroid-dev/tap/shadowdroid          # macOS / Linux
scoop install shadowdroid                     # Windows (after adding the shadowdroid bucket)
```

Then add the marketplace and the plugin:

```bash
codex plugin marketplace add shadowdroid-dev/shadowdroid
codex plugin add shadowdroid@shadowdroid
```

Or run `shadowdroid init`: it does both after asking, and after a CLI update
it brings the plugin to the CLI's version.

## What's inside

- **Skills:** `shadowdroid` (the CLI reference, the same skill
  `shadowdroid skill codex --install` writes, generated from the CLI) and
  `android-device` (shows the device live in Codex's in-app browser). Don't
  edit `skills/shadowdroid/SKILL.md` here; change `cli/src/cmd/skill_body.md`
  and run `SHADOWDROID_BLESS=1 cargo test plugins_ship_the_generated_skill`
  in `cli/`.
- **MCP server** (`bin/shadowdroid-mcp`): the device viewer and its tools.
- **Viewer or emulator window:** Codex shows the device in the live viewer.
  To use the emulator's own window instead, run
  `shadowdroid config init --user --show-device window` (back with `viewer`),
  or tell Codex "use the emulator window from now on".
- **SessionStart hook** (`hooks/check-cli`, shared with the Claude plugin):
  tells Codex how to install the CLI or adb when they're missing. Codex asks
  you to trust it once (Settings → Hooks).

With the plugin installed, `shadowdroid init`, `skill --sync` and `connect`
stop installing and refreshing the Codex user skill in
`~/.agents/skills/shadowdroid`, and set an unedited copy aside as
`SKILL.md.retired` so Codex doesn't list the skill twice.

## License

This plugin is licensed under the Apache License, Version 2.0 (see
[LICENSE](LICENSE)). The `shadowdroid` CLI it runs is licensed separately under
the [ShadowDroid License](https://github.com/shadowdroid-dev/shadowdroid/blob/main/LICENSE.md):
free for everyone, including commercial use.
