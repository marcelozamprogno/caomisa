import os
import json
import urllib.request
import urllib.parse
import re

BASE_URL = "https://caomisa.shop"
WORKSPACE_DIR = r"c:\Users\Notebook Gamer\AppData\Local\Temp" # Wait, no! The workspace path is:
# c:\Users\Notebook Gamer\.gemini\antigravity\scratch\caomisa
WORKSPACE_DIR = r"c:\Users\Notebook Gamer\.gemini\antigravity\scratch\caomisa"

def download_file(url, local_path):
    print(f"Downloading {url} -> {local_path} ...")
    try:
        # Create directory if it does not exist
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        # Custom headers to look like a browser
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as response:
            with open(local_path, 'wb') as f:
                f.write(response.read())
        print("Success.")
        return True
    except Exception as e:
        print(f"Failed to download {url}: {e}")
        return False

def fetch_json(url):
    print(f"Fetching JSON from {url} ...")
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as response:
            data = json.loads(response.read().decode('utf-8'))
            print("Success.")
            return data
    except Exception as e:
        print(f"Failed to fetch JSON from {url}: {e}")
        return None

def main():
    # 1. Download core files
    core_files = {
        "/": "index.html",
        "/styles.css?v=20260601-04": "styles.css",
        "/script.js?v=20260601-04": "script.js"
    }
    
    for path, filename in core_files.items():
        download_file(BASE_URL + path, os.path.join(WORKSPACE_DIR, filename))
        
    # 2. Download standard assets
    assets = [
        "/assets/logocaomisa.webp",
        "/assets/favicon-caomisa-paw.webp",
        "/assets/inter-latin-variable.woff2",
        "/assets/lucide.min.js",
        "/assets/correios-logo.svg",
        "/assets/mercado-pago.webp",
        "/assets/payment-methods-new.webp"
    ]
    
    for asset in assets:
        download_file(BASE_URL + asset, os.path.join(WORKSPACE_DIR, asset.lstrip("/")))
        
    # 3. Fetch APIs and download dynamic assets
    api_endpoints = {
        "/api/products": "api_products.json",
        "/api/banners": "api_banners.json",
        "/api/site-content": "api_site_content.json",
        "/api/collections": "api_collections.json"
    }
    
    downloaded_assets = set(assets)
    
    for endpoint, filename in api_endpoints.items():
        data = fetch_json(BASE_URL + endpoint)
        if data:
            # Save the JSON data
            json_path = os.path.join(WORKSPACE_DIR, filename)
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            
            # Find any asset URLs inside the JSON database to download them too!
            # We look for values that start with /assets/
            def scan_and_download_assets(obj):
                if isinstance(obj, str):
                    if obj.startswith("/assets/") or obj.startswith("assets/"):
                        clean_path = "/" + obj.lstrip("/")
                        # Strip query parameters for local saving
                        clean_path_no_query = clean_path.split("?")[0]
                        if clean_path_no_query not in downloaded_assets:
                            downloaded_assets.add(clean_path_no_query)
                            download_file(BASE_URL + clean_path, os.path.join(WORKSPACE_DIR, clean_path_no_query.lstrip("/")))
                    elif obj.startswith("http") and ("caomisa.shop/assets/" in obj):
                        parsed = urllib.parse.urlparse(obj)
                        clean_path_no_query = parsed.path
                        if clean_path_no_query not in downloaded_assets:
                            downloaded_assets.add(clean_path_no_query)
                            download_file(obj, os.path.join(WORKSPACE_DIR, clean_path_no_query.lstrip("/")))
                elif isinstance(obj, dict):
                    for v in obj.values():
                        scan_and_download_assets(v)
                elif isinstance(obj, list):
                    for item in obj:
                        scan_and_download_assets(item)
            
            scan_and_download_assets(data)
            
    # 4. Search script.js / index.html for static images we might have missed
    try:
        with open(os.path.join(WORKSPACE_DIR, "index.html"), 'r', encoding='utf-8') as f:
            index_html = f.read()
            # Find any references to assets/
            found_assets = re.findall(r'href=["\'](/assets/[^"\']+)["\']|src=["\'](/assets/[^"\']+)["\']', index_html)
            for matches in found_assets:
                for match in matches:
                    if match:
                        clean_path = match.split("?")[0]
                        if clean_path not in downloaded_assets:
                            downloaded_assets.add(clean_path)
                            download_file(BASE_URL + match, os.path.join(WORKSPACE_DIR, clean_path.lstrip("/")))
    except Exception as e:
        print(f"Error scanning index.html: {e}")
        
    print("Download process completed.")

if __name__ == "__main__":
    main()
