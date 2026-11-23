// Reusable Playwright <-> Olef session bus bridge (`docs/cloud-qa-design.md` §6.4).
//
// Usage from a journey's web helper:
//   import { withOlefPage, attachArtifact } from './olef-pw.mjs';
//   await withOlefPage('web-checkout', async (page) => {
//     await page.goto(url, { waitUntil: 'networkidle' });
//     await page.locator('#ledger-subscribe').click();
//     await page.locator('#purchase-success').waitFor({ timeout: 15000 });
//   });

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const OLEF_BIN = process.env.OLEF_BIN || 'olef';

export const CHROMIUM_ARGS = [
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--disable-quic',
  '--disable-features=DnsOverHttps',
];

function hasSession() {
  return Boolean(process.env.OLEF_SESSION_FILE || process.env.OLEF_SESSION);
}

export function attachArtifact(filePath, { label, kind = 'file' } = {}) {
  if (!hasSession() || !fs.existsSync(filePath)) return;
  const args = ['session', 'attach', filePath, '--kind', kind];
  if (label) args.push('--label', label);
  try {
    execFileSync(OLEF_BIN, args, { stdio: 'inherit' });
  } catch {
    // Never mask the primary journey step if attachment fails.
  }
}

export function failSession(msg, { fault = 'app', expected, actual, attachments = [] } = {}) {
  if (!hasSession()) {
    console.error(`FAIL [${process.env.OLEF_STEP || 'web'}]: ${msg}`);
    process.exit(1);
  }
  const args = ['session', 'fail', '--msg', msg, '--fault', fault];
  if (expected !== undefined) args.push('--expected', String(expected));
  if (actual !== undefined) args.push('--actual', String(actual));
  for (const file of attachments) {
    if (file && fs.existsSync(file)) {
      args.push('--attach', file);
    }
  }
  try {
    execFileSync(OLEF_BIN, args, { stdio: 'inherit' });
  } catch (err) {
    process.exit(err.status || 1);
  }
  process.exit(1);
}

/**
 * Launch Chromium with Olef Cloud-safe flags, record a Playwright trace, run
 * `fn(page)`, attach a final screenshot on success, or invoke `olef session fail`
 * with `web-failure.png` + `trace.zip` on failure.
 */
export async function withOlefPage(label, fn, { attachOnSuccess = true } = {}) {
  const { chromium } = await import('playwright');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'olef-pw-'));
  const browser = await chromium.launch({ headless: true, args: CHROMIUM_ARGS });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.tracing.start({ screenshots: true, snapshots: true });
  const page = await context.newPage();

  try {
    const result = await fn(page);
    if (attachOnSuccess) {
      const shot = path.join(tmpDir, `${label}.png`);
      await page.screenshot({ path: shot, fullPage: true });
      attachArtifact(shot, { label: `${label} (web)`, kind: 'screenshot' });
    }
    await context.tracing.stop();
    return result;
  } catch (err) {
    const attachments = [];
    try {
      const shot = path.join(tmpDir, `${label}-failure.png`);
      await page.screenshot({ path: shot, fullPage: true });
      attachments.push(shot);
    } catch {
      // Page may already be closed.
    }
    try {
      const trace = path.join(tmpDir, `${label}-trace.zip`);
      await context.tracing.stop({ path: trace });
      attachments.push(trace);
    } catch {
      // Best effort.
    }
    failSession(`Playwright step '${label}' failed: ${err?.message || err}`, {
      fault: err?.olefFault || 'app',
      expected: err?.olefExpected,
      actual: err?.olefActual,
      attachments,
    });
  } finally {
    await browser.close().catch(() => {});
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
