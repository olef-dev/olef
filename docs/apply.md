# Apply Changes

`olef app apply` is the edit-to-device step: it builds the project and puts
the change on the device the cheapest correct way, then says what it did.
Run it from the project root after every edit, instead of `gradlew
installDebug` plus a relaunch.

```bash
olef app apply                         # module `app`, variant `debug`
olef app apply --module apps:phone --variant stagingDebug
olef app apply --at-least restart-activity
olef app apply --fresh-viewmodels      # restart, and rebuild the ViewModels
olef app apply --mode reinstall        # always build, install and launch
```

## What it decides

Each apply compares the new build with what the device runs and picks one
`action`:

| `action` | What happens | App state |
| --- | --- | --- |
| `hot` | The changed classes are redefined in the running process and the affected composables recompose. On API 30+ new methods, fields and classes apply in place too. | kept |
| `restart_activity` | The classes are redefined, then the current activity is recreated (with `--fresh-viewmodels`, its ViewModels too) so code that already ran runs again. | kept outside the activity |
| `reinstall` | A normal build, install and launch. | lost |
| `none` | Nothing changed since the last apply. | kept |

It reinstalls when in-place apply can't carry the change: the first apply on
a device (there is no baseline yet), after a clean build, when the app was
installed by something else since, when a non-code file changed (resources,
assets, the manifest, native code, Gradle files), when a class was removed or
its hierarchy changed, or when the runtime can't attach (the app is not
debuggable, or the device is too old). `--at-least` raises the level when a
value is cached somewhere the analysis can't see.

In-place apply goes through the Olef runtime, so the app must be debuggable.

## Reading the result

```jsonc
$ olef app apply
{"type":"action","cmd":"app_apply","ok":true,
 "action":"hot","package":"com.example.app",
 "reasons":["only method bodies changed"],
 "takes_effect":"now","state_kept":true,"state_reset":[],
 "on_screen":true,"notes":[],
 "screen":{"app":"com.example.app","changed":true,
           "appeared":["Total: 3 items"],"gone":["Total: 3"]},
 "timings":{"total_ms":1840, …},"deadline_exceeded":false,
 "next_actions":["olef -d emulator-5554 ui screenshot", …]}
```

- `reasons` says why this action was chosen, one line per cause.
- `takes_effect` says when the change shows: `now`, `after_restart`,
  `after_reinstall`, or a list of the moments a hot change waits for, such as
  `["next_call"]` (the method runs again the next time it's called) or
  `["on_first_use"]`.
- `state_kept` is false only for a reinstall; `state_reset` names the
  composables whose remembered state was rebuilt.
- `on_screen: false` means the changed composables aren't showing; navigate
  to them to see the change.
- `notes` explains anything else worth knowing, such as a value computed
  before the change that keeps its old result.
- `screen` is what changed in the UI structure (`--no-screen` skips the two UI
  reads it costs).
- `crash` appears when the app crashed or a composable threw while the change
  was applied, with the exception, root cause and stack.
- `logged_errors` lists errors the app logged during the apply, and
  `failed_requests` the requests that failed, when `net start` is capturing.

## Module and variant

The module defaults to `app` and the variant to `debug`. Set them once in the
project's `.olef/config.json` (`"module"` and `"variant"`, top level, or on
the app alias the config's `app` names) instead of passing flags. Config files
are covered in [configuration.md](configuration.md); `olef config schema`
lists every key.

## In the Claude Code and Codex plugins

The plugins' `build` tool runs the same apply and shows it in the device
viewer's Builds tab; see the [Claude Code plugin](../claude-plugin/README.md).
