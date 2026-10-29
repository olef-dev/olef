import { expect, mock, test } from 'claude-code/testing'
import { cloudLine, inProject, notesContext, runsApply, runsOlef, safeName, stepsPrompt } from './register.ts'

const CONTROL = 'mcp__plugin_olef_olef__control'
const BUILD = 'mcp__plugin_olef_olef__build'

// biome-ignore lint: test doubles for the engine's ui events
function record(on: any) {
  const statuses: (string | undefined)[] = []
  const toasts: string[] = []
  on('ui.status', async ($: unknown, e: { text: string | undefined }, next: (e: unknown) => unknown) => {
    statuses.push(e.text)
    return next(e)
  })
  on('ui.toast', async ($: unknown, e: { text: string }, next: (e: unknown) => unknown) => {
    toasts.push(e.text)
    return next(e)
  })
  return { statuses, toasts }
}

test('attach and a build that crashed reach the status line and a toast', async ($, on) => {
  const { statuses, toasts } = record(on)
  // The test's hook sits beneath the plugin and stands for the MCP server.
  on('tool.call', async ($, e) => {
    if ((e as Record<string, unknown>).action === 'attach') {
      return {
        result: {},
        text: JSON.stringify({ ok: true, device: 'emulator-5554', avd: 'Pixel_9', viewer_url: 'http://127.0.0.1:1/#t=x' }),
      }
    }
    return {
      result: {},
      text: JSON.stringify({
        action: 'hot',
        device: 'emulator-5554',
        timings: { total_ms: 1400 },
        app_alive: false,
        crash: { exception: 'java.lang.RuntimeException', root_cause: { exception: 'java.lang.IllegalStateException', message: 'boom' } },
      }),
    }
  })
  await $.tool.call({ tool: CONTROL, action: 'attach' })
  expect(statuses).toContain('📱 Pixel_9 · attached')
  await $.tool.call({ tool: BUILD })
  expect(statuses).toContain('📱 Pixel_9 · building…')
  expect(statuses[statuses.length - 1]).toBe('📱 Pixel_9 · applied in place 1.4 s')
  expect(toasts[toasts.length - 1]).toBe('App crashed after the build: java.lang.IllegalStateException: boom')
})

test('a consent refusal tells the person to allow the device', async ($, on) => {
  const { statuses, toasts } = record(on)
  on('tool.call', async () => ({
    result: {},
    isError: true,
    text: 'consent_required: the user has not allowed Claude to control Pixel_9 yet.',
  }))
  await $.tool.call({ tool: CONTROL, action: 'screenshot' })
  expect(toasts).toContain('Claude is waiting for you: click "Let Claude use it" in the device viewer')
  expect(statuses[statuses.length - 1]).toBe('📱 · waiting for your OK in the viewer')
})

test('a build with a failed request says which', async ($, on) => {
  const { toasts } = record(on)
  on('tool.call', async () => ({
    result: {},
    text: JSON.stringify({
      action: 'hot',
      app_alive: true,
      timings: { total_ms: 900 },
      failed_requests: [{ method: 'POST', url: 'https://api.example.com/login', status: 401, ok: false }],
    }),
  }))
  await $.tool.call({ tool: BUILD })
  expect(toasts[toasts.length - 1]).toBe('Request failed during the build: POST https://api.example.com/login → 401')
})

test('pending annotations ride along with the next prompt', async ($, on) => {
  on('tool.call', async () => ({
    result: {},
    text: JSON.stringify({ ok: true, device: 'emulator-5554', avd: 'Pixel_9', viewer_url: 'http://127.0.0.1:4321/#t=abc123' }),
  }))
  const asked: { url: string; body?: string; token?: string }[] = []
  on('http.fetch', async ($, e) => {
    asked.push({ url: e.url, body: e.init?.body, token: e.init?.headers?.['x-pane-token'] })
    const op = JSON.parse(e.init?.body ?? '{}').op
    const items =
      op === 'peek'
        ? [{ n: 1, kind: 'element', comment: 'make it bigger', selector: { text_inside: 'Fav button' }, source: [{ name: 'Text', file: 'MainScreen.kt', line: 57 }] }]
        : []
    return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ ok: true, items, send_requested: false }) } }
  })
  let seen: readonly string[] | undefined
  on('prompt.submit', async ($, e) => {
    seen = e.context
    return { text: e.text, context: e.context }
  })
  await $.tool.call({ tool: CONTROL, action: 'attach' })
  await $.prompt.submit({ text: 'fix these' })
  expect(asked[0].url).toBe('http://127.0.0.1:4321/api/annotations')
  expect(asked[0].token).toBe('abc123')
  expect(seen?.[0]).toBe('Device annotations (screens with numbered notes, selectors and source: `annotations` tool):\n1. "Fav button" (Text, MainScreen.kt:57): make it bigger')
})

test('a note on a View-based screen names its layout and the code using it', async () => {
  expect(
    notesContext([
      {
        n: 1,
        kind: 'area',
        comment: 'make it purple',
        texts_inside: ['Search by title'],
        source: [{ name: 'SearchView', id: 'searchView', layout: 'include_search_bar', file: 'res/layout/include_search_bar.xml' }],
        used_in: ['search/Presenter.kt:68,101'],
      },
    ]),
  ).toBe(
    'Device annotations (screens with numbered notes, selectors and source: `annotations` tool):\n1. "Search by title" (SearchView, res/layout/include_search_bar.xml), used in search/Presenter.kt:68,101: make it purple',
  )
})

test('recorded steps read as a short list', async () => {
  expect(
    stepsPrompt([
      { action: 'tap', selector: { text_inside: 'Open dialog' } },
      { action: 'type', text: 'hello' },
      { action: 'key', name: 'BACK' },
      { action: 'tap', x_dp: 10, y_dp: 20 },
    ]),
  ).toBe('Make a UI test from my recorded steps (details: `recording` tool):\n1. tap "Open dialog"\n2. type "hello"\n3. press BACK\n4. tap 10,20 dp')
})

test('other tools pass through untouched', async ($, on) => {
  const { statuses, toasts } = record(on)
  on('tool.call', async () => ({ result: {}, text: '{"action":"hot"}' }))
  await $.tool.call({ tool: 'mcp__other__thing' })
  expect(statuses).toEqual([])
  expect(toasts).toEqual([])
})

test('olef app apply through Bash updates the status line', async ($, on) => {
  const { statuses, toasts } = record(on)
  on('tool.call', async () => ({
    result: {},
    text: [
      'Gradle: BUILD SUCCESSFUL',
      JSON.stringify({ cmd: 'app_apply', ok: true, type: 'action', action: 'reinstall', device: 'emulator-5554', app_alive: true, timings: { total_ms: 4300 } }),
    ].join('\n'),
  }))
  await $.tool.call({ tool: 'Bash', command: 'olef -q app apply --module app' })
  expect(statuses[0]).toBe('📱 · building…')
  expect(statuses[statuses.length - 1]).toBe('📱 emulator-5554 · reinstalled 4.3 s')
  expect(toasts).toEqual([])
  await $.tool.call({ tool: 'Bash', command: 'ls -la' })
  expect(statuses.length).toBe(2)
})

test('only olef app apply counts as a build', async () => {
  expect(runsApply('cd app && olef -d emulator-5554 app apply --at-least restart-activity')).toBe(true)
  expect(runsApply('olef app start com.example')).toBe(false)
  expect(runsApply('echo olef; ./gradlew app apply')).toBe(false)
})

test('/device show without a viewer asks Claude for one', async ($) => {
  // The submit itself runs from a timer, which a test host doesn't have.
  const shown = await $.command.run({ command: 'device', args: 'show' })
  expect(['Asking Claude to open the device viewer…', 'Ask Claude to show you the device.']).toContain(shown.text)
  const status = await $.command.run({ command: 'device', args: '' })
  expect(status.text).toContain('`/device show` opens the device viewer')
})

// Olef Cloud: the CLI's files under ~/.olef/cloud/.
const NOW = Date.parse('2026-10-18T20:00:00Z')
const min = (n: number) => new Date(NOW + n * 60_000).toISOString()
const LINK = { root: '/work/notes', workspace_id: 'ws_1', name: 'notes', enabled: true, state: 'approved' }
// biome-ignore lint: loose test values
const ready = (extra: Record<string, unknown> = {}): any => ({ link: LINK, state: { workspace: 'ws_1', session: 's1', state: 'ready', region: 'us-west1', updated_at: min(0), ...extra } })

test('the cloud line says starting, ready, the idle-stop countdown and stops', async () => {
  expect(cloudLine(ready({ state: 'starting', stage: 'booting the emulator' }), NOW)).toBe('☁ Cloud: starting (booting the emulator)…')
  expect(cloudLine(ready({ state: 'starting' }), NOW)).toBe('☁ Cloud: starting…')
  expect(cloudLine(ready({ idle_stop_at: min(15) }), NOW)).toBe('☁ Cloud: ready')
  expect(cloudLine(ready({ idle_stop_at: min(4) }), NOW)).toBe('☁ Cloud: ready · idle stop in 4 min')
  expect(cloudLine(ready({ idle_stop_at: NOW + 20_000 }), NOW)).toBe('☁ Cloud: ready · idle stop in under a minute')
  expect(cloudLine(ready({ idle_stop_at: min(4), expires_at: min(8) }), NOW)).toBe('☁ Cloud: ready · session ends in 8 min')
  expect(cloudLine(ready({ state: 'stopping' }), NOW)).toBe('☁ Cloud: stopping…')
  expect(cloudLine(ready({ state: 'idle' }), NOW)).toBe('☁ Cloud: stopped when idle · the next command resumes it')
  expect(cloudLine(ready({ state: 'stopped', session: null }), NOW)).toBe('☁ Cloud: stopped')
  expect(cloudLine(ready({ state: 'error', error: { code: 'cloud_quota_exceeded' } }), NOW)).toBe('☁ Cloud: limit reached')
  expect(cloudLine(ready({ updated_at: NOW / 1000 }), NOW)).toBe('☁ Cloud: ready')
  // The session nested under `session` reads the same.
  expect(cloudLine({ link: LINK, state: { updated_at: min(0), session: { id: 's1', state: 'ready', idle_stop_at: min(3) } } }, NOW)).toBe('☁ Cloud: ready · idle stop in 3 min')
})

test('sign-in and upload approvals come first; nothing outside cloud mode', async () => {
  expect(cloudLine({ login: { user_code: 'WXYZ-1234' } }, NOW)).toBe('☁ Cloud: sign in with code WXYZ-1234')
  expect(cloudLine({ link: { ...LINK, state: 'pending' } }, NOW)).toBe('☁ Cloud: approve the upload in your browser')
  expect(cloudLine({ link: LINK }, NOW)).toBe('☁ Cloud')
  expect(cloudLine(undefined, NOW)).toBe(undefined)
  expect(cloudLine({ link: { ...LINK, enabled: false }, state: ready().state }, NOW)).toBe(undefined)
})

test('a daemon that is gone: a bare line, or idle-stopped once the idle stop passed', async () => {
  expect(cloudLine(ready({ updated_at: min(-10) }), NOW)).toBe('☁ Cloud')
  expect(cloudLine(ready({ updated_at: 'garbage' }), NOW)).toBe('☁ Cloud')
  expect(cloudLine({ ...ready({ updated_at: undefined }), stateMtime: NOW - 1000 }, NOW)).toBe('☁ Cloud: ready')
  expect(cloudLine(ready({ updated_at: min(-10), idle_stop_at: min(5) }), NOW)).toBe('☁ Cloud: ready · idle stop in 5 min')
  expect(cloudLine(ready({ updated_at: min(-20), idle_stop_at: min(-5) }), NOW)).toBe('☁ Cloud: stopped when idle · the next command resumes it')
})

test('a linked project covers its own folders only', async () => {
  expect(inProject('/work/notes', '/work/notes')).toBe(true)
  expect(inProject('/work/notes/', '/work/notes/app')).toBe(true)
  expect(inProject('/work/notes', '/work/notes2')).toBe(false)
  expect(inProject('C:\\Work\\Notes', 'c:/work/notes/app')).toBe(true)
  expect(inProject(undefined, '/work/notes')).toBe(false)
  expect(safeName('ws:1/x')).toBe('ws_1_x')
  expect(runsOlef('cd app && olef cloud link')).toBe(true)
  expect(runsOlef('ls shadow')).toBe(false)
})

const CLOUD = '/home/me/.olef/cloud'
/** A machine with the CLI's cloud files: `files` maps a path to its text. */
// biome-ignore lint: test doubles for the engine's nouns
function cloudMachine(on: any, files: Record<string, string>, root = '/work/notes') {
  mock.env(on, { HOME: '/home/me' })
  const clock = mock.clock(on, { now: NOW })
  on('session.root', async () => ({ value: root }))
  on('session.start', async ($: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('command.register', async () => ({ value: { command: 'device' } }))
  const missing = () => Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
  on('fs.read', async ($: unknown, e: { path: string }) => {
    if (!(e.path in files)) throw missing()
    return { value: files[e.path] }
  })
  on('fs.stat', async ($: unknown, e: { path: string; resolve: boolean }) => {
    if (e.path === '/tmp/notes') return { value: { kind: 'dir', size: 0, mtimeMs: 0, isLink: true, realPath: '/work/notes' } }
    if (!(e.path in files)) throw missing()
    return { value: { kind: 'file', size: files[e.path]!.length, mtimeMs: 0, isLink: false } }
  })
  return clock
}
const links = (link: Record<string, unknown> = LINK) => JSON.stringify({ version: 1, links: [link, { ...LINK, root: '/work/other', workspace_id: 'ws_2' }] })
const state = (extra: Record<string, unknown>) => JSON.stringify({ workspace: 'ws_1', session: 's1', region: 'us-west1', updated_at: min(0), ...extra })

test('a linked project shows its cloud session beside the device', async ($, on) => {
  const { statuses } = record(on)
  cloudMachine(on, {
    [`${CLOUD}/links.json`]: links(),
    [`${CLOUD}/ws_1/state.json`]: state({ state: 'ready', idle_stop_at: min(4) }),
    [`${CLOUD}/ws_2/state.json`]: state({ state: 'starting' }),
  })
  on('tool.call', async () => ({
    result: {},
    text: JSON.stringify({ ok: true, device: 'emulator-5554', avd: 'Pixel_9', viewer_url: 'http://127.0.0.1:1/#t=x' }),
  }))
  await $.session.start({ cwd: '/work/notes', surface: 'terminal', isInteractive: true })
  expect(statuses[statuses.length - 1]).toBe('☁ Cloud: ready · idle stop in 4 min')
  await $.tool.call({ tool: CONTROL, action: 'attach' })
  expect(statuses[statuses.length - 1]).toBe('☁ Cloud: ready · idle stop in 4 min · 📱 Pixel_9 · attached')
  const shown = await $.command.run({ command: 'device', args: '' })
  expect(shown.text).toBe('☁ Cloud: ready · idle stop in 4 min (workspace notes, us-west1)\n📱 Pixel_9 (emulator-5554)\nViewer: http://127.0.0.1:1/#t=x')
})

test('a project opened through a symlink still finds its link', async ($, on) => {
  const { statuses } = record(on)
  cloudMachine(on, { [`${CLOUD}/links.json`]: links(), [`${CLOUD}/ws_1/state.json`]: state({ state: 'ready' }) }, '/tmp/notes')
  await $.session.start({ cwd: '/tmp/notes', surface: 'terminal', isInteractive: true })
  expect(statuses[statuses.length - 1]).toBe('☁ Cloud: ready')
})

test('a starting session is followed until it is ready, then idle', async ($, on) => {
  const { statuses, toasts } = record(on)
  const files = { [`${CLOUD}/links.json`]: links(), [`${CLOUD}/ws_1/state.json`]: state({ state: 'starting', stage: 'booting the VM' }) }
  const clock = cloudMachine(on, files)
  await $.session.start({ cwd: '/work/notes', surface: 'terminal', isInteractive: true })
  expect(statuses[statuses.length - 1]).toBe('☁ Cloud: starting (booting the VM)…')
  files[`${CLOUD}/ws_1/state.json`] = state({ state: 'ready', idle_stop_at: min(15), updated_at: min(1) })
  await clock.advance(5000)
  expect(statuses[statuses.length - 1]).toBe('☁ Cloud: ready')
  expect(toasts).toContain('Olef Cloud: the cloud device is ready')
  files[`${CLOUD}/ws_1/state.json`] = state({ state: 'ready', expires_at: min(9), updated_at: min(1) })
  await clock.advance(5000)
  expect(statuses[statuses.length - 1]).toBe('☁ Cloud: ready · session ends in 9 min')
  await clock.advance(5000)
  expect(toasts.filter(t => t.includes('maximum length')).length).toBe(1)
  files[`${CLOUD}/ws_1/state.json`] = state({ state: 'idle', updated_at: min(1) })
  await clock.advance(5000)
  expect(statuses[statuses.length - 1]).toBe('☁ Cloud: stopped when idle · the next command resumes it')
})

test('onboarding: the sign-in code, the upload approval, then the session', async ($, on) => {
  const { statuses, toasts } = record(on)
  const files: Record<string, string> = {}
  cloudMachine(on, files)
  let reply = '{}'
  on('tool.call', async () => ({ result: {}, text: reply }))
  await $.session.start({ cwd: '/work/notes', surface: 'terminal', isInteractive: true })
  expect(statuses).toEqual([])

  files[`${CLOUD}/login-pending.json`] = JSON.stringify({
    user_code: 'WXYZ-1234',
    verification_uri: 'https://app.shadowdroid.dev/activate',
    verification_uri_complete: 'https://app.shadowdroid.dev/activate?code=WXYZ-1234',
    expires_at: NOW / 1000 + 600,
  })
  await $.tool.call({ tool: 'Bash', command: 'olef cloud login --no-wait --json' })
  expect(statuses[statuses.length - 1]).toBe('☁ Cloud: sign in with code WXYZ-1234')
  expect(toasts[toasts.length - 1]).toBe('Olef Cloud sign-in: open https://app.shadowdroid.dev/activate?code=WXYZ-1234 and approve the code WXYZ-1234')

  delete files[`${CLOUD}/login-pending.json`]
  files[`${CLOUD}/links.json`] = links({ ...LINK, state: 'pending', approval_url: 'https://app.shadowdroid.dev/link/lr_1' })
  await $.tool.call({ tool: 'Bash', command: 'olef cloud link --json' })
  expect(statuses[statuses.length - 1]).toBe('☁ Cloud: approve the upload in your browser')
  expect(toasts[toasts.length - 1]).toBe('Olef Cloud: approve uploading this project at https://app.shadowdroid.dev/link/lr_1')

  files[`${CLOUD}/links.json`] = links()
  files[`${CLOUD}/ws_1/state.json`] = state({ state: 'starting' })
  await $.tool.call({ tool: 'Bash', command: 'olef app apply' })
  expect(statuses[statuses.length - 1]).toBe('☁ Cloud: starting… · 📱 · build failed')

  reply = JSON.stringify({ ok: false, code: 'cloud_quota_exceeded', msg: 'session-hours used up', detail: { limit: 'session_hours' } })
  await $.tool.call({ tool: 'Bash', command: 'olef ui dump' })
  expect(toasts[toasts.length - 1]).toBe('Olef Cloud: a usage limit was reached; `olef cloud usage` shows your limits and when they reset')
})

test('cloud mode off for this project leaves the status line alone', async ($, on) => {
  const { statuses } = record(on)
  cloudMachine(on, { [`${CLOUD}/links.json`]: links({ ...LINK, enabled: false }), [`${CLOUD}/ws_1/state.json`]: state({ state: 'ready' }) })
  await $.session.start({ cwd: '/work/notes', surface: 'terminal', isInteractive: true })
  expect(statuses).toEqual([])
})
