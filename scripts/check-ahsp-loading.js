/* eslint-disable @typescript-eslint/no-unused-expressions -- Playwright CLI evaluates the function expression. */
async page => {
  const setMode = async mode => {
    const button = page.getByRole('button', { name: mode === 'dark' ? 'Aktifkan mode gelap' : 'Aktifkan mode terang', exact: true });
    if (await button.count()) await button.click();
  };
  const checks = [];
  const check = (value, name) => { if (!value) throw new Error(name); checks.push(name); };
  const errors = [];
  const pageError = error => errors.push(error.message);
  page.on('pageerror', pageError);
  const origin = new URL(page.url()).origin;
  const item = { id: 'loading-audit', code: '1.22.(7a)', name: 'Rambu Petunjuk', field: 'SMKK', division: 'Komponen 7', unit: 'Buah', ahsp_type: 'Informatif', regulation: 'SE 47/2026', sipasti_status: 'both', analysis_status: 'extracted', source_id: '10899', page_from: 43, page_to: 44, components: [], output_quantity: 1, overhead_min: 0, overhead_max: 0 };
  const source = { id: '10899', title: 'SMKK SE 47/2026', annex: 'Lampiran V', url: origin + '/audit-document.pdf', page_count: 100, assets: [{ url: origin + '/audit-document.pdf', page_start: 1, page_end: 100, preview_base_url: origin + '/audit-preview-' }] };
  const options = { total: 42, sources: [source], fields: ['SMKK', 'Umum'], field_counts: [{ field: 'SMKK', count: 20 }, { field: 'Umum', count: 22 }], divisions: [], units: ['Buah'] };
  const requests = [], pending = [];
  let hold = true, fail = false, empty = false;
  const waitPending = async () => {
    for (let i = 0; i < 250 && !pending.length; i++) await page.waitForTimeout(20);
    check(pending.length > 0, 'Request reached controlled network gate');
  };
  const release = () => { hold = false; for (const done of pending.splice(0)) done(); };
  const apiRoute = async route => {
    const params = new URL(route.request().url()).searchParams;
    requests.push(params);
    if (hold) await new Promise(resolve => pending.push(resolve));
    const multi = params.get('mode') === 'multiple';
    const body = fail ? { error: 'Koneksi uji terputus.' } : params.has('id') ? { item } : {
      items: empty ? [] : [item], total: empty ? 0 : 42, options,
      search_stats: { input_count: multi ? 2 : 0, found_terms: multi ? 2 : 0, match: params.get('match'), exact_total: 42, filtered_catalog_total: 42, exact_found_terms: multi ? 2 : 0, terms: [] }, matched_types: [],
    };
    await route.fulfill({ status: fail ? 503 : 200, contentType: 'application/json', body: JSON.stringify(body) });
  };
  const imageRoute = async route => {
    if (hold) await new Promise(resolve => pending.push(resolve));
    await route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64') });
  };
  await page.route('**/api/ahsp?*', apiRoute);
  await page.route('**/audit-preview-*', imageRoute);
  const group = page.getByRole('group', { name: 'Kecocokan Data', exact: true });
  const statuses = ['Hanya ada di Database', 'Hanya ada di SIPASTI', 'Verfied'];
  const result = page.getByRole('region', { name: 'Daftar pekerjaan', exact: true });
  const settled = async () => { await page.waitForFunction(() => document.querySelector('[aria-label="Daftar pekerjaan"]')?.getAttribute('aria-busy') === 'false'); };
  const spinner = locator => locator.locator('[class*="spinner"]');
  const loadingFilters = async () => {
    for (const name of statuses) check(await group.getByRole('button', { name, exact: true }).isDisabled(), name + ' disabled while loading');
    check(await spinner(group).first().isVisible(), 'Matching feedback includes a visible spinner');
    check(await spinner(result).first().isVisible(), 'Results include a contextual spinner');
  };
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(origin + '/ahsp');
    await waitPending();
    check(await page.locator('[class*="preloaderContent"] [class*="spinner"]').isVisible(), 'Initial overlay has a spinner');
    release(); await settled();
    await page.locator('[class*="preloaderContent"]').waitFor({ state: 'hidden' });
    check(await group.isVisible(), 'Matching filters are available before opening advanced search');
    const help = page.getByRole('button', { name: 'Tentang Kecocokan Data', exact: true });
    check(!await page.locator('#ahsp-match-info').isVisible(), 'Explanation is initially hidden');
    await help.focus(); await page.keyboard.press('Enter');
    check(await page.locator('#ahsp-match-info').isVisible(), 'Question button opens explanation by keyboard');
    check((await page.locator('#ahsp-match-info').innerText()).includes('tidak menilai kelengkapan analisis'), 'Help explains the limits of verification');
    check(!(await page.locator('#ahsp-match-info').innerText()).includes('klik Cari'), 'Help describes automatic filtering');
    await page.keyboard.press('Escape');
    check(!await page.locator('#ahsp-match-info').isVisible(), 'Escape closes native help');
    check(await help.evaluate(el => el === document.activeElement), 'Help retains keyboard focus after Escape');
    hold = true;
    await group.getByRole('button', { name: 'Verfied', exact: true }).click();
    await waitPending(); await loadingFilters();
    check(requests.at(-1).get('sipasti') === 'both', 'Matching applies without Cari');
    check(await group.getByRole('button', { name: 'Verfied', exact: true }).getAttribute('aria-pressed') === 'true', 'Active selection is shown during loading');
    release(); await settled();
    for (const name of statuses) check(await group.getByRole('button', { name, exact: true }).isEnabled(), name + ' reenabled on success');
    hold = true;
    await group.getByRole('button', { name: 'Verfied', exact: true }).click();
    await waitPending();
    check(requests.at(-1).get('sipasti') === '', 'Clicking active matching filter restores all statuses');
    release(); await settled();
    await page.getByRole('button', { name: 'Pencarian lanjutan', exact: true }).click();
    const advanced = page.getByRole('region', { name: 'Pencarian lanjutan', exact: true });
    const input = page.locator('#ahsp-multiple');
    const count = requests.length;
    await input.fill('Rambu petunjuk\nPeralatan P3K');
    await advanced.getByRole('button', { name: 'Exact-match', exact: true }).click();
    await page.getByRole('combobox', { name: 'Satuan', exact: true }).selectOption('Buah');
    check(requests.length === count, 'Advanced input remains a draft until Cari');
    hold = true;
    await group.getByRole('button', { name: 'Hanya ada di Database', exact: true }).click();
    await waitPending(); await loadingFilters();
    check(requests.at(-1).get('q') === '' && requests.at(-1).get('match') === 'like' && requests.at(-1).get('unit') === '', 'Matching does not submit advanced drafts');
    check(await advanced.getByRole('button', { name: 'Cari 2 istilah', exact: true }).isDisabled(), 'Advanced Cari is disabled during loading');
    check(await spinner(advanced.getByRole('button', { name: 'Cari 2 istilah', exact: true })).isVisible(), 'Cari shows spinner while advanced panel is visible');
    release(); await settled();
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const theme of ['light', 'dark']) {
        await setMode(theme);
        check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow at ' + width + ' ' + theme);
        const box = await input.boundingBox();
        const action = await advanced.getByRole('button', { name: 'Cari 2 istilah', exact: true }).boundingBox();
        check(action.y >= box.y + box.height, 'Cari is below full-width textarea at ' + width + ' ' + theme);
        await help.click();
        const pop = await page.locator('#ahsp-match-info').boundingBox();
        check(pop.x >= 0 && pop.x + pop.width <= width + 1 && pop.y >= 0 && pop.y + pop.height <= 1001, 'Help stays inside viewport at ' + width + ' ' + theme);
        await page.getByRole('button', { name: 'Tutup penjelasan', exact: true }).click();
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    hold = true;
    await advanced.getByRole('button', { name: 'Cari 2 istilah', exact: true }).click();
    await waitPending(); await loadingFilters();
    check(requests.at(-1).get('q') === 'Rambu petunjuk\nPeralatan P3K' && requests.at(-1).get('match') === 'exact', 'Advanced Cari applies its draft');
    release(); await settled();
    await page.getByRole('button', { name: 'Ubah pencarian', exact: true }).click();
    await input.fill('Belum diterapkan');
    hold = true;
    await group.getByRole('button', { name: 'Verfied', exact: true }).click();
    await waitPending();
    check(requests.at(-1).get('q') === 'Rambu petunjuk\nPeralatan P3K' && requests.at(-1).get('match') === 'exact', 'Matching retains the last applied advanced search');
    check(await spinner(page.getByRole('complementary', { name: 'Ringkasan pencarian' })).isVisible(), 'Search recap shows its own loading spinner');
    await page.screenshot({ path: '.next/ahsp-loading-desktop.png', fullPage: true, animations: 'disabled' });
    const activeContrast = await group.getByRole('button', { name: 'Verfied', exact: true }).evaluate(el => {
      const style = getComputedStyle(el);
      const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
      const a = luminance(style.color), b = luminance(style.backgroundColor);
      return { opacity: style.opacity, contrast: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
    });
    check(activeContrast.opacity === '1' && activeContrast.contrast >= 4.5, 'Active disabled filter retains full opacity and readable spinner/text contrast');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    check(await spinner(group).first().evaluate(el => getComputedStyle(el).animationName === 'none'), 'Reduced motion stops spinning without hiding feedback');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: '.next/ahsp-loading-mobile.png', fullPage: true, animations: 'disabled' });
    release(); await settled();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    hold = true;
    await page.getByRole('button', { name: 'Berikutnya', exact: true }).click();
    await waitPending(); await loadingFilters();
    check(requests.at(-1).get('page') === '2', 'Pagination loads with visible feedback');
    release(); await settled();
    hold = true;
    await group.getByRole('button', { name: 'Hanya ada di SIPASTI', exact: true }).click();
    await waitPending();
    check(requests.at(-1).get('page') === '1', 'Matching resets pagination to the first page');
    fail = true; release(); await settled();
    await page.getByRole('alert').filter({ hasText: 'Koneksi uji terputus.' }).waitFor();
    for (const name of statuses) check(await group.getByRole('button', { name, exact: true }).isEnabled(), name + ' reenabled after error');
    fail = false; hold = true;
    await page.getByRole('button', { name: 'Coba lagi', exact: true }).click();
    await waitPending(); await loadingFilters(); release(); await settled();
    hold = true;
    await page.getByRole('button', { name: 'Buka analisis 1.22.(7a): Rambu Petunjuk', exact: true }).click();
    await waitPending();
    check(await spinner(page.getByRole('dialog')).isVisible(), 'Detail modal shows a spinner while fetching');
    release();
    await page.getByRole('button', { name: 'Cara hitung dan lampiran', exact: true }).click();
    hold = true;
    // Force a new page so the preview request is held independently of the detail request.
    await page.getByRole('button', { name: 'Halaman berikutnya', exact: true }).click();
    await waitPending();
    check(await spinner(page.getByRole('region', { name: 'Halaman lampiran', exact: true })).isVisible(), 'Appendix page changes show a spinner');
    release();
    await page.getByRole('region', { name: 'Halaman lampiran', exact: true }).getByRole('status').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Tutup', exact: true }).click();
    empty = true;
    await page.getByRole('button', { name: 'Reset pencarian', exact: true }).click();
    await page.getByText('Tidak ada pekerjaan sesuai filter.', { exact: true }).waitFor();
    check(await page.getByRole('button', { name: 'Tampilkan semua pekerjaan' }).isVisible(), 'Empty result offers recovery');
    check(errors.length === 0, 'No browser runtime errors');
    return { passed: checks.length, checks };
  } finally {
    release();
    page.off('pageerror', pageError);
    await page.unroute('**/api/ahsp?*', apiRoute);
    await page.unroute('**/audit-preview-*', imageRoute);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  }
}
