async function setMode(page, mode) {
  if (mode === 'system' || await page.locator('main').getAttribute('data-theme') === 'system') {
    await page.getByRole('button', { name: /^Pilih tema:/ }).click()
    await page.getByLabel('Ikuti mode perangkat', { exact: true }).setChecked(mode === 'system')
    await page.keyboard.press('Escape')
  }
  if (mode !== 'system') {
    const button = page.getByRole('button', { name: mode === 'dark' ? 'Aktifkan mode gelap' : 'Aktifkan mode terang', exact: true })
    if (await button.count()) await button.click()
  }
}

async function setPalette(page, palette) {
  await page.getByRole('button', { name: /^Pilih tema:/ }).click()
  await page.getByRole('dialog', { name: 'Pilihan tema', exact: true }).getByRole('button', { name: { 'swiss-red': 'Swiss Red', 'pastel-dreams': 'Pastel Dreams', 'indigo-frost': 'Indigo Frost' }[palette], exact: true }).click()
}

module.exports = { setMode, setPalette }
