<#
    check_links.ps1
    Checks every PKG link in games.json using the 1fichier File Info API.
    Returns the real filename as JSON — no JS challenge, no scraping, no RD.
    Get a free API key at: https://1fichier.com/console/params.pl
    Non-.pkg results are saved to non_pkg_links.txt
#>

$JsonPath    = Join-Path $PSScriptRoot 'games.json'
$OutputFile  = Join-Path $PSScriptRoot 'non_pkg_links.txt'
$Throttle    = 3     # keep low — 1fichier API is rate-limited per key
$DelayMs     = 400   # ms between each request inside a worker
$TimeoutSec  = 20
$MaxRetries  = 3

# ── 1fichier API key ─────────────────────────────────────────────────────────
$ApiKey = $env:ONEFICHIER_KEY
if (-not $ApiKey) {
    $ApiKey = Read-Host 'Enter your 1fichier API key (from 1fichier.com/console/params.pl)'
}
if (-not $ApiKey) { Write-Error 'No API key provided.'; exit 1 }

$games = Get-Content $JsonPath -Raw | ConvertFrom-Json

# Flatten every link into a work item
$workItems = foreach ($game in $games) {
    $site = $game.Url
    foreach ($pkgLink in $game.PKG_Links) {
        [PSCustomObject]@{
            GameName  = $game.'Game Name'
            LinkTitle = $pkgLink.Title
            URL       = $pkgLink.Link
            Site      = $site
        }
    }
}

$total       = $workItems.Count
$counter     = [System.Threading.Interlocked]::Exchange([ref]0, 0)
$brokenCount = [System.Threading.Interlocked]::Exchange([ref]0, 0)

Write-Host "Checking $total links via 1fichier API with $Throttle workers..." -ForegroundColor Cyan

# ── Runspace pool ─────────────────────────────────────────────────────────────
$pool = [System.Management.Automation.Runspaces.RunspaceFactory]::CreateRunspacePool(1, $Throttle)
$pool.Open()

$scriptBlock = {
    param($item, $apiKey, $timeoutSec, $maxRetries, $delayMs)

    Start-Sleep -Milliseconds $delayMs

    # Extract the file ID from the 1fichier URL
    # Format: https://1fichier.com/?FILEID  or  https://1fichier.com/?FILEID&af=...
    $fileId = ''
    if ($item.URL -match '[?&]([a-zA-Z0-9]+)(?:&|$)') {
        $fileId = $matches[1]
    }
    if (-not $fileId) {
        return [PSCustomObject]@{
            GameName  = $item.GameName
            LinkTitle = $item.LinkTitle
            URL       = $item.URL
            FileName  = ''
            IsPkg     = $false
            Error     = 'Could not parse file ID from URL'
            Retries   = 0
        }
    }

    $attempt  = 0
    $backoff  = 5
    $filename = ''
    $lastErr  = $null

    while ($attempt -le $maxRetries) {
        $attempt++
        try {
            $body  = "{`"url`":`"https://1fichier.com/?$fileId`"}"
            $req   = [System.Net.HttpWebRequest]::Create('https://api.1fichier.com/v1/file/info.cgi')
            $req.Method      = 'POST'
            $req.ContentType = 'application/json'
            $req.Timeout     = $timeoutSec * 1000
            $req.Headers.Add('Authorization', "Bearer $apiKey")
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
            $req.ContentLength = $bytes.Length
            $req.GetRequestStream().Write($bytes, 0, $bytes.Length)

            $resp   = $req.GetResponse()
            $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
            $json   = $reader.ReadToEnd()
            $reader.Close(); $resp.Close()

            $data = $json | ConvertFrom-Json
            if ($data.status -eq 'KO') {
                $lastErr = $data.message
                break
            }
            $filename = $data.filename
            $lastErr  = $null
            break

        } catch [System.Net.WebException] {
            $code = [int]$_.Exception.Response.StatusCode
            if ($code -in @(429, 503) -and $attempt -le $maxRetries) {
                Start-Sleep -Seconds $backoff; $backoff *= 2; continue
            }
            $lastErr = "HTTP $code"
            break
        } catch {
            $lastErr = $_.Exception.Message
            if ($attempt -le $maxRetries) { Start-Sleep -Seconds $backoff; $backoff *= 2 }
        }
    }

    return [PSCustomObject]@{
        GameName  = $item.GameName
        LinkTitle = $item.LinkTitle
        URL       = $item.URL
        Site      = $item.Site
        FileName  = $filename
        IsPkg     = ($filename -match '\.pkg$')
        Error     = $lastErr
        Retries   = ($attempt - 1)
    }
}

# Dispatch all jobs
$jobs = foreach ($item in $workItems) {
    $ps = [System.Management.Automation.PowerShell]::Create()
    $ps.RunspacePool = $pool
    [void]$ps.AddScript($scriptBlock).AddArgument($item).AddArgument($ApiKey).AddArgument($TimeoutSec).AddArgument($MaxRetries).AddArgument($DelayMs)
    [PSCustomObject]@{ PS = $ps; Handle = $ps.BeginInvoke() }
}

# Collect results with a live status line
$results = foreach ($job in $jobs) {
    $r = $job.PS.EndInvoke($job.Handle)
    $job.PS.Dispose()
    $done = [System.Threading.Interlocked]::Increment([ref]$counter)

    if ($r.FileName -and -not $r.IsPkg) {
        [void][System.Threading.Interlocked]::Increment([ref]$brokenCount)
    }

    $pct       = [int]($done / $total * 100)
    $status    = if ($r.Error) { 'ERR' } elseif ($r.IsPkg) { ' OK' } else { 'BAD' }
    $color     = switch ($status) { ' OK' { 'Green' } 'BAD' { 'Yellow' } default { 'DarkGray' } }
    $gameName  = $r.GameName.PadRight(45).Substring(0, 45)
    $detected  = if ($r.FileName) { $r.FileName } elseif ($r.Error) { "Error" } else { '?' }

    Write-Host ("`r[{0,4}%] {1}/{2}  [{3}]  {4}  ->  {5}" -f `
        $pct, $done, $total, $status, $gameName, $detected).PadRight(120) `
        -NoNewline -ForegroundColor $color

    Write-Progress -Activity 'Checking links' `
        -Status ("$done / $total  |  Broken found: $brokenCount") `
        -PercentComplete $pct
    $r
}

$pool.Close()
Write-Progress -Activity 'Checking links' -Completed

# ── Report ───────────────────────────────────────────────────────────────────
$broken    = $results | Where-Object { $_.FileName -and -not $_.IsPkg }
$errored   = $results | Where-Object { $_.Error }
$confirmed = $results | Where-Object { $_.IsPkg }

$lines = @()
$lines += "=== NON-.PKG LINKS FOUND ($($broken.Count)) ==="
$lines += ""
foreach ($b in $broken | Sort-Object GameName) {
    $ext = if ($b.FileName -match '\.(\w+)$') { $matches[1].ToUpper() } else { 'UNKNOWN' }
    $lines += "[$ext]  $($b.GameName)"
    $lines += "       Site       : $($b.Site)"
    $lines += "       Link title : $($b.LinkTitle)"
    $lines += "       Detected   : $($b.FileName)"
    $lines += "       URL        : $($b.URL)"
    $lines += ""
}
$lines += "=== ERRORS / UNREACHABLE ($($errored.Count)) ==="
$lines += ""
foreach ($e in $errored | Sort-Object GameName) {
    $lines += "  $($e.GameName) | $($e.LinkTitle) | $($e.Error)"
}
$lines += ""
$lines += "=== SUMMARY ==="
$lines += "  Total links   : $total"
$lines += "  Confirmed .pkg: $($confirmed.Count)"
$lines += "  Non-.pkg      : $($broken.Count)"
$lines += "  Errors        : $($errored.Count)"

$lines | Out-File $OutputFile -Encoding UTF8
$lines | Write-Host

# Also write a JSON with site included
$broken | Select-Object GameName, Site, LinkTitle, @{n='ext';e={ if ($_.FileName -match '\.([\w]+)$') { $matches[1].ToUpper() } else { 'UNKNOWN' } }}, @{n='filename';e={$_.FileName}}, URL `
    | ConvertTo-Json -Depth 3 `
    | Out-File ($OutputFile -replace '\.txt$', '.json') -Encoding UTF8

Write-Host "`nResults saved to $OutputFile" -ForegroundColor Green
