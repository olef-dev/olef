# Recording tests

Record a flow once, in the device viewer or by driving the app with
`shadowdroid` commands, and save it as a test folder: a Bash script of one
`shadowdroid` command per step, each naming its element and checking its own
result, plus a screenshot of every step. The test then replays without AI;
see [test runs](test-runs.md) for running and repairing it.

Every [session](sessions.md) keeps a journal of what is done in it, so there
is nothing to switch on: an agent explores, then saves.

The sample app has a folder saved this way from a viewer recording of its
Mission flow, unedited:
`samples/shadowdroid-test-app/tests/shadowdroid/mission_recorded/` in the
development repository (its hand-written twin is `mission_recovery`).

```bash
TOKEN="$(mktemp -d)/session.token"
shadowdroid session open --agent explorer --token-out "$TOKEN" \
  --app io.github.andriyo.shadowdroid.sample --clear-data --profile automation \
  --launch .MainActivity --expect-rid status_text
export SHADOWDROID_SESSION_FILE="$TOKEN"
shadowdroid record step open-mission
shadowdroid ui tap --rid nav_mission --expect-rid mission_claim_button
…                                          # explore; dead ends and typos are fine
shadowdroid record save mission_recovery   # clean up, compile, replay, write the folder
shadowdroid test run tests/shadowdroid/mission_recovery --repeat 3
shadowdroid session close
```

## In the viewer

Click **Record steps** (or press Cmd+T) and use the app. Recording starts
from the screen as it is. Shift-click asks to clear the app's data and
relaunch the screen in front first, so the test starts from a fresh install's
state. Clearing erases whatever the app keeps on the device (a signed-in
account, a debug switch such as "use the local backend"), so it is never the
default; tests that need it can run the app's own setup script before
`session open`. The
**Steps** tab shows each step as the line the test will run, with its
screenshot, how the element is found (id, label, text or coordinates) and
the recorder's confidence. Remove a step or a generated check with its ✕.
**Check** turns the next click on the screen into a check of what that
element shows (it is not tapped).

Click the button again to stop. The tab then lists what was left out and
why, and offers **Save as test** (the replay below, then the folder),
**Check it** (`test run --repeat 3`) and **Send to** the agent with the
folder's path. The MCP `recording` tool returns the same steps and the saved
folder.

The viewer runs in the session of the agent that opened it, so a recording
can mix the person's input and the agent's commands.

## Verbs

| Command | Does |
| --- | --- |
| `record start [--app P] [--clear-data] [--launch [ACTIVITY]] [--expect-rid R \| --expect-text T]` | Begins a recording, optionally from a fresh start. A bare `--launch` relaunches the app's screen in front. `--clear-data` refuses to clear anything but an installed app of yours. |
| `record stop` | Ends it and keeps the screen it ended on (the last step's checks are read from it). |
| `record step "<name>"` | Names the commands that follow: `step pay-with-the-saved-card`. Commands with `SHADOWDROID_STEP` set keep that name. |
| `record mark <name>` | Names a point, for `record save --from/--to`. |
| `record check <selector> [--has-text S \| --checked [B] \| --selected [B] \| --enabled [B] \| --gone]` | Adds a check of your own; it must hold now. Written as `ui wait …` under `# checked by you`. |
| `record show` | The recording as it would be saved: each step's lines, what clean-up removes and why, and the script. Changes nothing. |
| `record status` | Whether a recording is on, and how much it holds. |
| `record save <name> [-o DIR] [--from MARK] [--to MARK] [--last N] [--no-verify] [--force] [--journal DIR]` | Cleans up, compiles, replays and writes the folder (default `tests/shadowdroid/<name>/`, or `tests.dir` in `.shadowdroid/config.json`). |
| `record discard` | Starts over from here; the journal itself is kept. |

Without `record start`, `record save` takes the whole session (after the
newest `record discard`). `--journal DIR` reads a session folder whose
session is closed, such as one a script left.

## What saving removes

Every removal is listed with its reason, in the save result, in `record
show`, in the folder's README and in `recording.json`. Nothing is dropped
silently.

- **Failed commands** whose input never reached the app: a misspelt id, an
  ambiguous selector, a disabled or covered target, a refused guard. A
  failed action whose input *was* delivered stays, without the expectation
  that failed; one whose outcome is unknown (a timeout) stays and is left to
  the replay check.
- **Reads** (`ui dump`, `ui find`, screenshots, `log`, `why`, `net log`) and
  checks that failed. Waits and checks that passed stay.
- **ShadowDroid tooling**: `net start`/`stop`, `video`, `connect`, the
  debuggers and the runtime. A test that started the proxy would leave the
  device proxied; `net rule` mocks stay, they are part of the flow.
- **Dead ends**: a run of actions after which the screen is back where it
  was, with nothing lasting in between. "Where it was" compares what can be
  acted on (ids, labels, places) plus switches, selections, slider values
  and what input fields hold, ignoring labels that changed while recording
  (a status line). Lasting: typing, a switch, checkbox or chip, a slider, a
  request that writes data (POST, PUT, PATCH, DELETE, when the proxy is
  capturing), a change to app or device state. A run is kept when a check in
  it saw something it caused that lasted, or a check right after it passed
  that did not hold before it.
- A single action counts as a no-op only when nothing visible changed at
  all: a tap whose only effect is a new line of text (a request's result) is
  kept. The recording's last action is never a dead end.
- **Scrolling** (viewer swipes, `ui scroll-to`, coordinate swipes) before an
  action becomes `--reveal` on that action.
- Viewer taps that only focused a field before typing; `ui text` focuses it.
- `--if-interaction` / `--if-screen` (bound to one recorded screen) are
  stripped from what stays.

## How a step is written

- **The element**: every way to name it is scored under the CLI's own
  matching rules on the screen as it was when the step acted:
  `--rid` (view id or Compose testTag) 100, `--desc` 70, `--text` 60, a
  label inside a clickable container 55/50; it must resolve to that element
  alone; digits, long text and generated-looking ids cost points; typed text
  and labels that changed while recording are never used. The best goes in
  the script, the next two in `recording.json` for `test heal`. An agent's
  own selector is kept unless one is clearly more stable (30 points). Ids
  from a dump (`--id`, `--handle`) and coordinates are always replaced;
  coordinates stay only when nothing names the element, marked
  `# fragile`.
- **Viewer input** is resolved against the screen at touch-down (requested
  the moment the finger goes down; a late one falls back to the last
  settled screen). A tap is `ui tap`, ≥ 500 ms `ui long-tap --duration-ms`,
  two quick taps on one place `ui double-tap`, a drag on a slider `ui
  set-progress --value` (whole numbers on a wide range), Back `ui back`,
  rotation `device orientation`. Typing (Backspace included) is one `ui text
  --rid … --clear "$PARAM"`, into the field tapped before it, with the
  value read from the field afterwards; password fields get `--value-env`.
  A tap on an element with no click action gets `--via touch`.
- **Parameters**: each typed value becomes a variable named after the
  field's label (`RUN_CODE` from "Run code") or id, with the typed value as
  its default, and checks that show the value use the variable:
  `--expect-text "Incident claimed by $OPERATOR_CALLSIGN"`.
- **Checks**, for a step that has none of its own, from what it changed
  between the screen before it, the settled screen after it and the screen
  the next step started on: a switch, checkbox or chip it tapped gets
  `--expect-checked`; else text it changed in place (a status line, its
  stable prefix: "json-post completed status=200" of "… bytes=171
  elapsed=93ms"), else a landmark it brought on screen (`--expect-rid`),
  else new short text. A dialog button that went away, with its label, gets
  `ui wait --rid … --gone`. Typing and sliders read their own value back.
  `--timeout-ms` is added only where the recording showed a step needed
  longer than the session's limit.
- **Confidence** per step: `high`, `medium` (found by label or text, or the
  screen moved under the finger) or `low` (coordinates, no check), written
  as `# low confidence: …` above the step and listed by `test lint`.

An agent that checks its own steps (`--expect-*`, `ui wait`) keeps those
checks. Generated checks need the effect to be on a recorded screen: an
agent that fires the next command before the app reacts leaves less to
read than a person in the viewer does.

## How the test starts

The test's `session open` line puts the app's runtime permissions back the
way the recording found them, so what one test answered cannot break the
next:

- The recording reads the app's runtime permissions as it starts (`record
  start`, `record discard`, or `session open --app`), after each step that
  answers a permission dialog, and at `record stop`.
- A permission that was granted gets `--grant`; one denied with "don't ask
  again" gets `--deny`, so its dialog never shows. Both go back to what they
  were when the test's session closes.
- A permission whose dialog the recording answered gets `--reset-permission`,
  so the dialog shows again for the test's `perm dialog` step. Which
  permission it was comes from what the answer changed. When that cannot be
  told (a journal from an older version), the test resets every permission
  first (`--reset-permissions`) and `record save` warns.
- A permission left undecided (never answered, or refused once so Android
  still asks) is not set. A test that depends on one can add
  `--reset-permission` or `--revoke` itself.

```bash
shadowdroid session open --token-out "$TOKEN" --agent test:livd_brand_search --app "$APP" \
  --profile automation \
  --deny android.permission.POST_NOTIFICATIONS \
  --launch com.livdapp.client.MainActivity --expect-rid home_screen
```

## The replay check

`record save` runs the cleaned script once from a fresh start, in a session
nested under yours, with the `shadowdroid` that saved it:

1. It passes: the folder is written.
2. It fails at a step whose element came from a removed step: the nearest
   removed dead end before it goes back, and it replays again. A generated
   check that did not hold on the replay is dropped instead (it read a
   transient screen). At most four replays.
3. It fails for another reason (the device, the environment, the start):
   nothing is written. The error (`record_replay_failed`) names the step,
   cause and the replay's report; `--no-verify` writes the script as
   compiled.

The save result lists `verify.replays` (each with its run folder),
`restored` and `dropped_checks`.

## The test folder

```text
tests/shadowdroid/mission_recovery/
  test.sh          the script (executable); see test runs for the format
  screens/         one half-size JPEG per step (<step>.jpg), committed with the test
  README.md        the steps in plain English, parameters, how to run it, what saving removed
  recording.json   steps as compiled, alternative selectors, removals, the replay, provenance
  responses/       the kept steps' server responses (net export fixtures), when the proxy captured
  expect/          request payloads the kept steps sent (POST/PUT/PATCH JSON, volatile values as {{any}}/{{number}}/{{iso-date}})
```

`record save --force` replaces only these files; `mocks/`, `data/` and
anything else in the folder are yours and stay. Without `--force` an
existing `test.sh` is never overwritten (the error says when it was edited
since it was generated).

Network fixtures are written for flows inside each kept step's window, a
timing heuristic. Using them (strict offline replay) and checking the
`expect/` payloads (`net wait`) come with the determinism kit.
