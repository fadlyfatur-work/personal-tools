$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path '.next/nominatif-check').Path
$excel = $null
$book = $null
try {
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $excel.AutomationSecurity = 3
    $book = $excel.Workbooks.Open((Join-Path $taskRoot 'template-sample.xlsx'), 0, $true)
    $excel.CalculateFullRebuild()
    if ($book.Worksheets.Item('Kwitansi').Range('AB9').Text -ne '2026') { throw 'Year must display as 2026, matching the template.' }
    $checks = @(@('nominatif-LS','U15',380000),@('nominatif-KPN','N16',380000),@('Kwitansi','X61',380000),@('Kartu Kendali TA.2018','I13',380000),@('Amplop','U14',380000),@('Lamp-Transport','H33',170000))
    foreach ($check in $checks) {
        $sheet = $book.Worksheets.Item($check[0])
        $value = $sheet.Range($check[1]).Value2
        if ($value -ne $check[2]) { throw "Native formula mismatch: $($check[0])!$($check[1])=$value" }
    }
    foreach ($check in @(@(' DATA','H3'),@('nominatif-LS','C14'),@('SPPD-Form','W16'),@('Lamp-Transport','D14'))) {
        $text = $book.Worksheets.Item($check[0]).Range($check[1]).Text
        if ($text -ne '199001012020011001') { throw "NIP text mismatch: $($check[0])!$($check[1])=$text" }
    }
    $book.Worksheets.Item(' DATA').Range('S3').Value2 = 200000
    $excel.CalculateFullRebuild()
    foreach ($check in $checks[0..4]) {
        $value = $book.Worksheets.Item($check[0]).Range($check[1]).Value2
        if ($value -ne 410000) { throw "Native driver mismatch: $($check[0])=$value" }
    }
    $book.Worksheets.Item(' DATA').Range('S3').Value2 = 170000
    $excel.CalculateFullRebuild()
    for ($index = 4; $index -le $book.Worksheets.Count; $index++) {
        $sheet = $book.Worksheets.Item($index)
        $pdf = Join-Path $taskRoot "native-$index.pdf"
        $sheet.ExportAsFixedFormat(0, $pdf)
        Write-Output "Native PDF: $($sheet.Name)"
    }
    $book.Close($false)
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($book)
    $book = $excel.Workbooks.Open((Join-Path $taskRoot 'multiple-employees.xlsx'), 0, $true)
    $excel.CalculateFullRebuild()
    if ($book.Worksheets.Count -ne 14) { throw 'Expected 14 sheets for two employees.' }
    foreach ($check in @(@('nominatif-LS','U16',810000),@('nominatif-KPN','N17',810000),@('Kwitansi','K84',280000),@('Kwitansi-2','X61',430000))) {
        $value = $book.Worksheets.Item($check[0]).Range($check[1]).Value2
        if ($value -ne $check[2]) { throw "Multiple-employee mismatch: $($check[0])!$($check[1])=$value" }
    }
    if ($book.Worksheets.Item('SPPD-Form-2').Range('AC8').Text -ne 'SPD/02') { throw 'Second SPD number does not match.' }
    $book.Close($false)
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($book)
    $book = $excel.Workbooks.Open((Join-Path $taskRoot 'short-trip.xlsx'), 0, $true)
    $excel.CalculateFullRebuild()
    foreach ($check in @(@('nominatif-LS','U15'),@('nominatif-KPN','N16'),@('Kwitansi','X61'),@('Kartu Kendali TA.2018','I13'),@('Amplop','U14'))) {
        if ($book.Worksheets.Item($check[0]).Range($check[1]).Value2 -ne 170000) { throw "Short trip mismatch: $($check[0])" }
    }
    foreach ($ref in @('X54','X55','X56','X57','X58','X59')) {
        if ($book.Worksheets.Item('Kwitansi').Range($ref).Value2 -ne 0) { throw "Unexpected non-transport cost: $ref" }
    }
    Write-Output 'Excel native PASS: all totals, transport changes, exact 18-digit text NIP, seven document PDFs, and two employees.'
} finally {
    if ($null -ne $book) { $book.Close($false); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($book) }
    if ($null -ne $excel) { $excel.Quit(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($excel) }
}
