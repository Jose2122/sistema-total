# Fix UTF-8 encoding corruption in ModuloTicketsPago.jsx
$file = "src\ModuloTicketsPago.jsx"
$content = [System.IO.File]::ReadAllText((Resolve-Path $file), [System.Text.Encoding]::UTF8)

# Each corrupted sequence -> correct Spanish character
# These are UTF-8 multi-byte chars that got interpreted as Latin-1 then re-saved
$content = $content -replace [regex]::Escape("Ã³"), "ó"
$content = $content -replace [regex]::Escape("Ã­"), "í"
$content = $content -replace [regex]::Escape("Ãº"), "ú"
$content = $content -replace [regex]::Escape("Ã©"), "é"
$content = $content -replace [regex]::Escape("Ã¡"), "á"
$content = $content -replace [regex]::Escape("Ã±"), "ñ"
$content = $content -replace [regex]::Escape("Ã""), "Ó"
$content = $content -replace [regex]::Escape("Ã‰"), "É"
$content = $content -replace [regex]::Escape("Ãš"), "Ú"
$content = $content -replace [regex]::Escape("Ã‡"), "Ç"
$content = $content -replace [regex]::Escape("Ã¼"), "ü"
$content = $content -replace [regex]::Escape("Ã¶"), "ö"
$content = $content -replace [regex]::Escape("Ã—"), "×"
$content = $content -replace [regex]::Escape("Â¿"), "¿"
$content = $content -replace [regex]::Escape("Â¡"), "¡"
$content = $content -replace [regex]::Escape("Âº"), "º"
$content = $content -replace [regex]::Escape("Â°"), "°"
$content = $content -replace [regex]::Escape("â€""), "—"
$content = $content -replace [regex]::Escape("âœ""), "✓"
$content = $content -replace [regex]::Escape("ðŸ""), "📁"

# Handle Á - must be done carefully (it overlaps with partial sequences)
# Fix "Ã" followed by specific chars that indicate different letters
# At this point remaining "Ã" sequences should be Á
$content = $content -replace [regex]::Escape("Ã'"), "Ñ"
$content = $content -replace [regex]::Escape("Ã"), "Á"

[System.IO.File]::WriteAllText((Resolve-Path $file), $content, [System.Text.Encoding]::UTF8)
Write-Host "Done. Encoding fixed."
