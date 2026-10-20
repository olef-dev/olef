---
name: android-device
description: Show the user's Android emulator or device live in Codex, so they can watch, tap, annotate the screen or record steps for a test, through this plugin's ShadowDroid tools. Use whenever the user wants to see or try their Android app themselves ("show me", "let me try it", "open the emulator", "I want to tap around"), to annotate the screen, or to turn what they did on the device into a test.
---

# Android device viewer

The `shadowdroid` skill covers running, testing and debugging through the
CLI; use it for your own checks. This skill is for putting the device in
front of the user. Use this plugin's MCP tools for that, not `shadowdroid
pane` in a terminal: the tools share one viewer with the device's consent,
reservation, annotations and recorded steps.

## Showing the device

1. Call `control` with `action: "attach"` (with `device` when more than one
   is running; `boot` an AVD first when none is). Open the returned
   `viewer_url` in the in-app browser and make it visible, beside the chat.
   The viewer streams the screen live; the user can tap, type, rotate, take
   screenshots and record there.
2. Keep working as before. `shadowdroid` commands you run in the shell now
   share the attached device's reservation. While the viewer is open,
   prefer the `build` tool (with `project_dir` set to the app's Gradle root)
   to `app apply`: it is the same apply and also lists the build in the
   viewer's Builds tab. `control` `screenshot` returns the screen as an image
   whose pixels are dp, and `tap`, `swipe`, `touch_path` and `touch2_path`
   take dp.
3. **Act on the user's annotations.** In Annotate mode (the pen, or ⌥E) the
   user clicks an element or drags around an area and writes what should
   change; "Send to Codex" opens this thread with an "Address my device
   annotations" prompt in the composer, and they press Enter. Then call
   `annotations`: each note has the comment, the element and its selector,
   `source` (the composables that drew it, innermost first, with file and
   line) and a crop of the screen. Address each by its number `n`, apply the
   change, and check the result.
4. **Turn what the user did into a test.** Record steps (the list button, or
   ⌥T) records the user's taps, swipes, typing and keys; "Make a test"
   puts a prompt in the composer the same way. When they ask for a test from
   it, call `recording`, write the test in the project's style
   (Compose `onNodeWithText(…).performClick()`, Espresso, or `shadowdroid ui`
   commands), prefer selectors over coordinates, and run it.
5. When the user is done, call `control` `detach`. Emulators the `boot` tool
   started shut down 10 minutes after detach.

## ShadowDroid Cloud

In a project linked to ShadowDroid Cloud (`shadowdroid cloud status --json`),
the device is the cloud session's emulator: `control` `attach` and the viewer
work the same, forwarded to this machine, and `boot` isn't needed. Setting
Cloud up, when there is no Android SDK and the user chooses it over a local
install, is in `shadowdroid commands --guide cloud`; ask before signing in or
uploading anything. With no `shadowdroid` CLI but the ShadowDroid Cloud MCP
tools, `open_viewer` returns a live viewer link (view.shadowdroid.dev) to open
in the in-app browser.

## Viewer or emulator window

The user picks how they see the device; it's ShadowDroid's `show_device`
setting:

- `viewer` (the default): the live viewer in Codex's in-app browser.
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

## Rules

- **Consent.** Tools that act on the device return `consent_required` until
  the user clicks **Let Codex use it** in the viewer. Tell them, and wait.
  Never grant it yourself or work around it.
- **Shared device.** The user can drive the same device. When a result has
  `user_input_since_last_action: true`, re-read the screen before acting on
  what you saw earlier.
- **Reservation.** The device is reserved for this thread; other threads and
  tools get `device_reserved`. Tell the user rather than retrying.
- **Privacy.** Screenshots are sent to OpenAI, so don't sign in to real
  accounts on a device you use. Ask before opening URLs that carry user data.
  In a project linked to ShadowDroid Cloud, its files, builds and screen also
  go to ShadowDroid Cloud.
