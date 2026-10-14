# Bir klasördeki fotoğrafları küçültüp Birlikte uygulamasının "Yedekten geri yükle" ile okuduğu tek dosyaya çevirir.
# Kullanım: powershell -File scripts\make-backup.ps1 -Folder "C:\...\Birlikte Fotoğraflar"
param(
  [Parameter(Mandatory = $true)][string]$Folder,
  [string]$Out = '',
  [string]$A = 'Adem',
  [string]$B = 'Sena',
  [string]$Start = '2025-01-10',
  [int]$Max = 1600
)
Add-Type -AssemblyName System.Drawing
if ($Out -eq '') { $Out = Join-Path $Folder 'birlikte-yedek.json' }

$files = Get-ChildItem -LiteralPath $Folder -File | Where-Object { $_.Extension -match '^\.(jpe?g|png|bmp|gif|tiff?)$' } | Sort-Object Name
$skipped = Get-ChildItem -LiteralPath $Folder -File | Where-Object { $_.Extension -match '^\.(heic|heif|webp)$' }
if ($skipped) { Write-Host ("UYARI: {0} dosya okunamadı (HEIC/WEBP). JPG olarak dışa aktarın: {1}" -f $skipped.Count, ($skipped | Select-Object -First 3 -ExpandProperty Name) -join ', ') }

$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]84)

$w = New-Object System.IO.StreamWriter($Out, $false, (New-Object System.Text.UTF8Encoding($false)))
$settings = @{ a = $A; b = $B; start = $Start } | ConvertTo-Json -Compress
$w.Write('{"app":"birlikte","v":1,"settings":' + $settings + ',"photos":[')
$first = $true
$n = 0
$now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
foreach ($f in $files) {
  try {
    $img = [System.Drawing.Image]::FromFile($f.FullName)
    # Çekim tarihi: EXIF 0x9003, yoksa dosya tarihi
    $date = $f.LastWriteTime
    if ($img.PropertyIdList -contains 0x9003) {
      $s = ([System.Text.Encoding]::ASCII.GetString($img.GetPropertyItem(0x9003).Value)).Trim([char]0, ' ')
      $d = [datetime]::MinValue
      if ([datetime]::TryParseExact($s, 'yyyy:MM:dd HH:mm:ss', [Globalization.CultureInfo]::InvariantCulture, 'None', [ref]$d)) { $date = $d }
    }
    # Yön düzeltme: EXIF 0x0112
    if ($img.PropertyIdList -contains 0x0112) {
      switch ([int]$img.GetPropertyItem(0x0112).Value[0]) {
        3 { $img.RotateFlip('Rotate180FlipNone') }
        6 { $img.RotateFlip('Rotate90FlipNone') }
        8 { $img.RotateFlip('Rotate270FlipNone') }
      }
    }
    $k = [Math]::Min(1.0, $Max / [Math]::Max($img.Width, $img.Height))
    $nw = [int][Math]::Round($img.Width * $k); $nh = [int][Math]::Round($img.Height * $k)
    $bmp = New-Object System.Drawing.Bitmap($nw, $nh)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = 'HighQualityBicubic'
    $g.DrawImage($img, 0, 0, $nw, $nh)
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, $codec, $ep)
    $b64 = [Convert]::ToBase64String($ms.ToArray())
    $g.Dispose(); $bmp.Dispose(); $img.Dispose(); $ms.Dispose()
    if (-not $first) { $w.Write(',') }
    $first = $false
    $w.Write('{"takenAt":"' + $date.ToString('yyyy-MM-dd') + '","caption":"","addedAt":' + ($now + $n) + ',"data":"data:image/jpeg;base64,' + $b64 + '"}')
    $n++
  } catch {
    Write-Host ("Atlandı: {0} ({1})" -f $f.Name, $_.Exception.Message)
  }
}
$w.Write(']}')
$w.Close()
$size = [Math]::Round((Get-Item -LiteralPath $Out).Length / 1MB, 1)
Write-Host ("Tamam: {0} fotoğraf, {1} MB -> {2}" -f $n, $size, $Out)
