import { expect, test } from 'claude-code/testing'
import { notesContext, runsApply, stepsPrompt } from './register.ts'

const CONTROL = 'mcp__plugin_shadowdroid_shadowdroid__control'
const BUILD = 'mcp__plugin_shadowdroid_shadowdroid__build'

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
  expect(seen?.[0]).toBe('Device annotations (crops and selectors: `annotations` tool):\n1. "Fav button" (Text, MainScreen.kt:57): make it bigger')
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
    'Device annotations (crops and selectors: `annotations` tool):\n1. "Search by title" (SearchView, res/layout/include_search_bar.xml), used in search/Presenter.kt:68,101: make it purple',
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

test('shadowdroid app apply through Bash updates the status line', async ($, on) => {
  const { statuses, toasts } = record(on)
  on('tool.call', async () => ({
    result: {},
    text: [
      'Gradle: BUILD SUCCESSFUL',
      JSON.stringify({ cmd: 'app_apply', ok: true, type: 'action', action: 'reinstall', device: 'emulator-5554', app_alive: true, timings: { total_ms: 4300 } }),
    ].join('\n'),
  }))
  await $.tool.call({ tool: 'Bash', command: 'shadowdroid -q app apply --module app' })
  expect(statuses[0]).toBe('📱 · building…')
  expect(statuses[statuses.length - 1]).toBe('📱 emulator-5554 · reinstalled 4.3 s')
  expect(toasts).toEqual([])
  await $.tool.call({ tool: 'Bash', command: 'ls -la' })
  expect(statuses.length).toBe(2)
})

test('only shadowdroid app apply counts as a build', async () => {
  expect(runsApply('cd app && shadowdroid -d emulator-5554 app apply --at-least restart-activity')).toBe(true)
  expect(runsApply('shadowdroid app start com.example')).toBe(false)
  expect(runsApply('echo shadowdroid; ./gradlew app apply')).toBe(false)
})

test('/device show without a viewer asks Claude for one', async ($) => {
  // The submit itself runs from a timer, which a test host doesn't have.
  const shown = await $.command.run({ command: 'device', args: 'show' })
  expect(['Asking Claude to open the device viewer…', 'Ask Claude to show you the device.']).toContain(shown.text)
  const status = await $.command.run({ command: 'device', args: '' })
  expect(status.text).toContain('`/device show` opens the device viewer')
})
