import http.server
import socketserver
import os
import re

PORT = 3000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class SPAMockRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        # 1. API Mock endpoints
        if self.path == "/api/products":
            self.serve_json("api_products.json")
            return
        elif self.path == "/api/banners":
            self.serve_json("api_banners.json")
            return
        elif self.path == "/api/site-content":
            self.serve_json("api_site_content.json")
            return
        elif self.path == "/api/collections":
            self.serve_json("api_collections.json")
            return
        elif self.path.startswith("/api/"):
            self.serve_mock_api()
            return

        # 2. SPA Front-end Routing fallback
        # If the path is for a subpage or doesn't have an extension (like /produtos or /produto/...)
        _, ext = os.path.splitext(self.path)
        is_html_route = not ext or ext == ".html"
        is_product_route = self.path.startswith("/produto/") or self.path == "/produtos" or self.path == "/ajuda" or self.path == "/politicas"
        
        if (self.path == "/" or is_product_route) and is_html_route:
            self.path = "/index.html"
            
        super().do_GET()

    def do_POST(self):
        self.serve_mock_api()

    def do_PUT(self):
        self.serve_mock_api()

    def serve_json(self, filename):
        file_path = os.path.join(DIRECTORY, filename)
        if os.path.exists(file_path):
            self.send_response(200)
            self.send_header("Content-type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            with open(file_path, "rb") as f:
                self.wfile.write(f.read())
        else:
            self.send_response(404)
            self.send_header("Content-type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"ok":false,"message":"File not found"}')

    def serve_mock_api(self):
        self.send_response(200)
        self.send_header("Content-type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(b'{"ok":true,"message":"Mocked API success"}')

print(f"==========================================================")
print(f"   Local Web Server running successfully for Caomisa Shop")
print(f"   Access it at: http://localhost:{PORT}/")
print(f"   Press Ctrl+C to stop the server")
print(f"==========================================================")

with socketserver.TCPServer(("", PORT), SPAMockRequestHandler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        httpd.shutdown()
