$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$RepoRoot = Split-Path -Parent $PSScriptRoot
$AssetsDir = Join-Path $RepoRoot "assets"
$BrandColor = [System.Drawing.Color]::FromArgb(255, 12, 35, 64)
$AccentColor = [System.Drawing.Color]::FromArgb(255, 29, 78, 216)

function New-Canvas {
  param(
    [int]$Width,
    [int]$Height,
    [bool]$Transparent = $false
  )

  $bitmap = New-Object System.Drawing.Bitmap($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  if ($Transparent) {
    $graphics.Clear([System.Drawing.Color]::Transparent)
  } else {
    $graphics.Clear([System.Drawing.Color]::White)
  }

  return @{
    Bitmap = $bitmap
    Graphics = $graphics
  }
}

function New-Pen {
  param(
    [System.Drawing.Color]$Color,
    [float]$Width
  )

  $pen = New-Object System.Drawing.Pen($Color, $Width)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  return $pen
}

function Draw-Mark {
  param(
    [System.Drawing.Graphics]$Graphics,
    [float]$OriginX,
    [float]$OriginY,
    [float]$Scale
  )

  $stroke = 42 * $Scale
  $pen = New-Pen -Color $BrandColor -Width $stroke
  $dotBrush = New-Object System.Drawing.SolidBrush($BrandColor)

  try {
    $Graphics.DrawLine($pen, 160 * $Scale + $OriginX, 430 * $Scale + $OriginY, 500 * $Scale + $OriginX, 170 * $Scale + $OriginY)
    $Graphics.DrawLine($pen, 500 * $Scale + $OriginX, 170 * $Scale + $OriginY, 840 * $Scale + $OriginX, 430 * $Scale + $OriginY)
    $Graphics.DrawLine($pen, 260 * $Scale + $OriginX, 430 * $Scale + $OriginY, 260 * $Scale + $OriginX, 760 * $Scale + $OriginY)
    $Graphics.DrawLine($pen, 740 * $Scale + $OriginX, 430 * $Scale + $OriginY, 740 * $Scale + $OriginX, 760 * $Scale + $OriginY)
    $Graphics.DrawLine($pen, 260 * $Scale + $OriginX, 760 * $Scale + $OriginY, 740 * $Scale + $OriginX, 760 * $Scale + $OriginY)

    $shieldPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $shieldPath.AddBezier(
      500 * $Scale + $OriginX, 330 * $Scale + $OriginY,
      410 * $Scale + $OriginX, 330 * $Scale + $OriginY,
      370 * $Scale + $OriginX, 420 * $Scale + $OriginY,
      390 * $Scale + $OriginX, 510 * $Scale + $OriginY
    )
    $shieldPath.AddBezier(
      390 * $Scale + $OriginX, 510 * $Scale + $OriginY,
      410 * $Scale + $OriginX, 620 * $Scale + $OriginY,
      470 * $Scale + $OriginX, 680 * $Scale + $OriginY,
      500 * $Scale + $OriginX, 710 * $Scale + $OriginY
    )
    $shieldPath.AddBezier(
      500 * $Scale + $OriginX, 710 * $Scale + $OriginY,
      530 * $Scale + $OriginX, 680 * $Scale + $OriginY,
      590 * $Scale + $OriginX, 620 * $Scale + $OriginY,
      610 * $Scale + $OriginX, 510 * $Scale + $OriginY
    )
    $shieldPath.AddBezier(
      610 * $Scale + $OriginX, 510 * $Scale + $OriginY,
      630 * $Scale + $OriginX, 420 * $Scale + $OriginY,
      590 * $Scale + $OriginX, 330 * $Scale + $OriginY,
      500 * $Scale + $OriginX, 330 * $Scale + $OriginY
    )
    $Graphics.DrawPath($pen, $shieldPath)

    $Graphics.DrawArc($pen, 635 * $Scale + $OriginX, 130 * $Scale + $OriginY, 250 * $Scale, 250 * $Scale, 215, 110)
    $Graphics.DrawArc($pen, 690 * $Scale + $OriginX, 185 * $Scale + $OriginY, 145 * $Scale, 145 * $Scale, 215, 110)
    $Graphics.DrawArc($pen, 742 * $Scale + $OriginX, 236 * $Scale + $OriginY, 42 * $Scale, 42 * $Scale, 0, 360)
    $Graphics.FillEllipse($dotBrush, 742 * $Scale + $OriginX, 236 * $Scale + $OriginY, 42 * $Scale, 42 * $Scale)
  } finally {
    $pen.Dispose()
    $dotBrush.Dispose()
  }
}

function Draw-Wordmark {
  param(
    [System.Drawing.Graphics]$Graphics,
    [float]$X,
    [float]$Y,
    [float]$Scale
  )

  $titleFont = New-Object System.Drawing.Font("Segoe UI", [float](132 * $Scale), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $titleBrush = New-Object System.Drawing.SolidBrush($BrandColor)

  try {
    $Graphics.DrawString("TahananSafe", $titleFont, $titleBrush, $X, $Y)
  } finally {
    $titleFont.Dispose()
    $titleBrush.Dispose()
  }
}

function Save-Png {
  param(
    [System.Drawing.Bitmap]$Bitmap,
    [string]$Path
  )

  $directory = Split-Path -Parent $Path
  if (-not (Test-Path $directory)) {
    New-Item -ItemType Directory -Path $directory | Out-Null
  }

  $Bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
}

$icon = New-Canvas -Width 1024 -Height 1024
try {
  Draw-Mark -Graphics $icon.Graphics -OriginX 120 -OriginY 120 -Scale 0.78
  Save-Png -Bitmap $icon.Bitmap -Path (Join-Path $AssetsDir "Logo1.png")
  Save-Png -Bitmap $icon.Bitmap -Path (Join-Path $AssetsDir "icon.png")
} finally {
  $icon.Graphics.Dispose()
  $icon.Bitmap.Dispose()
}

$adaptive = New-Canvas -Width 1024 -Height 1024 -Transparent $true
try {
  Draw-Mark -Graphics $adaptive.Graphics -OriginX 120 -OriginY 120 -Scale 0.78
  Save-Png -Bitmap $adaptive.Bitmap -Path (Join-Path $AssetsDir "adaptive-icon.png")
  Save-Png -Bitmap $adaptive.Bitmap -Path (Join-Path $AssetsDir "splash-icon.png")
} finally {
  $adaptive.Graphics.Dispose()
  $adaptive.Bitmap.Dispose()
}

$favicon = New-Canvas -Width 256 -Height 256
try {
  Draw-Mark -Graphics $favicon.Graphics -OriginX 30 -OriginY 28 -Scale 0.19
  Save-Png -Bitmap $favicon.Bitmap -Path (Join-Path $AssetsDir "favicon.png")
} finally {
  $favicon.Graphics.Dispose()
  $favicon.Bitmap.Dispose()
}

$splash = New-Canvas -Width 1600 -Height 900
try {
  Draw-Mark -Graphics $splash.Graphics -OriginX 210 -OriginY 200 -Scale 0.34
  Draw-Wordmark -Graphics $splash.Graphics -X 620 -Y 352 -Scale 1
  Save-Png -Bitmap $splash.Bitmap -Path (Join-Path $AssetsDir "splash1.png")
} finally {
  $splash.Graphics.Dispose()
  $splash.Bitmap.Dispose()
}
