// Open the local site, then run: playwright-cli run-code --filename=scripts/check-portfolio-motion.js
/* eslint-disable @typescript-eslint/no-unused-expressions -- playwright-cli evaluates this file as a function expression. */
async page => {
  const origin = new URL(page.url()).origin;
  const results = [];
  const check = (condition, name) => { if (!condition) throw new Error(name); results.push(name); };
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'dark' });
  await page.goto(origin);
  await page.waitForFunction(() => document.querySelector('#about [data-reveal-pending]'));
  check(await page.locator('h1').evaluate(e => getComputedStyle(e).opacity === '1' && !e.closest('[data-reveal-pending]')), 'Hero tetap terlihat saat halaman dibuka');
  check(await page.locator('main img').evaluate(e => !e.closest('[data-reveal-pending]')), 'Screenshot utama tidak ditunda animasi');
  const about = page.locator('#about [data-scroll-reveal]').first();
  const pending = await about.evaluate(e => { const s = getComputedStyle(e); return { opacity: s.opacity, filter: s.filter, transform: s.transform }; });
  check(pending.opacity === '0' && pending.filter === 'blur(6px)' && pending.transform.includes('24'), 'Keadaan awal memakai opacity, pergeseran, dan blur');
  await about.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('#about [data-scroll-reveal]').getAnimations().length > 0);
  const frames = await about.evaluate(e => e.getAnimations()[0].effect.getKeyframes());
  check(frames[0].opacity === '0' && frames.at(-1).opacity === '1', 'Opacity dianimasikan menuju terlihat');
  check(frames[0].filter === 'blur(6px)' && frames.at(-1).filter === 'blur(0px)', 'Blur dianimasikan menuju tajam');
  await page.waitForFunction(() => { const e = document.querySelector('#about [data-scroll-reveal]'); return !e.hasAttribute('data-reveal-pending') && !e.getAnimations().length; });
  check(await about.evaluate(e => { const s = getComputedStyle(e); return s.opacity === '1' && s.transform === 'none' && s.filter === 'none'; }), 'Keadaan akhir bersih tanpa transform atau blur tersisa');
  await page.evaluate(() => window.scrollTo(0, 0));
  await about.scrollIntoViewIfNeeded();
  check(await about.evaluate(e => e.getAnimations().length === 0), 'Animasi tidak diputar ulang saat kembali ke bagian yang sudah dilihat');
  await page.goto(origin);
  await page.waitForFunction(() => document.querySelector('[aria-labelledby="skills-title"] [data-reveal-pending]'));
  const skills = page.locator('[data-scroll-reveal="scale"]').last();
  await skills.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('[aria-labelledby="skills-title"] [data-scroll-reveal="scale"]').getAnimations().length > 0);
  const scaleFrames = await skills.evaluate(e => e.getAnimations()[0].effect.getKeyframes());
  check(scaleFrames[0].transform.includes('0.975'), 'Skala awal 0.975 digunakan pada showcase teknologi');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => !document.querySelector('[data-reveal-pending]') && !document.querySelector('main').getAnimations({ subtree: true }).length);
  check(true, 'Perubahan reduced motion langsung menghentikan animasi dan memperlihatkan konten');
  await page.reload();
  check(await page.locator('[data-reveal-pending]').count() === 0, 'Reduced motion saat membuka halaman tidak menyembunyikan konten');
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const colorScheme of ['dark', 'light']) {
      await page.emulateMedia({ colorScheme });
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Tidak ada overflow ' + width + ' ' + colorScheme);
    }
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(origin);
  await page.waitForFunction(() => document.querySelector('#contact [data-reveal-pending]'));
  await page.locator('#contact button').focus();
  check(await page.locator('#contact [data-scroll-reveal]').evaluate(e => !e.hasAttribute('data-reveal-pending') && !e.getAnimations().length), 'Fokus keyboard langsung memperlihatkan bagian kontak');
  await page.getByRole('tab', { name: 'Fintrack', exact: true }).click();
  check(await page.getByRole('tabpanel').getByRole('heading', { level: 3 }).textContent() === 'Financial tracking (Fintrack)', 'Pemilihan proyek tetap berfungsi');
  await page.getByRole('tab', { name: 'Personal Tools', exact: true }).click();
  await page.keyboard.press('ArrowRight');
  await page.getByRole('tab', { name: 'Fintrack', exact: true }).and(page.locator('[aria-selected="true"]')).waitFor();
  check(true, 'Navigasi tab dengan keyboard tetap berfungsi');
  await page.getByRole('button', { name: 'Favorit 0', exact: true }).click();
  await page.getByRole('heading', { name: 'Belum ada proyek favorit', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Lihat semua proyek', exact: true }).click();
  check(await page.locator('#project-list > li').count() === 6 && await page.locator('#project-list [data-reveal-pending]').count() === 0, 'Daftar proyek yang dirender ulang tetap terlihat');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin);
  await page.locator('summary[aria-label="Menu navigasi"]').click();
  await page.keyboard.press('Escape');
  check(!await page.getByRole('navigation', { name: 'Navigasi ponsel', exact: true }).isVisible(), 'Escape tetap menutup menu ponsel');
  const noScript = await page.context().browser().newContext({ javaScriptEnabled: false });
  const staticPage = await noScript.newPage();
  await staticPage.goto(origin);
  check(await staticPage.locator('#about h2').evaluate(e => { const s = getComputedStyle(e); return s.opacity === '1' && s.filter === 'none'; }) && await staticPage.locator('[data-reveal-pending]').count() === 0, 'Konten tetap terlihat tanpa JavaScript');
  await noScript.close();
  await page.goto(origin + '/menu');
  check(await page.locator('[data-scroll-reveal]').count() > 0, 'Menu memakai animasi bersama portfolio');
  await page.goto(origin + '/paste');
  check(await page.locator('[data-scroll-reveal]').count() === 0, 'Animasi tidak menyebar ke antarmuka tool');
  check(errors.length === 0, 'Tidak ada error JavaScript: ' + errors.join('; '));
  return { passed: results.length, results };
}
