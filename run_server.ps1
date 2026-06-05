# Local Web Server for caomisa.shop
# Runs natively on Windows using PowerShell (no Node.js or Python required!)

$port = 3000
$url = "http://localhost:$port/"
$workspaceDir = "c:\Users\Notebook Gamer\.gemini\antigravity\scratch\caomisa"

# Mappings for Content-Types
$mimeTypes = @{
    ".html"  = "text/html; charset=utf-8"
    ".css"   = "text/css; charset=utf-8"
    ".js"    = "application/javascript; charset=utf-8"
    ".webp"  = "image/webp"
    ".png"   = "image/png"
    ".jpg"   = "image/jpeg"
    ".jpeg"  = "image/jpeg"
    ".svg"   = "image/svg+xml"
    ".woff2" = "font/woff2"
    ".json"  = "application/json; charset=utf-8"
}

# Start HTTP Listener
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($url)

try {
    $listener.Start()
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "   Local Web Server running successfully for Caomisa Shop" -ForegroundColor Green
    Write-Host "   Access it at: http://localhost:$port/" -ForegroundColor Cyan
    Write-Host "   Press Ctrl+C in this terminal to stop the server" -ForegroundColor Yellow
    Write-Host "==========================================================" -ForegroundColor Green
}
catch {
    Write-Host "Error starting server: $_" -ForegroundColor Red
    exit
}

# Request processing loop
while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $localPath = $request.Url.LocalPath
        Write-Host "$(Get-Date -Format 'HH:mm:ss') - $($request.HttpMethod) - $localPath" -ForegroundColor Gray

        # Route matching
        $fileToServe = ""
        $contentType = ""
        $statusCode = 200
        $isJson = $false

        # 1. API Endpoints Mocking
        if ($localPath -eq "/api/products") {
            $fileToServe = Join-Path $workspaceDir "api_products.json"
            $contentType = $mimeTypes[".json"]
            $isJson = $true
        }
        elif ($localPath -eq "/api/banners") {
            $fileToServe = Join-Path $workspaceDir "api_banners.json"
            $contentType = $mimeTypes[".json"]
            $isJson = $true
        }
        elif ($localPath -eq "/api/site-content") {
            $fileToServe = Join-Path $workspaceDir "api_site_content.json"
            $contentType = $mimeTypes[".json"]
            $isJson = $true
        }
        elif ($localPath -eq "/api/collections") {
            $fileToServe = Join-Path $workspaceDir "api_collections.json"
            $contentType = $mimeTypes[".json"]
            $isJson = $true
        }
        # Mock any review posts or checkout posts to avoid frontend error
        elif ($localPath -like "/api/*") {
            $responseBytes = [System.Text.Encoding]::UTF8.GetBytes('{"ok":true,"message":"Mocked API success"}')
            $response.StatusCode = 200
            $response.ContentType = $mimeTypes[".json"]
            $response.ContentLength64 = $responseBytes.Length
            $response.OutputStream.Write($responseBytes, 0, $responseBytes.Length)
            $response.Close()
            continue
        }
        # 2. SPA Front-end Routing
        # If accessing the home page, or routes that don't have file extensions (SPA routes like /produtos, /ajuda, /produto/...)
        elif ($localPath -eq "/" -or $localPath -eq "/index.html" -or $localPath -eq "/produtos" -or $localPath -eq "/ajuda" -or $localPath -eq "/politicas" -or $localPath.StartsWith("/produto/")) {
            $fileToServe = Join-Path $workspaceDir "index.html"
            $contentType = $mimeTypes[".html"]
        }
        # 3. Static Files (assets, css, js)
        else {
            # Normalize path slashes for Windows filesystem
            $relPath = $localPath.Replace('/', '\').TrimStart('\')
            $candidatePath = Join-Path $workspaceDir $relPath

            if (Test-Path $candidatePath -PathType Leaf) {
                $fileToServe = $candidatePath
                $ext = [System.IO.Path]::GetExtension($candidatePath).ToLower()
                if ($mimeTypes.ContainsKey($ext)) {
                    $contentType = $mimeTypes[$ext]
                } else {
                    $contentType = "application/octet-stream"
                }
            } else {
                # File not found
                $statusCode = 404
            }
        }

        # 4. Sending the Response
        if ($statusCode -eq 200 -and (Test-Path $fileToServe)) {
            $response.StatusCode = 200
            $response.ContentType = $contentType
            
            # Read bytes to handle binary files (images, woff2) correctly
            $bytes = [System.IO.File]::ReadAllBytes($fileToServe)
            
            # If it's API JSON response, wrap in { ok: true, ... } if needed, 
            # but we already downloaded the direct JSON format, so it is ready to serve
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        }
        else {
            # Serve a 404 Not Found
            $response.StatusCode = 404
            $response.ContentType = "text/plain"
            $bytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $localPath")
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            Write-Host "404 - Not Found: $localPath" -ForegroundColor Red
        }
        
        $response.Close()
    }
    catch {
        Write-Host "Error serving request: $_" -ForegroundColor Red
    }
}
