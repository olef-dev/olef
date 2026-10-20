# Test runs

A ShadowDroid test is a folder with a Bash script, `test.sh`, that drives
the app with one `shadowdroid` command per step. Each command waits for its
target and checks its own result, so the script needs no sleeps, no `jq` and no
library. Running it needs no model and no API key: an agent explores once,
and the test replays without AI.

```text
tests/shadowdroid/mission_recovery/
  test.sh          the script (executable)
  screens/         optional: one screenshot per step (<step>.jpg), shown next to the screen now when that step fails
  data/            optional: data sets for --params (*.env)
  README.md        written by `record save`: the steps in plain English, parameters, how to run it
  recording.json   written by `record save`: compiled steps, alternative selectors, what saving removed
  responses/       written by `record save` when the proxy captured the flow: the server responses
  expect/          written by `record save` when the proxy captured the flow: request payloads the steps sent
```

Write it by hand, or record it: [recording tests](recording.md) turns a
viewer recording or an agent's exploration into this folder (the sample's
`mission_recorded` was saved from a viewer recording).

The example below is the sample app's `mission_recovery` test.

## Writing a test

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

APP=io.github.andriyo.shadowdroid.sample
CALLSIGN="${CALLSIGN:-Ada}"

step() { export SHADOWDROID_STEP="$1"; }
TOKEN="$(mktemp -d)/session.token"
trap 'shadowdroid --session-file "$TOKEN" session close --exit-code $?' EXIT
shadowdroid session open --token-out "$TOKEN" --agent test:mission_recovery --app "$APP" \
  --clear-data --profile automation --launch .MainActivity --expect-rid status_text
export SHADOWDROID_SESSION_FILE="$TOKEN"

step open-mission
shadowdroid ui tap --rid nav_mission --expect-rid mission_claim_button

step claim-incident
shadowdroid ui text --rid name_input --clear "$CALLSIGN"
shadowdroid ui tap --rid mission_claim_button --expect-text "Incident claimed by $CALLSIGN"
```

- **Header**: `set -euo pipefail`, `cd` to the test's folder, parameters,
  the `step` function, the token and the `trap`, then `session open` (see
  [sessions](sessions.md) for its settings, starting state, guards and
  journal). Arm the trap first: closing a session that never opened is a
  no-op, and close undoes the starting state.
- **Parameters** are environment variables with defaults:
  `CALLSIGN=Grace bash test.sh`, or `test run --env CALLSIGN=Grace`.
- **Steps**: `step <id>`, one action, then zero or more checks (`--expect-*`
  on the action, or `ui wait` after it).
- **Sub-flows** are other test scripts: `bash ../login/test.sh` opens a
  session nested under the caller's and returns to it.
- **Portability**: Bash 3.2 (macOS `/bin/bash`): no arrays, `mapfile` or
  `${x,,}`; one command per line with `\` continuations. Literal text in
  single quotes, only parameters in double quotes.

Any language can run the same commands: start with `session open`, stop at
the first non-zero exit, set `SHADOWDROID_STEP` per step, and close the
session in a `finally`. `test show test.sh --json` gives each step's argv.

## Running

```bash
shadowdroid test run tests/shadowdroid
shadowdroid test run tests/shadowdroid/mission_recovery --repeat 10 --junit-out build/junit.xml
shadowdroid test run tests/shadowdroid --retries 1 --shard 2/4 --artifacts-dir build/sd-runs
shadowdroid test run tests/shadowdroid/checkout --params 'data/*.env'
```

`test run` runs each folder's `test.sh` through its shebang (else `bash`),
one at a time. Each run gets its own folder, named by `SHADOWDROID_RUN_DIR`;
the script's `session open` writes the journal, failure report and
`report.html` there. The runner itself holds no device lock: the scripts'
sessions reserve the device, nested under yours when you hold one. Device
selection (`-d`, `--target`), `--authority-dir` and your session token are
passed to the scripts.

| Flag | Effect |
| --- | --- |
| `--repeat N` | Run every test N times; tests and steps are classified `stable_pass`, `stable_fail` or `flaky` |
| `--retries N` | Rerun a failed test up to N times; a pass after a retry is `flaky`, never a plain pass |
| `--env K=V` | Set a parameter (repeatable) |
| `--params GLOB` | Run once per data set (`KEY=VALUE` lines), matched in the test folder first |
| `--capture steps\|failures\|off` | Evidence per step (default `failures`; `steps` keeps a screenshot of every step) |
| `--shard I/N` | Run only shard I of N of the sorted test list |
| `--junit-out FILE` | JUnit XML (default `<artifacts-dir>/junit.xml`) |
| `--artifacts-dir DIR` | Run folders and reports (default `.shadowdroid/test-runs/run-<ms>/`) |
| `--fail-fast` | Stop after the first test that fails (after its retries) |

The run writes `junit.xml`, `report.json` and an index `report.html` linking
each run's own report. It exits non-zero with `code: test_failed` when a test
failed, naming the first failure in plain words, its `fault`, and the
`test heal` command for it.

### JUnit

One `<testsuite>` per test run (per repetition with `--repeat`), one
`<testcase>` per step. A failure whose fault is `app` or `test` is a
`<failure>`; `environment` or `shadowdroid` is an `<error>`. Steps a failed
run never reached are `<skipped>`. A repetition that passed after a retry
carries Surefire's `<flakyFailure>` for the earlier failure (`<rerunFailure>`
when it still failed). Each suite names its run folder.

### Flake report

`report.json` lists, per test, every run and every step's classification,
pass/fail counts and median time. `flake_report` lists flaky steps and the
flake risk seen in passing runs: checks that took more than 70% of their
limit (`slow_check`), guard retries (`dismissed_system_ui`) and `--pace-ms`
in use.

## When a test fails

The failing command's error carries `detail.test_failure`, saved as
`failures/<step>/report.json` in the run folder:

- **Where**: test, step, command.
- **Cause**: `code`, a plain sentence (for a changed text: "Expected text
  'Relay calibrated at 71%' did not appear; the screen shows 'Relay
  calibrated at 70%' instead"), and whose fault it is: `app` (a check
  failed, a crash), `test` (the selector no longer matches), `environment`
  (system UI, no network, an injected fault) or `shadowdroid`.
- **Expected vs actual**: the step's recorded screenshot next to the screen
  now, the closest on-screen texts, error texts the app shows.
- **Near misses**: `closest` selectors (a misspelt id's real one first).
- **App and device**: in front, processes alive, crashes with stacks, recent
  error logs; airplane mode, Wi-Fi, data, `http_proxy`, faults.
- **Fix**: a selector swap, or an expectation update flagged "confirm the new
  text is intended".

`test heal <test> --from <run-folder>` turns that fix into a one-line patch
(`<run-folder>/heal.patch`). It never edits the script, and never rewrites a
value built from a parameter.

## Reports from direct runs

`bash test.sh` leaves its session folder under `.shadowdroid/sessions/`.
`test report <folders>…` builds the same JUnit and flake report from such
folders (or from a test run's artifacts), and `--baseline <run>` flags steps
whose median time grew by at least 1.5× and 500 ms.

## Lint and show

`test lint` reads scripts without running them and reports, with a fix for
each: coordinates, text-only selectors (with the `ui audit` hint), actions
without checks, `sleep`, a missing `set -euo pipefail` or `trap`, unquoted
parameters, secrets in literal text (an error), Bash 4 features, and custom
code it cannot read. `test show test.sh [--json]` prints the parameters,
steps and argv lists.

`shadowdroid test -- <command>` still runs instrumentation tests with the
UiAutomation slot freed; only a program literally named like a subcommand
(`run`, `report`, …) needs the `--`.
