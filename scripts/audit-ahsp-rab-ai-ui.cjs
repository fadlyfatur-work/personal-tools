/* eslint-disable @typescript-eslint/no-require-imports -- Read-only browser layout audit; no OCR, profile save or matching calls. */
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const { chromium } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))
const { setMode } = require('./ahsp-appearance-browser.cjs')
const root = '.next/rab-ai-ui-audit'
fs.mkdirSync(root, { recursive: true })
async function main() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const unexpected = []
  await page.route('**/api/ahsp/rab/ai/run', route => { unexpected.push('AI call'); return route.abort() })
  await page.route('**/api/ahsp/rab/ai/profiles', route => { unexpected.push('Profiles request'); return route.abort() })
  try {
    await page.goto('http://localhost:3000/ahsp/rab')
    await page.getByRole('heading', { name: 'Pembacaan PDF & gambar', exact: true }).waitFor()
    for (const width of [1440, 768, 390, 320]) for (const mode of ['light', 'dark']) {
      await page.setViewportSize({ width, height: 1000 })
      await setMode(page, mode)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Page reflows without horizontal overflow')
      await page.screenshot({ path: `${root}/rab-ai-${width}-${mode}.png`, fullPage: true, animations: 'disabled' })
      await page.getByRole('button', { name: 'Pengaturan AI', exact: true }).click()
      const dialog = page.getByRole('dialog', { name: 'Pengaturan API AI', exact: true })
      const box = await dialog.boundingBox()
      assert.ok(box.x >= 0 && box.x + box.width <= width + 1 && box.y >= 0 && box.y + box.height <= 1001, 'Settings dialog fits viewport')
      assert.ok(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1), 'JSON editors do not widen the dialog')
      await dialog.screenshot({ path: `${root}/settings-ocr-${width}-${mode}.png`, animations: 'disabled' })
      await dialog.getByRole('button', { name: 'Teks → JSON pekerjaan', exact: true }).click()
      await dialog.getByLabel('Pemetaan field JSON', { exact: true }).scrollIntoViewIfNeeded()
      await dialog.screenshot({ path: `${root}/settings-json-${width}-${mode}.png`, animations: 'disabled' })
      await page.keyboard.press('Escape')
      assert.equal(await dialog.isVisible(), false, 'Settings panel dismisses with Escape')
      const activity = page.locator('details').filter({ has: page.locator('summary').getByText('Aktivitas API AI', { exact: false }) }).first()
      if (await activity.getAttribute('open') === null) await activity.locator(':scope>summary').click()
      await page.screenshot({ path: `${root}/activity-empty-${width}-${mode}.png`, fullPage: true, animations: 'disabled' })
    }
    assert.deepEqual(unexpected, [], 'UI audit never runs AI or profile operations')
    console.log('UI/UX audit only: initial page, settings OCR/JSON, empty activity, Escape, viewport 320–1440px and light/dark. No OCR/API save/reconciliation functionality exercised.')
  } catch (error) { await page.screenshot({ path: `${root}/audit-state.png`, fullPage: true }); throw error } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
