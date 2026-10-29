# Reporting problems

[← README](../README.md)

When Olef itself gets something wrong, your agent can turn it into a
report for you. It drafts the report on your computer, shows it to you, and
sends it only when you approve. Reports become public GitHub issues on
[olef-dev/olef](https://github.com/olef-dev/olef/issues).

## How it works

1. **The CLI says when a problem is Olef's.** Every JSON error has a
   `fault`: `olef` (an Olef bug), `environment` (device, adb,
   network), `usage` (the command or expectation was wrong) or `app` (the app
   under test). Only `olef` errors suggest
   `olef feedback draft --from-last-error` in `next_actions`.
2. **The agent drafts a report.** `feedback draft` fills in what the CLI knows
   and the agent adds what only it knows: what it was trying to do, what it
   expected, what happened, and the commands that reproduce it. Agents can also
   report results that were wrong despite `ok: true`, things Olef
   couldn't do (`--kind gap`), friction and doc mismatches.
3. **You review it.** The draft is a Markdown file on your computer
   (`feedback show <id>` prints it). Edit it as you like; what's in the file is
   what gets sent.
4. **You submit it.** `feedback submit <id>` prints a link to a prefilled GitHub
   issue form; you read it and click Submit. With the GitHub CLI signed in,
   `feedback submit <id> --via gh --yes` creates the issue directly. Agents
   pass `--yes` only after you said yes to that report.
5. **You hear back.** Each release publishes a list of known issues. Your agent
   learns from it whether an issue is already fixed in a newer release, so it
   suggests updating instead of filing a duplicate. `feedback status` shows
   whether your reports are open or fixed, and the update notice mentions when
   a new release fixes one of them.

```bash
olef feedback draft --from-last-error --summary 'ui tap reports ok on a disabled button'
olef feedback show <id>
olef feedback submit <id>
olef feedback status
olef feedback list
olef feedback discard <id>
```

Agents get the full instructions from `olef commands --guide feedback`.

## What a report contains

| Always | Your Olef version and install method, host OS and architecture, the agent (Claude Code, Codex or other), and the agent's description |
| --- | --- |
| By default | The device profile: Android release, API level, ABI, manufacturer and model, emulator or physical, device service version. `--no-device` leaves it out |
| With `--from-last-error` | The error result: code, stage, message and details, the command and its flag names (never their values) |
| With `--attach` | `doctor`: check names and statuses; `why`: its verdict and which sources it checked; `usage`: the usage-log summary, if you turned the log on |
| Never | Screen text, UI trees, logs, network traffic, screenshots, files from the device or your app's data |

Everything goes through Olef's redaction rules (the built-in ones plus
any you configured), including the agent's own text. Read the draft anyway
before you submit: issues are public. For anything private, email
contact@olef.dev instead.

A second draft for the same problem within seven days returns the first one,
so an agent can't flood you with drafts.

## Files and settings

- Drafts: `~/.olef/feedback/<id>/` (`report.md` is what gets sent).
- The last Olef error: `~/.olef/feedback/last-error.json`. It is
  written only for `fault: "olef"` errors, overwritten by the next one,
  and never sent on its own. `OLEF_NO_LAST_ERROR=1` turns it off.
- The known-issues list: `~/.olef/known-issues.json`, fetched by the
  daily update check (see [Updating](updating.md#the-update-notice));
  `OLEF_NO_UPDATE_CHECK=1` turns that off. `feedback status --refresh`
  fetches it on request.
- `OLEF_HOME` moves all of these.

When Olef crashes internally, the result is an `internal_panic` error
like any other, so it can be reported the same way.
