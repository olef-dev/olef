---
name: android-device
description: Run, test, debug and visually verify the user's Android app on an emulator or device with ShadowDroid, through the `shadowdroid` CLI, and with a live device viewer in Claude Desktop when the user wants to see or use the device themselves. Use whenever the user wants to run, try, test, or see their Android app ("run the app", "does this screen look right?", "tap through onboarding", "show me", "test on Pixel 9"), boot an emulator, or check a change on a device, including on a machine with no Android SDK (ShadowDroid Cloud).
---

# Android device

Work through the `shadowdroid` CLI (Bash). Open the device viewer only
when the user wants to see or use the device.

## No Android SDK here: local or ShadowDroid Cloud

When `shadowdroid doctor --json` (or the session's ShadowDroid note) finds no
Android SDK, adb or device and the project isn't linked to ShadowDroid Cloud,
ask the user which they want before installing anything:

- **Set up Android locally:** Android Studio, or the SDK and platform-tools.
- **ShadowDroid Cloud:** nothing else to install. The project is uploaded to
  their cloud workspace and builds and runs on a cloud emulator (an
  invite-only alpha).

For Cloud, with the user's yes for each step:

1. `shadowdroid cloud login --no-wait --json` returns a code and a page on
   app.shadowdroid.dev: give both to the user to sign in and approve (the
   status line shows the code too), then run `shadowdroid cloud login`, which
   returns once they have.
2. `shadowdroid cloud link` in the project's root (or an empty folder made for
   a new project), never any other folder. The user approves the upload in
   the terminal or on the page it links.
3. Everything below then works unchanged against the cloud emulator: `app
   apply`, `ui …`, screenshots, the viewer. Don't boot an emulator. The first
   command starts the session (up to about 2 minutes; on
   `cloud_session_starting`, wait and run it again), and after 15 idle minutes
   it stops until the next command.
4. `shadowdroid cloud usage` shows hours and limits, and `shadowdroid cloud
   stop` ends the session when the user is done. On `cloud_quota_exceeded`,
   tell the user which limit and when it resets, and don't retry.
   `shadowdroid commands --guide cloud` has every `cloud_*` error and Gradle
   tasks without a local JDK (`cloud run`).

With no `shadowdroid` CLI but the ShadowDroid Cloud MCP tools
(`create_workspace`, `write_files`, `build_and_run`, `screenshot`,
`open_viewer`), work through those instead: the project then lives in a
hosted cloud workspace, and `export_project` returns it as a zip.

## Working through the CLI (the default)

1. **Find a device.** `shadowdroid devices` lists running ones. With none,
   `shadowdroid emulator list` lists the AVDs and `shadowdroid emulator boot
   <avd>` boots one with its own window (`--no-window` runs it headless) and
   waits until Android has started.
2. **Build and apply after every edit.** Run `shadowdroid app apply` from the
   Gradle root, adding `--module` and `--variant` if they aren't `app` and
   `debug`. It puts the current source on the device the cheapest correct way
   and says what it did:
   - `action: "hot"`: code was swapped into the running app and the changed
     composables recomposed, with app state kept (about 1–2 s). If
     `on_screen` is false, navigate to the changed screen. `state_reset`
     names composables whose own remembered state was reset.
   - `action: "restart_activity"`: code that already ran (`onCreate`,
     ViewModel setup, a started flow) changed, so the activity was
     recreated. Saved state is kept.
   - `action: "reinstall"`: the change can't be applied in place (new
     lambdas, removed methods, resources, manifest; on API 30+ new classes
     and methods do apply in place). `reasons` says why.
   - `takes_effect: ["next_call"]`: the new code runs the next time it's
     called, so re-trigger it (tap the button again) before judging.
   - Read `app_alive`, `crash` and `compose_error` first: a crash or a
     composition error means the change broke the app (the note names the
     root cause). Fix it and apply again rather than looking at the screen.
   - `logged_errors` lists errors the app logged while the change was
     applied, and `failed_requests` lists requests that failed (when `net
     start` is capturing). They often explain a screen that looks wrong.
   - `screen` says what changed in the UI: the app, and the texts that
     `appeared` or are `gone`. An edit that should be visible but changed
     nothing didn't reach the screen: check `takes_effect` and `on_screen`.
   If the result looks stale because a value is cached, run it with
   `--at-least restart-activity`, also without new edits; add
   `--fresh-viewmodels` when a ViewModel computed the value (a plain restart
   keeps ViewModels). It returns once the app has drawn its first frame
   after a reinstall or restart.
3. **Check with the UI structure first; look at pixels when it matters.**
   `shadowdroid ui wait --text Welcome`, `ui find --text "Sign in"`, `ui tap
   --text "Sign in"` and `ui dump` (every element, with tap points) cost a
   few dozen tokens each. `ui wait --stable` waits out animations and
   loading; `ui audit --a11y` checks labels, touch targets and contrast. Take a screenshot (`shadowdroid ui screenshot
   /tmp/screen.png`, then read the file) when:
   - the question is how it looks: layout, spacing, colors, images,
     clipping, a visual regression;
   - `ui dump` has no texts or says the tree may be incomplete: custom-drawn
     content, maps, games, images without descriptions;
   - you need a toast: it's a system window, not in the UI structure. Dialogs,
     snackbars, tooltips and dropdown menus are in the structure.

   CLI coordinates are pixels, as `ui dump` reports them. `ui swipe` and `ui
   drag` move one finger in a line; `ui path` follows timed points (curves,
   long-press-then-drag) and, with `--fingers 2`, pinches, rotates or pans
   with two fingers on emulators. To check a layout in landscape, run
   `shadowdroid device orientation left` (`natural` is portrait); if its
   `effective` value differs from what you asked for, the app fixes its
   orientation.
4. **Explain failures** with `shadowdroid log crashes`, `shadowdroid why` and
   `shadowdroid net start` / `net log`. `shadowdroid commands --guide` lists the
   rest (debugger, faults, app state).

## Showing the device to the user

Open the viewer when the user asks to see, watch or try the device ("show
me", "let me try it", or `/device show`), wants to annotate the screen or
record steps for a test, or when only their eyes can judge something. Not for
your own checks: the CLI is cheaper.

1. Call the `control` tool with `action: "attach"` (or `boot` an AVD first
   when nothing runs). It returns a `viewer_url`. In Claude Desktop, open it
   in the browser pane with `preview_start` and `url` set to that value; in a
   terminal session, give the user the URL to open in Chrome. The viewer
   streams the screen live, and the user can tap, type, rotate, take
   screenshots and record there.
2. Keep working as before. Bash `shadowdroid` commands now share the
   attached device's reservation. While the viewer is open, prefer the `build`
   tool to `app apply`: it is the same apply and also lists the build in the
   viewer's Builds tab. `control` `screenshot` returns the screen as an
   image whose pixels are dp, and `tap`, `swipe`, `touch_path` and
   `touch2_path` take dp, so you can act on what you see.
3. **Act on the user's annotations.** In the viewer's Annotate mode (Cmd+E)
   the user clicks an element or drags around an area and writes what should
   change; "Send to Claude" submits them. When they say they've annotated
   something, or a prompt's context lists pending annotations, call the
   `annotations` tool (or run `shadowdroid pane annotations`, which saves the
   images as PNG files). Each has the user's comment, the element and its
   selector, and `source`; an image of each screen shows every note outlined
   in red with its number. `source` lists the
   composables that drew it, innermost first, each with the file and line
   where it's called (`Button` at `MainScreen.kt:57`). Address each by its
   number `n`, apply the change, then check the result.
4. **Turn what the user did into a test.** The viewer's Record steps button
   (Cmd+T) records the user's own taps, swipes, typing and keys. When they
   ask for a test from it, call `recording` (or run `shadowdroid pane
   steps`). Each tap carries a selector (`text`, `desc`, `rid`, or
   `text_inside` for a container) and the dp point. Write the test in the
   project's style (Compose `onNodeWithText(…).performClick()`, Espresso, or
   `shadowdroid ui` commands), prefer selectors over coordinates, and run it.
5. When the user is done looking, call `control` `detach`. Emulators the
   `boot` tool started shut down 10 minutes after detach, or when the session
   ends.

If the MCP server's instructions say to open the viewer before building, the
user set the plugin's `viewer` option to `always`: attach and open the viewer
whenever you run the app.

## Viewer or emulator window

The user picks how they see the device; it's ShadowDroid's `show_device`
setting:

- `viewer` (the default): the live viewer in the Claude Desktop browser pane.
- `window`: the emulator's own window. The MCP server's instructions then
  say so, and the `boot` tool opens the window by default. Open the viewer
  only if they ask for it.

When they ask to change it for good ("use the emulator window from now on",
"show me the viewer by default"), run
`shadowdroid config init --user --show-device window` (or `viewer`) and tell
them it fully applies in a new session. For a one-off ("open the emulator
window this time"), just do it: `boot` with `window: true`, or
`shadowdroid emulator boot <avd>`. An emulator already running without a
window can't show one; offer to restart it (`shadowdroid emulator kill`,
then boot), and say the app's in-memory state is lost.

## With the `shadowdroid` skill

This plugin's `shadowdroid` skill is the full CLI reference; this skill adds
the device viewer. Use that skill's recipes through Bash as written; after
`attach` they target the attached device under this session's reservation.
You don't need to run `shadowdroid connect` yourself.

## Rules

- **Consent.** The MCP tools that act on the device (`control`, `build`,
  `open_url` and the `shadowdroid` tool) return `consent_required` until the
  user clicks **Let Claude use it** in the viewer. Tell them that, with the
  viewer link, and wait. Never try to grant it yourself or work around it.
  After that, `control` and `boot` run without a permission prompt per
  action, as with the iOS Simulator; Bash commands, `build` and `open_url`
  follow the permission mode.
- **Shared device.** The user can drive the same device. When a result has
  `user_input_since_last_action: true`, re-read the screen before acting on
  what you saw earlier. While you act, the viewer shows "Claude is using this
  device".
- **Reservation.** `attach` reserves the device for this Claude session, so
  other sessions can't drive it. Your own Bash `shadowdroid` commands share
  it automatically; don't add `--session`. After a few idle minutes the
  reservation is released and quietly taken back on your next action. If that
  fails with `device_reserved`, another session or tool is driving the
  device; tell the user rather than retrying.
- **Privacy.** Screenshots are sent to Anthropic, so don't sign in to real
  accounts on a device you use. Treat physical phones with extra care. Ask
  before opening URLs that carry user data. In a project linked to
  ShadowDroid Cloud, its files, builds and screen also go to ShadowDroid
  Cloud.
