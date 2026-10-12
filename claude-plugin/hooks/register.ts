import type { Register } from 'claude-code'

// The ShadowDroid plugin's MCP tools: mcp__plugin_shadowdroid_shadowdroid__<tool>.
const PREFIX = 'mcp__plugin_shadowdroid_shadowdroid__'

type Device = { serial: string; avd?: string; viewerUrl?: string }
type Session = { device?: Device; poll?: { cancel: () => void } }
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
      $.ui.status(`${label(session.device)} · waiting for your OK in the viewer`)
    } else if (message.includes('device_reserved')) {
      $.ui.toast('Another Claude session or tool is using this device')
    } else if (tool === 'build') {
      $.ui.status(`${label(session.device)} · build failed`)
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
    $.ui.status(`${label(session.device)} · released`)
    session.device = undefined
    return
  }
  if (tool === 'boot' || (tool === 'control' && action === 'attach')) {
    $.ui.status(`${label(session.device)} · attached`)
  }
  if (tool !== 'build') return

  const timings = (value.timings ?? {}) as Json
  $.ui.status(`${label(session.device)} · ${buildOutcome(value)} ${seconds(timings.total_ms)}`.trim())
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
// biome-ignore lint: `$` is the engine's
const stepsCall = ($: any, device: Device, op: string) => viewerCall($, device, '/api/steps', op)

/** What it points at: the selector's text, else "area" / "element". */
function target(n: Json): string {
  const sel = (n.selector ?? {}) as Json
  const text = sel.text ?? sel.text_inside ?? sel.desc ?? sel.rid
  return typeof text === 'string' ? `"${text}"` : String(n.kind ?? 'element')
}

/** Pending annotations, one line each: what, where in the code, the ask. */
export function notesContext(items: Json[]): string {
  const lines = items.map(n => {
    const src = (n.source as Json[] | undefined)?.find(s => s.file)
    const at = src ? ` (${src.name}, ${src.file}:${src.line})` : ''
    return `${n.n}. ${target(n)}${at}: ${n.comment || '(no comment)'}`
  })
  return ['Device annotations (crops and selectors: `annotations` tool):', ...lines].join('\n')
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
    return next(e)
  })

  on('command.run', { command: 'device' }, async ($, e) => {
    const device = session.device
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
      return { text: 'No Android device in this session yet. Ask Claude to run the app; `/device show` opens the device viewer.' }
    }
    const lines = [`${label(device)} (${device.serial})`]
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
    // Working through the CLI: `shadowdroid app apply` still updates the status line.
    if (e.tool === 'Bash' && runsApply((e as unknown as Json).command)) {
      $.ui.status(`${label(session.device)} · building…`)
      const ran = await next(e)
      try {
        const value = applyResult(typeof ran?.text === 'string' ? ran.text : undefined)
        if (value) react($, session, 'build', undefined, { text: JSON.stringify(value) })
        else $.ui.status(`${label(session.device)} · build failed`)
      } catch {
        // display only
      }
      return ran
    }
    if (!e.tool.startsWith(PREFIX)) return next(e)
    const tool = e.tool.slice(PREFIX.length)
    const args = e as unknown as Json
    const action = typeof args.action === 'string' ? args.action : undefined
    if (tool === 'build') $.ui.status(`${label(session.device)} · building…`)
    const ran = await next(e)
    // Display only: nothing here may change or fail the tool's result.
    try {
      react($, session, tool, action, ran)
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
              await $.prompt.submit({ text: 'Address my device annotations.' })
              return
            }
            const steps = await stepsCall($, device, 'list')
            if (steps?.send_requested === true && Array.isArray(steps.steps)) {
              await stepsCall($, device, 'ack_send')
              await $.prompt.submit({ text: stepsPrompt(steps.steps as Json[]) })
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
