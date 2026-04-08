param([int]$MaxThreads = 25)

# --- Build URL-to-filename map ---
Write-Host "Reading games.json..." -NoNewline
$data = Get-Content 'games.json' -Raw | ConvertFrom-Json
Write-Host " Done ($($data.Count) games)"

New-Item -ItemType Directory -Force -Path 'images' | Out-Null

$urlMap   = [System.Collections.Generic.Dictionary[string,string]]::new()
$usedNames = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)

foreach ($game in $data) {
    $url = $game.Image
    if (-not $url -or $url -eq '' -or $url -like 'images/*') { continue }
    if ($urlMap.ContainsKey($url)) { continue }

    try {
        $uri      = [System.Uri]::new($url)
        $filename = [System.IO.Path]::GetFileName($uri.LocalPath)
        if (-not $filename -or $filename -eq '') {
            $filename = 'img_' + [System.Guid]::NewGuid().ToString('N').Substring(0,8) + '.jpg'
        }
        # Resolve collisions
        if ($usedNames.Contains($filename)) {
            $ext    = [System.IO.Path]::GetExtension($filename)
            $base   = [System.IO.Path]::GetFileNameWithoutExtension($filename)
            $c = 1
            while ($usedNames.Contains("${base}_${c}${ext}")) { $c++ }
            $filename = "${base}_${c}${ext}"
        }
        $usedNames.Add($filename) | Out-Null
        $urlMap[$url] = $filename
    } catch {
        Write-Host "WARNING: Bad URL skipped: $url"
    }
}

Write-Host "Unique images: $($urlMap.Count)"

# --- Parallel download via runspace pool ---
$scriptBlock = {
    param($Url, $LocalPath)
    try {
        $wc = New-Object System.Net.WebClient
        $wc.Headers.Add('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36')
        $wc.Headers.Add('Referer', 'https://www.google.com/')
        $wc.DownloadFile($Url, $LocalPath)
        $wc.Dispose()
        return @{ Success = $true }
    } catch {
        try { if (Test-Path $LocalPath) { Remove-Item $LocalPath -Force } } catch {}
        return @{ Success = $false; Error = $_.Exception.Message }
    }
}

$pool = [RunspaceFactory]::CreateRunspacePool(1, $MaxThreads)
$pool.Open()

$running = [System.Collections.Generic.List[hashtable]]::new()
$skipped = 0; $succeeded = 0; $failed = 0
$failedUrls = [System.Collections.Generic.List[string]]::new()

foreach ($pair in $urlMap.GetEnumerator()) {
    $url       = $pair.Key
    $filename  = $pair.Value
    $localPath = Join-Path 'images' $filename

    if (Test-Path $localPath) { $skipped++; continue }

    $ps = [PowerShell]::Create()
    $ps.RunspacePool = $pool
    $ps.AddScript($scriptBlock).AddArgument($url).AddArgument($localPath) | Out-Null
    $running.Add(@{ PS = $ps; Handle = $ps.BeginInvoke(); Url = $url })
}

Write-Host "Skipped (already exist): $skipped"
Write-Host "Downloading $($running.Count) images using $MaxThreads threads..."

$total = $running.Count
while ($running.Count -gt 0) {
    $done = [System.Collections.Generic.List[hashtable]]::new()
    foreach ($job in $running) {
        if ($job.Handle.IsCompleted) { $done.Add($job) }
    }
    foreach ($job in $done) {
        $result = $job.PS.EndInvoke($job.Handle)
        $job.PS.Dispose()
        $running.Remove($job)
        if ($result.Success) {
            $succeeded++
        } else {
            $failed++
            $failedUrls.Add($job.Url)
            $urlMap[$job.Url] = $null
        }
        $finishedCount = $succeeded + $failed
        if ($finishedCount % 100 -eq 0 -or $running.Count -eq 0) {
            $pct = [int]($finishedCount / $total * 100)
            Write-Host "  [$finishedCount/$total] $pct% - OK:$succeeded  FAIL:$failed"
        }
    }
    if ($running.Count -gt 0) { Start-Sleep -Milliseconds 150 }
}

$pool.Close()
$pool.Dispose()

Write-Host ""
Write-Host "===== Download Summary ====="
Write-Host "  Skipped  : $skipped"
Write-Host "  Succeeded: $succeeded"
Write-Host "  Failed   : $failed"
if ($failedUrls.Count -gt 0) {
    Write-Host "  Failed URLs saved to: images\_failed.txt"
    $failedUrls | Set-Content 'images\_failed.txt' -Encoding UTF8
}

# --- Update games.json image paths ---
Write-Host ""
Write-Host "Updating games.json with local image paths..." -NoNewline
foreach ($game in $data) {
    $url = $game.Image
    if (-not $url -or $url -eq '' -or $url -like 'images/*') { continue }
    if ($urlMap.ContainsKey($url)) {
        $filename = $urlMap[$url]
        if ($filename) {
            $game.Image = "images/$filename"
        }
    }
}

$data | ConvertTo-Json -Depth 20 | Set-Content 'games.json' -Encoding UTF8
Write-Host " Done!"
Write-Host "All finished."
