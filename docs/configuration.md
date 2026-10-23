# Configuration

[← README](../README.md)

Put repeated values in config instead of spending prompt/context on every
command. Config lives in a folder: the global `~/.shadowdroid/config.json` is
loaded first, then a project `.shadowdroid/config.json` from each of the current
directory's ancestors, with the nearest project file winning.

All host state lives in `~/.shadowdroid` (user config, device locks and session
authority, proxy CA, debugger registry, APK/runtime caches). Set
`SHADOWDROID_HOME` to move it, for example into an agent's workspace when its
sandbox may only write there; ShadowDroid then also leaves user-scope agent
skills untouched.

```bash
shadowdroid config schema --json
shadowdroid config init --project --app Livd --package com.livd --app-target mobile \
  --default-target mobile --target-name mobile --target-avd Livd_Pixel_9_API_36 \
  --target-start if-needed --target-form-factor mobile \
  --project-path /Users/you/Work/Livd --json
shadowdroid config validate --json
```

```json
{
  "default_target": "mobile",
  "app": "Livd",
  "project": "/Users/you/Work/Livd",
  "redaction": {
    "enabled": true,
    "json_keys": ["customerId"],
    "patterns": ["ORDER-[0-9]+"]
  },
  "proxy": {
    "ca_trusted": true,
    "hosts": ["*.livd.app"],
    "trust_store": "user"
  },
  "apps": {
    "Livd": {
      "package": "com.livd",
      "debug_mode": "mixed",
      "target": "mobile"
    }
  },
  "targets": {
    "mobile": {
      "avd": "Livd_Pixel_9_API_36",
      "start": "if-needed",
      "form_factor": "mobile"
    },
    "tv": {
      "avd": "Livd_TV_API_35",
      "start": "if-needed",
      "form_factor": "tv"
    }
  }
}
```

## Named targets

Named targets make multi-project and mobile/TV work deterministic. ShadowDroid
matches a running emulator by its stable AVD name, discovers its current adb
serial, and reuses it. If none is running, `start: "if-needed"` opts into
starting that existing AVD and waiting for Android to finish booting; the
default policy is `never`. ShadowDroid never silently creates an AVD. Physical
devices use a target entry with `"serial": "..."` and are never auto-started.

Use `shadowdroid --target tv connect` to override `default_target`; explicit
`-d/--device` has highest precedence. `shadowdroid devices` stays passive and
includes the AVD name when Android exposes it. AVD claims under
`~/.shadowdroid/targets/claims/` prevent two projects from silently sharing one
emulator — and therefore its accounts, proxy, and single UiAutomation slot. Use
`--takeover` only for an intentional reassignment. Startup uses the Android SDK
emulator found via `ANDROID_SDK_ROOT` / `ANDROID_HOME` / PATH; set
`SHADOWDROID_EMULATOR` for an explicit executable.

AVD names are host configuration. Commit target bindings only when the team
standardizes those names; otherwise define `targets` in the user config and
keep only the project's `default_target` / app `target` roles in project config.

## Remote devices (Google Cloud DDP, preview)

ShadowDroid can reserve real phones from Google Cloud's Developer Device
Platform and drive them like a USB device. Sessions are billed to your own
Google Cloud project; setting the project is the opt-in:

```json
{ "ddp": { "project": "my-gcp-project", "budget_usd_per_day": 10 } }
```

`GOOGLE_CLOUD_PROJECT` works too. Alternatively `"billing": "shadowdroid"`
uses real phones from ShadowDroid, billed to your ShadowDroid account (sign in
with `shadowdroid cloud login`; limited preview, enabled per account): no
Google Cloud project or credentials needed, and the device's connection goes
through ShadowDroid. Credentials come from your Google Cloud
login: application default credentials (`gcloud auth application-default
login`), the GCE metadata server, or `gcloud auth print-access-token`
(`SHADOWDROID_DDP_AUTH=gcloud` uses gcloud first). The project needs the
`devicestreaming`, `devicerun` and `testing` APIs enabled.

```bash
shadowdroid devices list                               # every device: local, Cloud, real phones
shadowdroid devices catalog --physical --available     # specs like ddp:komodo-35
shadowdroid devices reserve ddp:komodo-35              # → serial 127.0.0.1:<port>
shadowdroid -d ddp:komodo-35 app apply                 # any verb, by spec or serial
shadowdroid devices release ddp:komodo-35
```

- Spending: with `ddp.budget_usd_per_day` set, agents may reserve devices
  until the day's (UTC) spend reaches it, and held devices are released when
  it does. Without it, the first reserve of the day asks you (in a terminal,
  or in the device viewer when an agent asks: it gets
  `cost_confirmation_required` until you click Reserve); your yes approves
  billed devices for the rest of that day, up to $10. `devices leases` shows each
  lease's cost and the day's spend. Spend is estimated from DDP's preview list
  prices ($0.15/min physical, $0.017/min virtual; `ddp.price_per_minute_usd`
  overrides).
- A reserved device is held by a background daemon that extends the session
  while it is used (up to `ddp.max_duration_ms` / `--max-duration-ms`,
  default 2 h) and releases it after `ddp.idle_release_ms` /
  `--idle-release-ms` without use (default 10 min). Android Studio's routine
  polling of attached devices does not count as use.
- The device viewer's title is a device picker: attached devices, AVDs to
  boot, this project's Cloud emulator and real phones with their price, and
  a reserved phone's time left, cost and Release. Agents use the MCP
  `devices` tool, which shows its request in the viewer.
- `-d ddp:<id>` only uses a device you already reserved; it never starts a
  billed session. `session open -d ddp:<id>` reserves it and `session close`
  releases it.
- A named target can point at a spec: `"targets": {"pixel9": {"serial": "ddp:tokay-35"}}`.
- DDP devices are production builds without `adb reverse`, root or an
  emulator console. `net` still works: the device reaches the proxy through
  a relay in the ShadowDroid server (`net status` reports `wiring: relay`).
  HTTPS interception needs the proxy CA trusted, which on these builds means
  a manual user-CA install (`net trust --push`) and an app that trusts user
  CAs. Faults that need the emulator console are unavailable.

## Project path and source mapping

The `project` path matters for debugging: `why` and `log` use it to map crash
stack frames back to files in your source tree (`project_frames`), so the agent
gets `app/src/main/java/.../CartRepo.kt:42` instead of a bare class name.
The debugger resolves breakpoint files under it, and the native debugger finds
unstripped `.so` symbols in its Gradle outputs.

## Debugger settings

`debug_mode` sets the engines `debug attach` uses when `--mode` is not given:
`java` (JDWP), `native` (LLDB), or `mixed` (both); `auto` means `java`. Set it
at the top level or per app alias (`apps.<alias>.debug_mode`, which wins);
`config init --debug-mode <mode>` writes it.

Native debugging needs an Android NDK on the host. ShadowDroid looks in
`SHADOWDROID_NDK`, `ANDROID_NDK_HOME`, `ANDROID_NDK_ROOT`, `ANDROID_NDK`, then
the newest `<sdk>/ndk/<version>`. See
[debugging](debugging.md#native-and-mixed-debugging).

The Android Studio integration was removed. These keys are deprecated and
ignored: `studio_url`, `android_studio`, `studio_plugin`, `debugger`,
`debug_backend`, and `run_configuration` (top level), and `run_configuration`
and `debugger` in an app alias. They still parse so existing configs load,
and `config validate` warns about them. Remove them when convenient.

## Editing and recovery

`config init` changes only explicitly supplied fields, deep-merges an existing
app alias, validates Android identifier fields, and atomically replaces the
target file. Treat a committed project config as repository input, never as a
place for shell fragments. If a malformed config prevents an ordinary command
from loading, recovery commands still work because they run before normal
config loading:

```bash
shadowdroid config paths --json
shadowdroid config validate --json  # non-zero config_invalid with report in detail
shadowdroid config schema --json
shadowdroid commands --json --depth 1
```

## Injection safety

Repository config cannot supply executable device-shell fragments: app
packages are validated while the config is deserialized, permission/app-op
tokens are validated at their command boundary, and accepted values are quoted
before entering an Android shell command. Values containing `;`, newlines,
`$()`, quotes, or whitespace fail with a typed `invalid_*` error.

## Per-project proxy CA

The `net` MITM proxy signs with a CA that ShadowDroid resolves per invocation:
an explicit `proxy.ca_cert`/`proxy.ca_key` in config (absolute or `~/` paths),
else a per-project convention CA at `<project>/.shadowdroid/ca.{crt,key}`, else
the global `~/.shadowdroid/net/ca.{crt,key}`. Mint a project CA with
`shadowdroid net ca reset --project` (or import your own with `net ca import
--project --cert …`); `config init --project` and the project-scoped `net ca`
verbs write a `.shadowdroid/.gitignore` so the CA cert, key, and `.bak` backups
are never committed.

Set `proxy.ca_trusted: true` to tell ShadowDroid the CA is already trusted on
the device (e.g. baked into a custom emulator image) — `net trust`/`net check`
then skip the adb install and trust-store readback and report the basis as
`asserted`. Even without it, a successful `net trust`/`net check` is cached per
device (keyed by CA fingerprint), so repeat runs skip the probe; pass `--fresh`
to force a real check.

See [network.md](network.md) for the full proxy workflow.
