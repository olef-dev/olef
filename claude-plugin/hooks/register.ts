import type { Register } from 'claude-code'

// The ShadowDroid plugin's MCP tools: mcp__plugin_shadowdroid_shadowdroid__<tool>.
const PREFIX = 'mcp__plugin_shadowdroid_shadowdroid__'

type Device = { serial: string; avd?: string; viewerUrl?: string }
type Timer = { cancel: () => void }
type Session = {
  device?: Device
  poll?: Timer
  /** The device part of the status line, as last set. */
  deviceStatus?: string
  /** The cloud part of the status line, absent outside ShadowDroid Cloud. */
  cloudStatus?: string
  cloud?: CloudView
  cloudDirs?: string[]
  cloudPoll?: Timer
  /** The toasts already raised (`toastOnce`). */
  toasted?: Set<string>
}
type Json = Record<string, unknown>

/** The tool's JSON result: the first parseable object in its text. */
function parse(text: string | undefined): Json | undefined {
  if (!text) return undefined
  for (const chunk of text.split('\n')) {
    const at = chunk.indexOf('{')
    if (at < 0) continue
    try {
      const value = JSON.parse(chunk.slice(at))
      if (value && typeof value === 'object') return value as Json
    } catch {
      // not this line
    }
  }
  return undefined
}

/** The `app_apply` result in a Bash run of `shadowdroid app apply` (its last JSON line). */
export function applyResult(text: string | undefined): Json | undefined {
  if (!text) return undefined
  const lines = text.split('\n').reverse()
  for (const line of lines) {
    const at = line.indexOf('{')
    if (at < 0) continue
    try {
      const value = JSON.parse(line.slice(at))
      if (value && typeof value === 'object' && value.cmd === 'app_apply') return value as Json
    } catch {
      // not this line
    }
  }
  return undefined
}

/** A shell command that runs `shadowdroid … app apply`. */
export function runsApply(command: unknown): boolean {
  return typeof command === 'string' && /\bshadowdroid\b[^|;&\n]*\bapp\s+apply\b/.test(command)
}

/** A shell command that runs the `shadowdroid` CLI at all. */
export function runsShadowdroid(command: unknown): boolean {
  return typeof command === 'string' && /\bshadowdroid\b/.test(command)
}

// ShadowDroid Cloud, from the CLI's files under `~/.shadowdroid/cloud/`
// (SHADOWDROID_HOME moves them), all optional:
//   links.json          { links: [{ root, workspace_id, name, enabled, state, approval_url?, zone? }] }
//   login-pending.json  { user_code, verification_uri, verification_uri_complete?, expires_at }
//   <workspace>/state.json, written by the workspace's daemon:
//     { workspace, session, state, stage?, region?, idle_stop_at?, expires_at?,
//       updated_at?, error?: { code, message? } }
// `state` is starting | ready | stopping | idle | stopped | error. Times are
// RFC 3339 strings, epoch milliseconds or epoch seconds. A file older than
// 3 minutes, with no idle stop still ahead, is a daemon that's gone.

type CloudView = { link?: Json; state?: Json; stateMtime?: number; login?: Json }

/** Milliseconds since the epoch, from an RFC 3339 string or a number of seconds or milliseconds. */
function epochMs(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value < 1e11 ? value * 1000 : value
  if (typeof value === 'string') {
    const ms = Date.parse(value)
    return Number.isNaN(ms) ? undefined : ms
  }
  return undefined
}

const STALE_MS = 3 * 60_000
const COUNTDOWN_MS = 10 * 60_000

function minutesLeft(at: number, now: number): string {
  const minutes = Math.ceil((at - now) / 60_000)
  return minutes <= 1 ? 'in under a minute' : `in ${minutes} min`
}

/** Comparable form of a local path: forward slashes, no trailing slash, Windows drives case-folded. */
function normalPath(path: string): string {
  const slashed = path.replace(/\\/g, '/').replace(/\/+$/, '')
  return /^[A-Za-z]:/.test(slashed) ? slashed.toLowerCase() : slashed
}

/** Whether `dir` is the linked project's root or inside it. */
export function inProject(projectRoot: unknown, dir: string): boolean {
  if (typeof projectRoot !== 'string' || !projectRoot) return false
  const root = normalPath(projectRoot)
  const here = normalPath(dir)
  return here === root || here.startsWith(`${root}/`)
}

/** The workspace directory's name, as the CLI makes one path component of a workspace id. */
export function safeName(id: string): string {
  return id.replace(/[^A-Za-z0-9_-]/g, '_') || '_'
}

/** The session fields of a state.json, flat or under `session`. */
function sessionOf(state: Json | undefined): Json {
  const nested = state?.session
  return nested && typeof nested === 'object' ? { ...state, ...(nested as Json) } : (state ?? {})
}

/** The cloud part of the status line, or undefined when there is nothing to say. */
export function cloudLine(view: CloudView | undefined, now: number): string | undefined {
  const code = view?.login?.user_code
  if (typeof code === 'string' && code) return `☁ Cloud: sign in with code ${code}`
  const link = view?.link
  if (!link || link.enabled === false) return undefined
  if (link.state === 'pending') return '☁ Cloud: approve the upload in your browser'
  if (!view.state) return '☁ Cloud'
  const s = sessionOf(view.state)
  const what = typeof s.state === 'string' ? s.state : 'stopped'
  const idle = epochMs(s.idle_stop_at)
  const end = epochMs(s.expires_at)
  const fresh = Math.max(epochMs(view.state.updated_at) ?? 0, view.stateMtime ?? 0)
  if (what === 'ready' && idle !== undefined && now > idle && fresh < idle) {
    return '☁ Cloud: stopped when idle · the next command resumes it'
  }
  if (now - fresh > STALE_MS && !(idle !== undefined && idle > now)) return '☁ Cloud'
  switch (what) {
    case 'starting': {
      const stage = typeof s.stage === 'string' && s.stage ? ` (${s.stage})` : ''
      return `☁ Cloud: starting${stage}…`
    }
    case 'ready': {
      if (end !== undefined && end > now && end - now <= COUNTDOWN_MS) {
        return `☁ Cloud: ready · session ends ${minutesLeft(end, now)}`
      }
      if (idle !== undefined && idle > now && idle - now <= COUNTDOWN_MS) {
        return `☁ Cloud: ready · idle stop ${minutesLeft(idle, now)}`
      }
      return '☁ Cloud: ready'
    }
    case 'stopping':
      return '☁ Cloud: stopping…'
    case 'idle':
      return '☁ Cloud: stopped when idle · the next command resumes it'
    case 'error': {
      const err = (s.error as Json | undefined)?.code
      if (err === 'cloud_quota_exceeded') return '☁ Cloud: limit reached'
      if (err === 'cloud_auth_required') return '☁ Cloud: sign-in needed'
      return '☁ Cloud: error'
    }
    default:
      return '☁ Cloud: stopped'
  }
}

/** Whether the cloud line can still change on its own (so worth polling). */
function cloudLive(view: CloudView, line: string | undefined): boolean {
  if (!line || line === '☁ Cloud') return false
  if (view.login || view.link?.state === 'pending') return true
  const what = sessionOf(view.state).state
  return what === 'starting' || what === 'ready' || what === 'stopping'
}

/** Where the CLI keeps its cloud files: `$SHADOWDROID_HOME/cloud`, else `~/.shadowdroid/cloud`. */
// biome-ignore lint: `$` is the engine's
async function cloudDir($: any): Promise<string | undefined> {
  const custom = await $.env.get('SHADOWDROID_HOME')
  if (custom) return `${custom}/cloud`
  const home = (await $.env.get('HOME')) || (await $.env.get('USERPROFILE'))
  return home ? `${home}/.shadowdroid/cloud` : undefined
}

// biome-ignore lint: `$` is the engine's
async function readJson($: any, file: string): Promise<Json | undefined> {
  try {
    const value = JSON.parse(await $.fs.read(file))
    return value && typeof value === 'object' ? (value as Json) : undefined
  } catch {
    return undefined
  }
}

/** This session's folder, and where it really is when a link leads there. */
// biome-ignore lint: `$` is the engine's
async function sessionDirs($: any): Promise<string[]> {
  let here: string
  try {
    here = await $.session.root()
  } catch {
    here = await $.session.cwd()
  }
  try {
    const real = (await $.fs.stat(here, { resolve: true }))?.realPath
    if (typeof real === 'string' && real !== here) return [here, real]
  } catch {
    // as given
  }
  return [here]
}

/** What the CLI's files say about ShadowDroid Cloud for this session's project. */
// biome-ignore lint: `$` is the engine's
async function readCloud($: any, dirs: string[]): Promise<CloudView | undefined> {
  const dir = await cloudDir($)
  if (!dir) return undefined
  const view: CloudView = {}
  const login = await readJson($, `${dir}/login-pending.json`)
  const loginEnds = epochMs(login?.expires_at)
  if (login && typeof login.user_code === 'string' && (loginEnds === undefined || loginEnds > (await $.clock.now()))) {
    view.login = login
  }
  const links = (await readJson($, `${dir}/links.json`))?.links
  if (Array.isArray(links)) {
    for (const link of links as Json[]) {
      if (!dirs.some(d => inProject(link.root, d))) continue
      if (!view.link || String(link.root).length > String(view.link.root).length) view.link = link
    }
  }
  const id = view.link?.workspace_id
  if (typeof id === 'string' && id && view.link?.enabled !== false) {
    const file = `${dir}/${safeName(id)}/state.json`
    view.state = await readJson($, file)
    if (view.state) {
      try {
        view.stateMtime = (await $.fs.stat(file))?.mtimeMs
      } catch {
        // updated_at alone
      }
    }
  }
  return view.login || view.link ? view : undefined
}

/** The status line: the cloud part, then the device part. */
// biome-ignore lint: `$` is the engine's
function show($: any, session: Session): void {
  const parts = [session.cloudStatus, session.deviceStatus].filter(Boolean)
  $.ui.status(parts.length ? parts.join(' · ') : undefined)
}

// biome-ignore lint: `$` is the engine's
function setStatus($: any, session: Session, text: string): void {
  session.deviceStatus = text
  show($, session)
}

/** Each toast once per session: `key` names what it is about. */
// biome-ignore lint: `$` is the engine's
function toastOnce($: any, session: Session, key: string, text: string): void {
  session.toasted ??= new Set()
  if (session.toasted.has(key)) return
  session.toasted.add(key)
  $.ui.toast(text)
}

/** Re-read the cloud files and redraw what changed. */
// biome-ignore lint: `$` is the engine's
async function refreshCloud($: any, session: Session): Promise<void> {
  session.cloudDirs ??= await sessionDirs($)
  const before = sessionOf(session.cloud?.state).state
  const view = await readCloud($, session.cloudDirs).catch(() => undefined)
  session.cloud = view
  const now = await $.clock.now()
  const line = cloudLine(view, now)
  const login = view?.login
  if (login) {
    const url = login.verification_uri_complete ?? login.verification_uri
    toastOnce($, session, `login:${login.user_code}`, `ShadowDroid Cloud sign-in: open ${url} and approve the code ${login.user_code}`)
  }
  if (view?.link?.state === 'pending' && typeof view.link.approval_url === 'string') {
    toastOnce($, session, `link:${view.link.approval_url}`, `ShadowDroid Cloud: approve uploading this project at ${view.link.approval_url}`)
  }
  const after = sessionOf(view?.state)
  if (before === 'starting' && after.state === 'ready') $.ui.toast('ShadowDroid Cloud: the cloud device is ready')
  const end = epochMs(after.expires_at)
  if (after.state === 'ready' && end !== undefined && end > now && end - now <= COUNTDOWN_MS) {
    toastOnce(
      $,
      session,
      `end:${String(after.session ?? after.id ?? '')}`,
      `ShadowDroid Cloud: this session reaches its maximum length ${minutesLeft(end, now)}; the next command starts a new one if you have hours left`,
    )
  }
  if (line !== session.cloudStatus) {
    session.cloudStatus = line
    show($, session)
  }
  const live = view !== undefined && cloudLive(view, line)
  if (live && !session.cloudPoll) {
    try {
      session.cloudPoll = $.clock.every(5000, () => refreshCloud($, session).catch(() => undefined))
    } catch {
      // no timers here (a test host): the line updates after each command
    }
  } else if (!live && session.cloudPoll) {
    session.cloudPoll.cancel()
    session.cloudPoll = undefined
  }
}

/** What Claude is asked when the person runs `/device show`. */
export const SHOW_PROMPT = 'Show me the Android device in the viewer so I can see and use it.'

function label(device: Device | undefined): string {
  return device ? `📱 ${device.avd ?? device.serial}` : '📱'
}

function seconds(ms: unknown): string {
  return typeof ms === 'number' ? `${(ms / 1000).toFixed(1)} s` : ''
}

function buildOutcome(value: Json): string {
  switch (value.action) {
    case 'hot': return 'applied in place'
    case 'restart_activity': return 'applied, activity restarted'
    case 'reinstall': return 'reinstalled'
    case 'none': return 'nothing to apply'
    default: return String(value.action ?? 'built')
  }
}

/** Update the status line and raise toasts for one finished ShadowDroid call. */
// biome-ignore lint: `$` and the result are the engine's, typed by the engine
function react($: any, session: Session, tool: string, action: string | undefined, ran: any): void {
  if (!ran || ran.deny) return
  const text: string | undefined = typeof ran.text === 'string' ? ran.text : undefined
  const value = parse(text)

  if (ran.isError || value?.ok === false) {
    const message = text ?? ''
    if (message.includes('consent_required')) {
      $.ui.toast('Claude is waiting for you: click "Let Claude use it" in the device viewer')
      setStatus($, session, `${label(session.device)} · waiting for your OK in the viewer`)
    } else if (message.includes('device_reserved')) {
      $.ui.toast('Another Claude session or tool is using this device')
    } else {
      cloudErrorToast($, message)
      if (tool === 'build') setStatus($, session, `${label(session.device)} · build failed`)
    }
    return
  }
  if (!value) return

  if (typeof value.device === 'string' && (tool === 'boot' || action === 'attach' || !session.device)) {
    session.device = {
      serial: value.device,
      avd: typeof value.avd === 'string' ? value.avd : session.device?.avd,
      viewerUrl: typeof value.viewer_url === 'string' ? value.viewer_url : session.device?.viewerUrl,
    }
  }
  if (tool === 'control' && action === 'detach') {
    setStatus($, session, `${label(session.device)} · released`)
    session.device = undefined
    return
  }
  if (tool === 'boot' || (tool === 'control' && action === 'attach')) {
    setStatus($, session, `${label(session.device)} · attached`)
  }
  if (tool !== 'build') return

  const timings = (value.timings ?? {}) as Json
  setStatus($, session, `${label(session.device)} · ${buildOutcome(value)} ${seconds(timings.total_ms)}`.trim())
  const crash = value.crash as Json | undefined
  const composeError = value.compose_error as Json | undefined
  if (crash || value.app_alive === false) {
    const root = (crash?.root_cause ?? crash) as Json | undefined
    const what = root?.exception ? `${root.exception}${root.message ? `: ${root.message}` : ''}` : 'it stopped running'
    $.ui.toast(`App crashed after the build: ${what}`)
  } else if (composeError) {
    $.ui.toast(`The change throws while composing: ${composeError.exception}: ${composeError.message}`)
  } else if (Array.isArray(value.failed_requests) && value.failed_requests.length) {
    const first = value.failed_requests[0] as Json
    const what = first.status ? `${first.status}` : String(first.error ?? 'failed').slice(0, 60)
    const more = value.failed_requests.length > 1 ? ` (+${value.failed_requests.length - 1} more)` : ''
    $.ui.toast(`Request failed during the build: ${first.method ?? ''} ${String(first.url ?? '').slice(0, 80)} → ${what}${more}`)
  }
  // A reinstall is routine, not an error: the status line says it, and the
  // viewer's Builds tab says why.
}

/** A toast for the ShadowDroid Cloud errors only the person can resolve; true when one was raised. */
// biome-ignore lint: `$` is the engine's
function cloudErrorToast($: any, text: string): boolean {
  if (text.includes('cloud_quota_exceeded')) {
    $.ui.toast('ShadowDroid Cloud: a usage limit was reached; `shadowdroid cloud usage` shows your limits and when they reset')
    return true
  }
  if (text.includes('cloud_invite_required')) {
    $.ui.toast('ShadowDroid Cloud needs an invite during the alpha; accept yours on shadowdroid.dev')
    return true
  }
  return false
}

/** The viewer's base URL and token, from `http://127.0.0.1:PORT/#t=TOKEN`. */
function viewer(device: Device | undefined): { base: string; token: string } | undefined {
  const url = device?.viewerUrl
  if (!url) return undefined
  const [base, hash] = url.split('#')
  const token = /(?:^|&)t=([0-9a-f]+)/.exec(hash ?? '')?.[1]
  return token ? { base: base.replace(/\/$/, ''), token } : undefined
}

/** One call to the viewer's local server (`/api/annotations`, `/api/steps`). */
// biome-ignore lint: `$` is the engine's
async function viewerCall($: any, device: Device, path: string, op: string): Promise<Json | undefined> {
  const v = viewer(device)
  if (!v) return undefined
  const res = await $.http.fetch(`${v.base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-pane-token': v.token },
    body: JSON.stringify({ serial: device.serial, op }),
  })
  if (!res.ok) return undefined
  return parse(res.text)
}

// biome-ignore lint: `$` is the engine's
const notesCall = ($: any, device: Device, op: string) => viewerCall($, device, '/api/annotations', op)

/**
 * Send in the viewer is the person's own prompt. Submitted as theirs, Claude
 * Code shows it as typed, without the frame it puts around a message a
 * plugin sends; a host that won't take it as theirs gets it as the plugin's.
 */
async function sendAsUser($: any, text: string) {
  try {
    await $.prompt.submit({ text, asUser: true })
  } catch {
    await $.prompt.submit({ text })
  }
}
// biome-ignore lint: `$` is the engine's
const stepsCall = ($: any, device: Device, op: string) => viewerCall($, device, '/api/steps', op)

/** What it points at: the selector's text, else "area" / "element". */
function target(n: Json): string {
  const sel = (n.selector ?? {}) as Json
  const text = sel.text ?? sel.text_inside ?? sel.desc ?? sel.rid ?? (n.texts_inside as Json[] | undefined)?.[0]
  return typeof text === 'string' ? `"${text}"` : String(n.kind ?? 'element')
}

/** Pending annotations, one line each: what, where in the code, the ask. */
export function notesContext(items: Json[]): string {
  const lines = items.map(n => {
    const src = (n.source as Json[] | undefined)?.find(s => s.file)
    const at = src ? ` (${src.name}, ${src.file}${src.line ? `:${src.line}` : ''})` : ''
    // A View-based screen's file is its layout; this is the code using it.
    const code = (n.used_in as Json[] | undefined)?.[0]
    return `${n.n}. ${target(n)}${at}${code ? `, used in ${code}` : ''}: ${n.comment || '(no comment)'}`
  })
  return ['Device annotations (screens with numbered notes, selectors and source: `annotations` tool):', ...lines].join('\n')
}

/** Recorded steps, one line each, for the prompt "Make a test" submits. */
export function stepsPrompt(steps: Json[]): string {
  const lines = steps.map((s, i) => {
    const sel = (s.selector ?? {}) as Json
    const what = sel.text ?? sel.text_inside ?? sel.desc ?? sel.rid
    switch (s.action) {
      case 'tap':
      case 'long_press':
        return `${i + 1}. ${s.action === 'tap' ? 'tap' : 'long-press'} ${what ? `"${what}"` : `${s.x_dp},${s.y_dp} dp`}`
      case 'type':
        return `${i + 1}. type "${s.text}"`
      case 'key':
        return `${i + 1}. press ${s.name}`
      case 'swipe':
        return `${i + 1}. swipe ${JSON.stringify(s.from_dp)} → ${JSON.stringify(s.to_dp)} dp`
      default:
        return `${i + 1}. ${s.action}`
    }
  })
  return ['Make a UI test from my recorded steps (details: `recording` tool):', ...lines].join('\n')
}

export const register: Register = on => {
  const session: Session = {}

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'device',
      description: 'The Android device Claude is using; `/device show` opens the device viewer',
      argumentHint: '[show]',
    })
    try {
      await refreshCloud($, session)
    } catch {
      // display only
    }
    return next(e)
  })

  on('command.run', { command: 'device' }, async ($, e) => {
    const device = session.device
    const link = session.cloud?.link
    const region = sessionOf(session.cloud?.state).region
    const where = link
      ? [typeof link.name === 'string' ? `workspace ${link.name}` : '', typeof region === 'string' ? region : '']
          .filter(Boolean)
          .join(', ')
      : ''
    const cloudNote = session.cloudStatus ? `${session.cloudStatus}${where ? ` (${where})` : ''}` : undefined
    if (e.args.trim() === 'show') {
      if (device?.viewerUrl) return { text: `Viewer: ${device.viewerUrl}` }
      // Not from here: this hook holds the turn the prompt would wait on.
      try {
        $.clock.after(0, () => $.prompt.submit({ text: SHOW_PROMPT, asUser: true }))
      } catch {
        return { text: 'Ask Claude to show you the device.' }
      }
      return { text: 'Asking Claude to open the device viewer…' }
    }
    if (!device) {
      const none = 'No Android device in this session yet. Ask Claude to run the app; `/device show` opens the device viewer.'
      return { text: cloudNote ? `${cloudNote}\n${none}` : none }
    }
    const lines = cloudNote ? [cloudNote] : []
    lines.push(`${label(device)} (${device.serial})`)
    lines.push(device.viewerUrl ? `Viewer: ${device.viewerUrl}` : 'No viewer open: `/device show` opens one.')
    return { text: lines.join('\n') }
  })

  // Pending annotations ride along with the next prompt, whatever it says.
  on('prompt.submit', async ($, e, next) => {
    const device = session.device
    if (!device?.viewerUrl) return next(e)
    let items: Json[] = []
    try {
      items = ((await notesCall($, device, 'peek'))?.items as Json[] | undefined) ?? []
    } catch {
      // the viewer is gone; the prompt goes as typed
    }
    if (!items.length) return next(e)
    return next({ ...e, context: [...(e.context ?? []), notesContext(items)] })
  })
    // Display only: if this hook fails, the prompt goes as typed.
    .catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    const command = (e as unknown as Json).command
    // Any other `shadowdroid` command: it may sign in, link, start or stop a
    // cloud session, and a cloud limit is worth a toast.
    if (e.tool === 'Bash' && runsShadowdroid(command) && !runsApply(command)) {
      const ran = await next(e)
      try {
        if (typeof ran?.text === 'string') cloudErrorToast($, ran.text)
        await refreshCloud($, session)
      } catch {
        // display only
      }
      return ran
    }
    // Working through the CLI: `shadowdroid app apply` still updates the status line.
    if (e.tool === 'Bash' && runsApply(command)) {
      setStatus($, session, `${label(session.device)} · building…`)
      const ran = await next(e)
      try {
        const value = applyResult(typeof ran?.text === 'string' ? ran.text : undefined)
        if (value) react($, session, 'build', undefined, { text: JSON.stringify(value) })
        else {
          setStatus($, session, `${label(session.device)} · build failed`)
          if (typeof ran?.text === 'string') cloudErrorToast($, ran.text)
        }
        await refreshCloud($, session)
      } catch {
        // display only
      }
      return ran
    }
    if (!e.tool.startsWith(PREFIX)) return next(e)
    const tool = e.tool.slice(PREFIX.length)
    const args = e as unknown as Json
    const action = typeof args.action === 'string' ? args.action : undefined
    if (tool === 'build') setStatus($, session, `${label(session.device)} · building…`)
    const ran = await next(e)
    // Display only: nothing here may change or fail the tool's result.
    try {
      react($, session, tool, action, ran)
      // In cloud mode the tools run there too, and may start or wake the session.
      if (session.cloud) await refreshCloud($, session)
    } catch {
      // ignore
    }
    // While a device is attached, "Send to Claude" in the viewer submits a prompt.
    if (session.device?.viewerUrl && !session.poll) {
      try {
        session.poll = $.clock.every(1500, async () => {
          const device = session.device
          if (!device) return
          try {
            const notes = await notesCall($, device, 'list')
            if (notes?.send_requested === true) {
              await notesCall($, device, 'ack_send')
              // The prompt.submit hook attaches the notes themselves.
              await sendAsUser($, 'Address my device annotations.')
              return
            }
            const steps = await stepsCall($, device, 'list')
            if (steps?.send_requested === true && Array.isArray(steps.steps)) {
              await stepsCall($, device, 'ack_send')
              await sendAsUser($, stepsPrompt(steps.steps as Json[]))
            }
          } catch {
            // the viewer is gone or busy; try again next period
          }
        })
      } catch {
        // no timers here (a test host): Send in the viewer then needs a prompt
      }
    } else if (!session.device && session.poll) {
      session.poll.cancel()
      session.poll = undefined
    }
    return ran
  })
    // Display only: if this hook fails, the call runs (or its settled result replays) as is.
    .catch(($, e, next) => next(e))
}
