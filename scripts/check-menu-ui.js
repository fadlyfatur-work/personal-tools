// Open the local site, then run: playwright-cli run-code --filename=scripts/check-menu-ui.js
/* eslint-disable @typescript-eslint/no-unused-expressions -- playwright-cli evaluates this file as a function expression. */
async page => {
  const origin = new URL(page.url()).origin;
  const results = [];
  const check = (condition, name) => { if (!condition) throw new Error(name); results.push(name); };
  const tools = [
    ['Katalog AHSP 2026', '/ahsp'], ['Fintrack', '/fintrack'], ['Paste Text', '/paste'],
    ['Nominatif Perjalanan Dinas', '/nominatif'], ['Time Mark', '/timemark'],
  ];
  const errors = [];
  page.on('pageerror', error => { if (new URL(page.url()).pathname === '/menu') errors.push(error.message); });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'no-preference' });
  await page.goto(origin);
  const homePalette = await page.locator('main').evaluate(e => ['--canvas', '--ink', '--accent', '--line'].map(key => getComputedStyle(e).getPropertyValue(key)));
  await page.getByRole('navigation', { name: 'Navigasi utama', exact: true }).getByRole('link', { name: 'Menu aplikasi', exact: true }).click();
  await page.waitForURL(origin + '/menu');
  check(await page.getByRole('heading', { level: 1 }).textContent() === 'Personal Tools', 'Menu bisa dibuka dari portfolio');
  check(await page.locator('#main .heroActions').count() === 0 && await page.getByText('Lihat aplikasi', { exact: true }).count() === 0, 'Hero dan langkah pengantar telah dihapus');
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
    await page.setViewportSize(viewport);
    check(await page.locator('#applications li').evaluateAll(elements => elements.every(e => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })), 'Kelima aplikasi terlihat tanpa scroll ' + viewport.width + 'x' + viewport.height);
    check(await page.locator('#applications li').first().evaluate(e => e.getBoundingClientRect().top < 170), 'Daftar dimulai dekat bagian atas ' + viewport.width);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  const menuPalette = await page.locator('main').evaluate(e => ['--canvas', '--ink', '--accent', '--line'].map(key => getComputedStyle(e).getPropertyValue(key)));
  check(JSON.stringify(homePalette) === JSON.stringify(menuPalette), 'Palet identik dengan portfolio');
  check(await page.locator('#applications li').count() === 5, 'Lima aplikasi tetap tersedia');
  check(await page.getByRole('navigation', { name: 'Navigasi utama', exact: true }).locator('[aria-current="page"]').textContent() === 'Menu aplikasi', 'Navigasi menandai halaman aktif');
  check(await page.getByRole('navigation', { name: 'Navigasi utama', exact: true }).getByRole('link', { name: 'Tentang', exact: true }).getAttribute('href') === '/#about', 'Navigasi Tentang menuju portfolio');
  for (const [name, href] of tools) {
    const card = page.getByRole('link', { name, exact: true });
    check(await card.getAttribute('href') === href, 'Tujuan ' + name + ' dipertahankan');
    await card.click();
    await page.waitForURL(url => url.pathname.startsWith(href));
    check(new URL(page.url()).pathname.startsWith(href), 'Aplikasi ' + name + ' bisa dibuka');
    await page.goto(origin + '/menu');
  }
  const last = page.locator('#applications li').last();
  await page.setViewportSize({ width: 1440, height: 280 });
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#applications li:last-child[data-reveal-pending]'));
  await last.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('#applications li:last-child').getAnimations().length > 0);
  const frames = await last.evaluate(e => e.getAnimations()[0].effect.getKeyframes());
  check(frames[0].opacity === '0' && frames.at(-1).opacity === '1' && frames[0].filter === 'blur(4px)' && frames[0].transform.includes('0.975'), 'Menu memakai animasi opacity, blur, perpindahan dan skala yang sama');
  await page.waitForFunction(() => !document.querySelector('#applications li:last-child').getAnimations().length);
  check(await last.evaluate(e => getComputedStyle(e).opacity === '1' && getComputedStyle(e).filter === 'none'), 'Konten kembali tajam setelah animasi');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => !document.querySelector('[data-reveal-pending]'));
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const colorScheme of ['dark', 'light']) {
      await page.emulateMedia({ colorScheme });
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Tanpa overflow ' + width + ' ' + colorScheme);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  check(await page.locator('[data-reveal-pending]').count() === 0, 'Reduced motion menampilkan seluruh menu');
  const trigger = page.locator('summary[aria-label="Menu navigasi"]');
  await trigger.click();
  await page.keyboard.press('Escape');
  check(!await page.getByRole('navigation', { name: 'Navigasi ponsel', exact: true }).isVisible(), 'Escape menutup navigasi ponsel');
  check(await trigger.evaluate(e => e === document.activeElement), 'Fokus kembali ke pemicu menu');
  await page.getByRole('link', { name: 'Time Mark', exact: true }).focus();
  check(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle !== 'none'), 'Fokus pada aplikasi terlihat');
  const noScript = await page.context().browser().newContext({ javaScriptEnabled: false });
  const staticPage = await noScript.newPage();
  await staticPage.goto(origin + '/menu');
  check(await staticPage.locator('#applications li').count() === 5 && await staticPage.locator('[data-reveal-pending]').count() === 0, 'Menu tetap tersedia tanpa JavaScript');
  await noScript.close();
  await page.getByRole('link', { name: 'Fdly.dev, Beranda', exact: true }).click();
  await page.waitForURL(origin + '/');
  check(await page.getByRole('heading', { level: 1 }).textContent() === 'Dari ide menjadiaplikasi yang berjalan.', 'Kembali ke portfolio berfungsi');
  check(errors.length === 0, 'Tanpa error JavaScript pada menu: ' + errors.join('; '));
  return { passed: results.length, results };
}
