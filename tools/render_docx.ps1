# Export submission/WriteUp.docx to PDF through Word, then render each page to PNG for a visual check.
#   powershell -File tools/render_docx.ps1
$repo = Split-Path -Parent $PSScriptRoot
$docx = Join-Path $repo "submission\WriteUp.docx"
$out  = Join-Path $repo "submission\_assets"
New-Item -ItemType Directory -Force $out | Out-Null
$pdf  = Join-Path $out "WriteUp.pdf"
$w = New-Object -ComObject Word.Application
$w.Visible = $false
$d = $w.Documents.Open($docx, $false, $true)
$d.ExportAsFixedFormat($pdf, 17)   # 17 = PDF
$d.Close(0); $w.Quit()
& (Join-Path $repo ".venv\Scripts\python.exe") -c "import pymupdf,sys; d=pymupdf.open(sys.argv[1]); [p.get_pixmap(dpi=70).save(f'{sys.argv[2]}/page-{i+1}.png') for i,p in enumerate(d)]; print('pages:', d.page_count)" $pdf $out
Write-Output "Rendered pages in $out"
