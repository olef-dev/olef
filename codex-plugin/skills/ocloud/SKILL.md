---
name: ocloud
description: >-
  Create, customize, schedule, and orchestrate Olef Cloud agents, workspaces,
  conversational threads, prompt-driven event workflows, native agent skills,
  local agent checkouts, and your Olef inbox using the `ocloud` CLI. Use
  whenever the user asks to create a cloud agent, talk to a cloud agent, set up
  a scheduled task or reminder via a cloud agent, subscribe an agent to events
  or webhooks, check or watch their Olef inbox, install skills on an agent,
  check out an agent locally (--edit or --live), or manage Olef Cloud
  workspaces.
---

# Olef Cloud (`ocloud`)

Use the `ocloud` CLI to author and manage Olef Cloud agents, workspaces,
threads, schedules, event subscriptions, and your Olef inbox. Every `ocloud`
command returns structured JSON so you can inspect IDs, addresses, and
`next_actions`.

Before running cloud commands, make sure `ocloud` is installed and the user is
signed in (`ocloud whoami`). If `ocloud` is not found, offer to install it and
run the command only with the user's yes: `brew install olef-dev/tap/ocloud`
(macOS/Linux with Homebrew), `scoop install ocloud` (Windows, after
`scoop bucket add olef https://github.com/olef-dev/scoop-bucket`), or the
installer from https://github.com/olef-dev/ocloud/releases/latest. If not
signed in, ask the user before running `ocloud login`.

## Using `next_actions`

Every `ocloud` response includes deterministic `next_actions` hinting what is in
principle possible next—both for your own next step/recovery and for ideas to
offer the user. At turn boundaries or blockers (after creating an agent,
workspace, schedule, or subscription, finishing a thread/job, or hitting an
auth/quota/host issue), translate 2–3 relevant `next_actions` into brief
plain-English options for the user. Skip mid-loop steps and anything already
done, and never run commands that sign in, upload code, incur billing, or
delete/reset resources without asking first.

---

## 1. Creating a Cloud Agent (Smart Defaults)

When the user asks to create a cloud agent without specifying every option,
choose sensible defaults (while always honoring any explicit overrides):

1. **Name**: Pick a concise, meaningful personal slug `me/<slug>` matching the
   user's goal or current project folder (e.g., `me/assistant`, `me/inbox-bot`,
   `me/android-helper`), or `<team>/<slug>` when creating a team agent.
2. **Runtime**: Default to `--runtime codex` in Codex sessions (unless the user
   explicitly asks for `--runtime claude-code`).
3. **Workspace**:
   - First run `ocloud status` in the current working directory.
   - If `linked: true`, attach the new agent to that existing workspace:
     ```bash
     ocloud agent create me/<slug> --runtime codex --workspace <workspace_id>
     ```
   - Otherwise, Olef Cloud eagerly creates a dedicated hosted workspace for the
     agent — **no GitHub repository is required**. Pick `--template` from the
     current folder and user intent:
     - `--template android` if the folder is an Android project (`gradlew`,
       `AndroidManifest.xml`, Android Gradle plugin) or the user asks for
       Android/mobile work.
     - `--template web` if the folder is a web/Node project (`package.json`,
       `vite.config.*`, `next.config.*`) or the user asks for web/frontend work.
     - `--template general` otherwise (personal assistants, reminders,
       automation, scripting, research).
   - If the user wants the agent bound to a GitHub repo, pass
     `--repo owner/name` (mutually exclusive with `--workspace`).
   - By default the agent lives and runs in **Olef Cloud** (override placement
     with `--where <host-pool>` if the user asks for a self-hosted machine).

Example (general cloud agent):
```bash
ocloud agent create me/cloud-assistant --runtime codex --template general
```

After creating the agent, tell the user:
- Its name/inbox address (e.g. `andrii/cloud-assistant`), runtime (`codex`),
  and attached workspace (hosted `general` or their linked workspace).
- That it is live in Olef Cloud and can be customized further:
  - Chat directly: `ocloud thread new <address> "<prompt>" --wait`
  - Add reusable skills: `ocloud agent skill put <address> <skill-name> --from <path>`
  - Edit locally while cloud stays live: `ocloud agent checkout <address> --edit`
  - Route live traffic to this machine for interactive debugging:
    `ocloud agent checkout <address> --live`

---

## 2. Chatting with a Cloud Agent (Conversational Threads)

Agents work like a remote Codex/Claude conversation — no `--repo-id` is needed
for workspace agents:

- **Start a new thread and wait for the reply**:
  ```bash
  ocloud thread new <address> "What's the capital of France?" --wait
  ```
  Returns `{ thread, message, reply, text }`. The reply is also delivered to the
  user's personal inbox (`@<handle>`).
- **Send a follow-up in the same thread** (resumes the agent's native CLI
  session):
  ```bash
  ocloud thread send <thread_id> "And Germany?" --wait
  ```
- **Inspect or control threads**:
  - `ocloud thread list [--agent <address>]`
  - `ocloud thread show <thread_id>`
  - `ocloud thread stop <thread_id>` / `ocloud thread close <thread_id>`

---

## 3. Prompt-Driven Scheduled Tasks & Event Workflows

Olef workflows are **prompt-driven** (there is no `--skill` flag):

- **Simple or one-off tasks**: put the behavior directly in `--text` (schedules)
  or `--prompt` (event subscriptions).
- **Reusable or multi-step behaviors**: install a native skill in the agent's
  portable home (`.codex/skills/<name>/SKILL.md` or
  `.claude/skills/<name>/SKILL.md`) via `ocloud agent skill put` (or
  `checkout --edit` → `redeploy --yes`), then reference it naturally in the
  prompt (e.g. `"Use the daily-briefing skill and send the summary to my inbox."`).

### One-shot & Recurring Schedules (`ocloud schedule`)

- **"Hello World" in 1 minute**:
  ```bash
  ocloud schedule create \
    --inbox <address> \
    --at +1m \
    --text "Send a 'Hello world' message to my inbox."
  ```
  - `--at` accepts relative offsets (`+10s`, `+1m`, `+2h`, `+1d`), RFC 3339
    timestamps (`2026-11-09T17:00:00Z`), or local wall-clock times
    (`2026-11-09T09:00`).
  - Cloud schedules are dispatched on a ~1-minute scheduler tick, so `+1m`
    typically triggers within 1–2 minutes.
- **Recurring schedule**:
  ```bash
  ocloud schedule create \
    --inbox <address> \
    --rrule "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;BYHOUR=9;BYMINUTE=0" \
    --tz "America/Los_Angeles" \
    --text "Use the morning-standup skill and send me today's summary."
  ```
- Manage schedules: `ocloud schedule ls`, `show <id>`, `preview <id>`,
  `occurrences <id>`, `pause <id>`, `resume <id>`, `rm <id>`.

### Event Subscriptions (`ocloud events`)

Subscribe an agent to a polled JSON/GraphQL endpoint or a pushed connection
(GitHub, Jira, webhook), passing `--prompt` for the trusted instructions
prepended above untrusted event data:

```bash
# Standing HTTP JSON subscription on an agent
ocloud events subscribe \
  --agent <address> \
  --source "https://api.example.com/alerts" \
  --each '.items[] | {id: .id, url: .url}' \
  --prompt "Use the alert-triage skill and reply with a concise summary."

# Pushed webhook/Jira connection subscription
ocloud events subscribe \
  --connection <conn_id> \
  --inbox <address> \
  --when '.severity == "high"' \
  --prompt "Summarize this incident and reply with recommended next steps."
```

> **Tip for external event subscriptions**: Instruct the agent to reply directly
> in its thread — its final reply lands automatically in the owner's personal
> inbox without triggering external-text cross-team approval prompts.

---

## 4. Managing Native Skills & Local Checkouts

### Quick Skill Management (no local checkout needed)

```bash
ocloud agent skill ls <address>
ocloud agent skill put <address> <skill-name> --from ./path/to/SKILL.md
ocloud agent skill put <address> <skill-name> --from ./path/to/skill-dir
ocloud agent skill rm <address> <skill-name>
```

### Local Edit & Live Checkout

- **Edit mode** (cloud agent stays live while you edit instructions/skills
  locally):
  ```bash
  ocloud agent checkout <address> --edit
  ocloud agent open <slug>
  ocloud agent diff <slug>
  ocloud agent redeploy <slug> --yes
  ```
- **Live mode** (routes live inbox/event traffic to your machine's Olef host
  for interactive debugging; requires `ocloud host setup`):
  ```bash
  ocloud agent checkout <address> --live
  ocloud agent open <slug>
  # Push changes and return to cloud:
  ocloud agent redeploy <slug> --yes
  # Or immediately abort lease back to cloud:
  ocloud agent checkout <address> --abort
  ```

---

## 5. Listening to the User Inbox

Find your personal inbox handle with `ocloud whoami` (typically `@<handle>`):

- **Read recent messages**: `ocloud inbox messages @<handle>`
- **Stream live updates with inline previews (4 KiB bounded)**:
  ```bash
  ocloud inbox watch @<handle> --expand
  ```
  Pass `--once` to poll one page and exit (useful in scripts or chat checks).
- **Answer an agent's question or approval**:
  ```bash
  ocloud msg answer <msg_id> --text "Yes, proceed"
  ocloud msg answer <msg_id> --decision approve
  ocloud msg answer <msg_id> --decision decline
  ```
- For persistent macOS menu-bar notifications and a dedicated Inbox + thread
  chat UI, open the **Olef Host** (`olef-tray`) app.

---

## 6. Standalone Workspaces

- List accessible workspaces: `ocloud workspace ls`
- Create a standalone hosted or host-backed workspace:
  ```bash
  ocloud workspace create <name> --template general   # or web | android
  ocloud workspace create <name> --template general --on host:<pool>
  ```
- Link the current local folder to a workspace: `ocloud link`

---

## 7. Zero-LLM Cloud Jobs, Scoped Tokens & Policy Validators

Run deterministic checks, tests, or scripts in cloud workspaces at $0 LLM cost,
and only wake an AI agent on failure (`--on-fail`) or metric regression:

- **Scoped automation tokens (`OLEF_TOKEN=sdtok_...`)**:
  ```bash
  ocloud token create --name github-ci --project <proj> \
    --scope jobs:run:pr,builds:push --expires-days 90 \
    [--allowed-ips 203.0.113.0/24]
  ocloud token list [--project <proj>]
  ocloud token rotate <token_id> --grace-hours 24
  ocloud token revoke <token_id>
  ocloud token oidc create --name gha-pr --issuer https://token.actions.githubusercontent.com \
    --audience olef:<org> --claim repository_id=12345 --scope jobs:run:pr --project <proj>
  ```
- **Run & inspect zero-LLM Cloud Jobs**:
  ```bash
  ocloud job run --workspace <ws> -- ./gradlew test
  ocloud job run --project <proj> --name pr --on-fail qa/team --wake-on regression
  ocloud job run --workspace <ws> --hold-on-fail 15m -- ./scripts/smoke.sh
  ocloud job debug <job_id> --extend 15m
  ocloud job ls | show <id> | logs <id> -f | cancel <id> | artifacts <id>
  ocloud job breaker ls | show <key> | trip <key> --ttl 30m | reset <key>
  ```
- **WASM policy validators & verified builds**:
  ```bash
  ocloud validator upload policy.wasm
  ocloud validator ls
  ocloud validator test <sha256> --input @sample.json --policy @policy.json
  ocloud builds push --project <proj> --verified-by-job <job_id>
  ```
- **Graduate a prompt schedule to a zero-LLM job in place**:
  ```bash
  ocloud schedule graduate <schedule_id> --cmd "./scripts/health.sh" --parser json-checks --wake-on regression
  ```
