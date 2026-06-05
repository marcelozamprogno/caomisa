$baseUrl = "https://caomisa.shop"
$workspaceDir = "c:\Users\Notebook Gamer\.gemini\antigravity\scratch\caomisa"

function Download-File {
    param(
        [string]$url,
        [string]$localPath
    )
    Write-Host "Downloading $url -> $localPath ..."
    try {
        $parentDir = Split-Path -Parent $localPath
        if (-not (Test-Path $parentDir)) {
            New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
        }
        $headers = @{
            "User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        Invoke-WebRequest -Uri $url -OutFile $localPath -Headers $headers -TimeoutSec 20 -ErrorAction Stop
        Write-Host "Success."
        return $true
    }
    catch {
        Write-Host "Failed to download ${url}: $_"
        return $false
    }
}

function Fetch-Json {
    param(
        [string]$url
    )
    Write-Host "Fetching JSON from $url ..."
    try {
        $headers = @{
            "User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        $response = Invoke-RestMethod -Uri $url -Headers $headers -TimeoutSec 20 -ErrorAction Stop
        Write-Host "Success."
        return $response
    }
    catch {
        Write-Host "Failed to fetch JSON from ${url}: $_"
        return $null
    }
}

# 1. Download core files
$coreFiles = @{
    "/" = "index.html"
    "/styles.css?v=20260601-04" = "styles.css"
    "/script.js?v=20260601-04" = "script.js"
}

foreach ($item in $coreFiles.GetEnumerator()) {
    Download-File -url ($baseUrl + $item.Key) -localPath (Join-Path $workspaceDir $item.Value)
}

# 2. Download standard assets
$assets = @(
    "/assets/logocaomisa.webp",
    "/assets/favicon-caomisa-paw.webp",
    "/assets/inter-latin-variable.woff2",
    "/assets/lucide.min.js",
    "/assets/correios-logo.svg",
    "/assets/mercado-pago.webp",
    "/assets/payment-methods-new.webp"
)

foreach ($asset in $assets) {
    $cleanPath = $asset.TrimStart('/')
    Download-File -url ($baseUrl + $asset) -localPath (Join-Path $workspaceDir $cleanPath)
}

# 3. Fetch APIs and download dynamic assets
$apiEndpoints = @{
    "/api/products" = "api_products.json"
    "/api/banners" = "api_banners.json"
    "/api/site-content" = "api_site_content.json"
    "/api/collections" = "api_collections.json"
}

$downloadedAssets = New-Object System.Collections.Generic.HashSet[string]
foreach ($a in $assets) {
    [void]$downloadedAssets.Add($a.ToLower())
}

# Helper function to recursively find values starting with /assets/
function Scan-Assets {
    param($obj)
    if ($obj -is [string]) {
        if ($obj.StartsWith("/assets/") -or $obj.StartsWith("assets/")) {
            $clean = "/" + $obj.TrimStart('/')
            $cleanNoQuery = $clean.Split('?')[0]
            if (-not $downloadedAssets.Contains($cleanNoQuery.ToLower())) {
                [void]$downloadedAssets.Add($cleanNoQuery.ToLower())
                Download-File -url ($baseUrl + $clean) -localPath (Join-Path $workspaceDir ($cleanNoQuery.TrimStart('/')))
            }
        }
        elseif ($obj.StartsWith("http") -and $obj.Contains("caomisa.shop/assets/")) {
            try {
                $uri = New-Object System.Uri($obj)
                $cleanNoQuery = $uri.AbsolutePath
                if (-not $downloadedAssets.Contains($cleanNoQuery.ToLower())) {
                    [void]$downloadedAssets.Add($cleanNoQuery.ToLower())
                    Download-File -url $obj -localPath (Join-Path $workspaceDir ($cleanNoQuery.TrimStart('/')))
                }
            }
            catch {}
        }
    }
    elseif ($obj -is [System.Collections.IDictionary]) {
        foreach ($val in $obj.Values) {
            Scan-Assets $val
        }
    }
    elseif ($obj -is [System.Collections.IEnumerable] -and $obj -isnot [string]) {
        foreach ($item in $obj) {
            Scan-Assets $item
        }
    }
    elseif ($obj -is [PSCustomObject]) {
        foreach ($prop in $obj.PSObject.Properties) {
            Scan-Assets $prop.Value
        }
    }
}

foreach ($item in $apiEndpoints.GetEnumerator()) {
    $data = Fetch-Json ($baseUrl + $item.Key)
    if ($data) {
        $jsonStr = $data | ConvertTo-Json -Depth 100
        $jsonPath = Join-Path $workspaceDir $item.Value
        [System.IO.File]::WriteAllText($jsonPath, $jsonStr, [System.Text.Encoding]::UTF8)
        
        Scan-Assets $data
    }
}

# 4. Search index.html for missed assets
try {
    $indexPath = Join-Path $workspaceDir "index.html"
    if (Test-Path $indexPath) {
        $content = [System.IO.File]::ReadAllText($indexPath)
        $matches = [regex]::Matches($content, '(?:href|src)=["''](/assets/[^"'']+)["'']')
        foreach ($m in $matches) {
            $assetPath = $m.Groups[1].Value
            $clean = $assetPath.Split('?')[0]
            if (-not $downloadedAssets.Contains($clean.ToLower())) {
                [void]$downloadedAssets.Add($clean.ToLower())
                Download-File -url ($baseUrl + $assetPath) -localPath (Join-Path $workspaceDir ($clean.TrimStart('/')))
            }
        }
    }
}
catch {
    Write-Host "Error scanning index.html: $_"
}

Write-Host "Download completed."
