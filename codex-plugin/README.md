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

## What's inside

One skill, `skills/shadowdroid/SKILL.md`: the same skill
`shadowdroid skill codex --install` writes, generated from the CLI. Don't edit
it here; change `cli/src/cmd/skill_body.md` and run
`SHADOWDROID_BLESS=1 cargo test codex_plugin_ships_the_generated_skill` in
`cli/`. With the plugin installed, `shadowdroid init` no longer installs the
Codex user skill, so Codex doesn't list two copies.
