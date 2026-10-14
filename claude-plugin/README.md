# ShadowDroid plugin for Claude Code

Run, test and debug Android apps from Claude Code. Claude works through the
`shadowdroid` CLI: it builds and applies each change, drives the UI by
selectors and reads logs and network traffic. When you want to see or use the
app yourself, it opens a live, interactive device viewer next to the
conversation, the way Claude Code Desktop does it for the iOS Simulator.

## When the viewer opens

By default, only when you want it: ask Claude to show you the device ("show
me", "let me try it"), or run `/device show`. It also opens it to take your
annotations, record your steps for a test, or when only your eyes can judge
something. Until then nothing pops up, and the regular emulator window works
as always.

To have the viewer open whenever Claude runs your app, set the plugin's
**Device viewer** option to `always`. Claude Code asks for it when you install
the plugin; later, change it in the config menu or under `pluginConfigs` in
settings, then start a new session. (With `show_device` set to `window`,
below, `always` is ignored.)

To use the emulator's own window instead of the viewer, run
`shadowdroid config init --user --show-device window` (back with `viewer`),
or just tell Claude "use the emulator window from now on". Claude then boots
emulators with their window and opens the viewer only when you ask. This
setting is ShadowDroid's own, so it applies in Claude Code and Codex alike.

## What you get

- **Live device viewer.** H.264 video in the Claude Desktop browser pane (or any
  Chrome tab). Tap, drag, type, and use Back/Home/Recents.
  - **Portrait / Landscape** toggle. An app that fixes its orientation says
    so, and your rotation settings are restored when Claude detaches.
  - **Zoom** with −, Fit and + (⌘=, ⌘−, ⌘0). The stream's resolution follows
    the size on screen; the gear menu picks Auto, Sharp or Smooth.
  - **Gear menu:** screenshots (⌘S) and recordings (⌘R) to your Desktop, the
    emulator's sound, device info, keyboard shortcuts, revoking Claude's
    access, and shutting the emulator down.
  - **Gestures:** on emulators, touch is real-time through the emulator
    console. Option-drag pinches or rotates, and Option+Shift-drag pans with
    two fingers.
- **Activity panel** (Cmd+J). The foreground app's warnings and errors, and
  its network requests when `shadowdroid net start` is capturing. "Problems
  only" filters to errors and failed requests.
- **Annotate** (Cmd+E). Click an element or drag around an area on the
  device and write what should change; numbered markers stay on screen.
  Claude reads them with the `annotations` tool. Each note comes with the
  element, a selector, a crop, and, in debuggable Compose apps, the
  composable and source line that drew it. "Send to Claude" submits them,
  and pending notes also ride along with your next message.
- **Record steps** (Cmd+T). Records your taps, swipes, typing and keys. Each
  tap is resolved to the element it hit, so Claude can turn the steps into a
  UI test (the `recording` tool).
- **`control` tool**, with the same actions as the iOS Simulator tool:
  `attach`, `launch`, `screenshot` (an image whose pixels are dp), `tap`,
  `swipe`, `touch_path`, `touch2_path` (two fingers, emulators), `text`,
  `button`, `open_url` and `detach`.
- **`build`** (or `shadowdroid app apply` through Bash). Applies code changes
  the cheapest correct way: in place
  (redefine + recompose, keeping app state), by restarting the activity, or
  by reinstalling. On API 30+, new methods and classes apply in place too.
  The result says:
  - what it did and why, and when the change takes effect;
  - whether the app crashed or a composable threw;
  - errors the app logged, and requests that failed;
  - what changed on screen, with `screenshot: true`: the image comes back
    with the changed areas outlined.

  If the desktop app didn't pass along `ANDROID_HOME`/`JAVA_HOME`, it fills
  them in.
- **`boot`.** Lists and boots AVDs without a window, since the viewer replaces
  it. Emulators Claude boots this way shut down when the session ends, or 10
  minutes after `detach`. (`shadowdroid emulator boot` boots one with its
  own window that stays up.)
- **`shadowdroid` tool.** Runs any ShadowDroid CLI command on the attached
  device: selector-based UI, logs, crashes, network capture, debugger.
- **Consent.** Claude can't control a device until you click **Let Claude use
  it** in the viewer. Consent is kept per device for 12 hours in
  `~/.shadowdroid/pane-consent.json` (owner-only); after that the viewer asks
  again.
- **No prompt per tap.** After you allow a device, the plugin's `PreToolUse`
  hook (`hooks/allow-device-actions`) pre-approves `control`, `boot` and the
  read-only `recording` and `annotations` calls,
  as Claude Desktop does for the iOS Simulator. The MCP server still refuses
  every device action until you've allowed that device. `build`, `open_url`,
  `launch` with an `app_path` (it installs an APK) and the `shadowdroid` CLI
  tool keep following your permission mode, and so does everything in plan
  mode. Set `SHADOWDROID_PLUGIN_ASK_EVERY_ACTION=1` to
  get a prompt for every call.
- **Ownership.** Each Claude session reserves the devices it attaches, so
  parallel sessions never share one. An idle session releases its reservation
  after 3 minutes and takes it back on its next action. A reservation left
  behind by a crashed server, or by one whose device was offline when it
  exited, is closed by the next server that attaches.
- **Ordered actions.** Calls Claude makes in parallel run in the order it sent
  them, and `screenshot: true` on an input action returns the screen right
  after it.

## Install

1. Install the `shadowdroid` CLI, version 2.0.4 or newer. You can also skip
   this step: when a session starts without it (or with an older one), the
   plugin tells Claude, which offers the right install command for your OS and
   runs it once you approve. After that, run `/mcp` and reconnect `shadowdroid`
   (or start a new session) to enable the plugin's tools.

   ```bash
   brew install shadowdroid-dev/tap/shadowdroid
   ```

   On Windows, `scoop bucket add shadowdroid https://github.com/shadowdroid-dev/scoop-bucket`
   and `scoop install shadowdroid`, or use the installer from the
   [latest release](https://github.com/shadowdroid-dev/shadowdroid/releases/latest).
   You also need Android platform-tools (`adb`).

2. In Claude Code, add the marketplace and install the plugin:

   ```
   /plugin marketplace add shadowdroid-dev/shadowdroid
   /plugin install shadowdroid@shadowdroid
   ```

3. Ask Claude something like "build the app and run it on the Pixel 9
   emulator, then check the login screen". To watch, ask it to show you the
   device (or run `/device show`), then click **Let Claude use it** in the
   viewer.

## Updating

The plugin and the CLI are released together. Update the CLI with the command
`shadowdroid update` prints, then refresh the plugin:

```
/plugin marketplace update shadowdroid
```

and start a new session. The device service and runtime agent follow the CLI
on their own. See [updating](../docs/updating.md).

## Using a development build

`SHADOWDROID_BIN` points the plugin at a specific binary. A binary inside a
ShadowDroid development checkout (`cli/target/{release,debug}/shadowdroid`)
uses that checkout's server APK and runtime agent; elsewhere, set
`SHADOWDROID_SERVER_APK` (`SHADOWDROID_APK` before 2.0.6) and
`SHADOWDROID_RUNTIME_DIR` in Claude Code's `env`
settings. To load the plugin from a folder without installing it, use
`claude --plugin-dir /path/to/claude-plugin`.

## Status line and toasts

The plugin's hooks module (`hooks/register.ts`) adds:
- **Status line:** the device and what the last build did
  (`📱 Pixel_9 · applied in place 1.4 s`), whether Claude used the `build`
  tool or `shadowdroid app apply`.
- **Toasts:** a crash, a composition error or a failed request after a build,
  a device another session is using, and when Claude is waiting for you to
  click **Let Claude use it**.
- **`/device`:** shows the device and its viewer link; `/device show` asks
  Claude to open the viewer.
- **Annotations:** pending notes from the viewer go with your next message,
  and the viewer's "Send to Claude" button submits them.

These need a Claude Code build with plugin function hooks (Claude Desktop
2.1.29x or newer). An older build ignores the module and keeps everything
else: the tools, the viewer and the skill.

## Skills

The plugin ships two skills:

- **`shadowdroid`** (`shadowdroid:shadowdroid`): the CLI reference, the same
  skill `shadowdroid skill claude-code` writes, generated from the CLI.
- **`android-device`** (`shadowdroid:android-device`): the device, the viewer,
  build and screenshots.

With the plugin installed for your user, `shadowdroid init`, `skill --sync`
and `connect` stop installing and refreshing the personal skill in
`~/.claude/skills/shadowdroid`, and set an unedited copy aside as
`SKILL.md.retired` so Claude doesn't list the skill twice. A copy you edited is
left for you to review.

After `attach`, the Bash `shadowdroid` commands of that same Claude session use
the session's device reservation automatically, so the skill's recipes work
unchanged. Other sessions and tools still get `device_reserved`. Set
`SHADOWDROID_NO_INHERIT_SESSION=1` to turn this off.

## The CLI does it too

Everything the tools do has a CLI command, so Claude (or you, or CI) can work
without the MCP server:

| MCP | CLI |
|---|---|
| `build` | `shadowdroid app apply` (same result, including `screen`, `logged_errors`, `failed_requests`) |
| `boot` | `shadowdroid emulator list` / `emulator boot <avd>` / `emulator kill <avd>` |
| `control` `touch_path` / `touch2_path` | `shadowdroid ui path x,y … [--fingers 2]` (pixels) |
| `annotations` | `shadowdroid pane annotations` (crops saved as PNG files) |
| `recording` | `shadowdroid pane steps` |
| the viewer | `shadowdroid pane` |

The `pane` commands read a viewer that's running, whether the plugin's MCP
server or `shadowdroid pane` serves it. Only the MCP tools need your consent
in the viewer; Bash commands follow your permission mode.

## Requirements and limits

- Android SDK platform-tools (adb). The Android Emulator is needed for `boot`.
- Video uses Android `screenrecord` (Android 10+), decoded with WebCodecs.
  Secure windows (`FLAG_SECURE`, DRM video) show as black. Sound in the
  viewer comes from the emulator's gRPC endpoint, so it's emulator-only;
  emulators also play sound through your Mac as usual.
- Physical devices work over ADB. Touch from the viewer is sent per gesture
  rather than in real time, two-finger gestures need an emulator, and you
  should avoid signing in to real accounts, because screenshots are sent to
  Anthropic.
- Local sessions only. Cloud and SSH sessions can't reach your devices.
- Set `SHADOWDROID_DISABLE_AGENT_CONTROL=1` to turn off Claude's device tools.
  The viewer stays usable for you.

Report problems at
[shadowdroid-dev/shadowdroid issues](https://github.com/shadowdroid-dev/shadowdroid/issues/new/choose).

## License

This plugin is licensed under the Apache License, Version 2.0 (see
[LICENSE](LICENSE)). The `shadowdroid` CLI it runs is licensed separately under
the [ShadowDroid License](https://github.com/shadowdroid-dev/shadowdroid/blob/main/LICENSE.md):
free for individuals and teams up to 10 users.
