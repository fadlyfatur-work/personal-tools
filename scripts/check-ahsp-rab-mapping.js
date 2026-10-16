/* eslint-disable @typescript-eslint/no-unused-expressions -- Playwright CLI evaluates the function expression. */
async page => {
  const results = [];
  const check = (value, label) => { if (!value) throw new Error(label); results.push(label); };
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const origin = new URL(page.url()).origin;
  await page.goto(origin + '/ahsp/rab');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByLabel('Tampilan', { exact: true }).selectOption('dark');
  await page.getByLabel('Dokumen Excel').setInputFiles('C:/Users/User/Downloads/PEMERIKSAAN/DKH KALTENG.xlsx');
  const group = page.getByRole('group', { name: 'Table 7', exact: true });
  await group.getByRole('heading', { name: 'Periksa hasil pembacaan', exact: true }).waitFor();
  const preview = group.getByRole('region', { name: 'Hasil pembacaan Table 7', exact: true });
  check(await group.getByRole('combobox').count() === 0, 'Six bare-letter dropdowns removed');
  check(await preview.locator('tbody tr').count() === 5, 'Five logical work items shown instead of one merged text block');
  const first = preview.locator('tbody tr').first();
  check((await first.innerText()).includes('Mobilisasi dan Demobilisasi Alat Berat Excavator'), 'Readable work description');
  check((await first.innerText()).includes('La.04') && (await first.innerText()).includes('94.200.000'), 'Code and formatted money stay paired with first work');
  check(await preview.locator('thead th').first().evaluate(el => el.getBoundingClientRect().width >= 54 && el.getBoundingClientRect().height < 110), 'Baris heading has a stable width and normal height');
  check(await first.locator('[data-field=name]').evaluate(el => el.getBoundingClientRect().width >= 300), 'Description column has reading space');
  const volume = group.getByRole('button', { name: 'Ubah kolom Volume', exact: true });
  const price = group.getByRole('button', { name: 'Ubah kolom Harga Satuan (Rupiah)', exact: true });
  await volume.click();
  const picker = page.getByRole('dialog', { name: 'Pilih kolom Volume', exact: true });
  await picker.waitFor();
  check(await picker.getByRole('button', { name: /^Gunakan kolom F:/ }).innerText().then(text => text.includes('94.200.000') && text.includes('HARGA SATUAN')), 'Column picker includes header and formatted sample values');
  await picker.getByRole('button', { name: /^Gunakan kolom F:/ }).click();
  check((await volume.innerText()).includes('Kolom F') && (await price.innerText()).includes('Kolom D'), 'Assigning a used source swaps columns without duplicates');
  check(await volume.evaluate(el => document.activeElement === el), 'Picking a column restores focus to its header');
  await group.getByRole('button', { name: 'Urungkan', exact: true }).click();
  check((await volume.innerText()).includes('Kolom D') && (await price.innerText()).includes('Kolom F'), 'Undo restores both column assignments');
  const name = group.getByRole('button', { name: 'Ubah kolom Uraian pekerjaan', exact: true });
  await name.focus(); await page.keyboard.press('Enter');
  const namePicker = page.getByRole('dialog', { name: 'Pilih kolom Uraian pekerjaan', exact: true });
  check(await namePicker.getByRole('button', { name: 'Tidak tersedia', exact: false }).count() === 0, 'Required description cannot be unset');
  await namePicker.getByLabel('Cari kolom sumber', { exact: true }).fill('KODE');
  check(await namePicker.getByRole('button', { name: /^Gunakan kolom C:/ }).count() === 1, 'Column lookup searches actual header');
  await namePicker.getByLabel('Cari kolom sumber', { exact: true }).fill('not-a-real-column');
  await namePicker.getByText('Kolom tidak ditemukan. Coba huruf kolom atau kata dari header.', { exact: true }).waitFor();
  await page.keyboard.press('Escape');
  check(!await namePicker.isVisible() && await name.evaluate(el => document.activeElement === el), 'Escape closes nonmodal picker and returns focus');
  await volume.click(); await page.getByRole('heading', { name: 'Pencocokan RAB', exact: true }).click();
  await picker.waitFor({ state: 'hidden' });
  check(!await picker.isVisible(), 'Click outside dismisses anchored picker');
  const code = group.getByRole('button', { name: 'Ubah kolom Kode', exact: true });
  await code.click();
  await page.getByRole('dialog', { name: 'Pilih kolom Kode', exact: true }).getByRole('button', { name: /Tidak tersedia/ }).click();
  check((await code.innerText()).includes('Tidak tersedia'), 'Optional field can be left unavailable');
  await group.getByRole('button', { name: 'Urungkan', exact: true }).click();
  await group.getByRole('button', { name: 'Sel Excel asli', exact: true }).click();
  const source = group.getByRole('region', { name: 'Sel Excel asli Table 7', exact: true });
  const headers = await source.locator('thead th').allTextContents();
  check(headers.map(text => text.trim()[0]).join('') === 'BBCDEFG', 'Source columns remain in Excel order B C D E F G');
  check(await source.locator('thead th').first().evaluate(el => el.getBoundingClientRect().width >= 54 && el.getBoundingClientRect().height < 110), 'Raw Baris heading does not wrap letter by letter');
  await source.getByRole('button', { name: 'Lihat sel B8', exact: true }).click();
  const fullCell = page.getByRole('dialog', { name: 'Sel Table 7!B8', exact: true });
  check((await fullCell.innerText()).includes('Galian Tanah di Rawa menggunakan Excavator Standar'), 'Long merged cell is fully accessible in detail dialog');
  await page.keyboard.press('Escape');
  check(!await fullCell.isVisible(), 'Raw cell dialog closes with Escape');
  await source.getByRole('button', { name: 'Mulai data dari baris 9', exact: true }).click();
  check(await group.getByLabel('Baris awal data Table 7', { exact: true }).inputValue() === '9', 'Clicking raw row updates reading start');
  await group.getByRole('button', { name: 'Urungkan', exact: true }).click();
  check(await group.getByLabel('Baris awal data Table 7', { exact: true }).inputValue() === '8', 'Start row is reversible');
  await group.getByLabel('Baris awal data Table 7', { exact: true }).fill('');
  await group.getByLabel('Baris awal data Table 7', { exact: true }).fill('8');
  await group.getByRole('button', { name: 'Deteksi ulang kolom', exact: true }).click();
  await group.getByRole('button', { name: 'Hasil pembacaan', exact: true }).click();
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['light', 'dark', 'system']) {
      await page.getByLabel('Tampilan', { exact: true }).selectOption(theme);
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Page fits ' + width + ' ' + theme);
    }
    await volume.click();
    const box = await picker.boundingBox();
    check(box && box.x >= 0 && box.x + box.width <= width + 1 && box.y >= 0 && box.y + box.height <= 901, 'Picker remains inside viewport ' + width);
    await page.keyboard.press('Escape');
    if (width === 320) {
      check(await preview.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'Mobile reading preview reflows without a wide table');
      await group.scrollIntoViewIfNeeded();
      await page.screenshot({ path: '.next/rab-ui-audit/mobile-after.png', fullPage: true });
    }
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await volume.click();
  check(await picker.evaluate(el => getComputedStyle(el).transitionDuration.split(',').every(value => parseFloat(value) === 0)), 'Reduced motion disables picker transitions');
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByLabel('Tampilan', { exact: true }).selectOption('dark');
  await group.scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.next/rab-ui-audit/desktop-after.png', fullPage: true });
  for (const [file, sheet, count] of [['DKH JABAR.xlsx', 'Table 3', 24], ['DKH JATIM.xlsx', 'Table 2', 23], ['DKH BANTEN.xlsx', 'Table 1', 43], ['1. Daftar Kuantitas dan Harga - R T.xlsx', 'Table 1', 25], ['DKH_Rehabilitasi_Jalan_HOS_Cokroaminoto.xlsx', 'DKH', 51]]) {
    await page.getByRole('button', { name: 'Batalkan', exact: true }).click();
    await page.getByLabel('Dokumen Excel').setInputFiles('C:/Users/User/Downloads/PEMERIKSAAN/' + file);
    const current = page.getByRole('group', { name: sheet, exact: true });
    await current.getByRole('heading', { name: 'Periksa hasil pembacaan', exact: true }).waitFor();
    check((await current.innerText()).includes(count + ' pekerjaan'), 'Reading preview preserves count ' + file);
    const region = current.getByRole('region', { name: 'Hasil pembacaan ' + sheet, exact: true });
    check(await region.locator('tbody tr').count() === 5, 'Preview stays bounded to five work items ' + file);
    await current.getByRole('button', { name: 'Pekerjaan berikutnya ' + sheet, exact: true }).click();
    check((await current.innerText()).includes('6–10 dari ' + count), 'Preview pagination works ' + file);
    await current.getByRole('checkbox', { name: /Tampilkan .* baris dikecualikan/ }).check();
    check((await region.locator('tbody').innerText()).includes('Judul kelompok') || (await region.locator('tbody').innerText()).includes('Tanpa') || await region.locator('tbody tr').count() > 0, 'Excluded source rows remain inspectable ' + file);
  }
  check(errors.length === 0, 'No browser runtime errors');
  return { pass: results.length, results, errors };
}
