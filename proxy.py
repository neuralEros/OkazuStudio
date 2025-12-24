
import http.server
import socketserver
import urllib.request
import urllib.error
import sys
import os

PORT = 8000
PROXY_PREFIX = '/replicate-api'
TARGET_BASE = 'https://api.replicate.com'

class ProxyRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith(PROXY_PREFIX):
            self.handle_proxy('GET')
        else:
            super().do_GET()

    def do_POST(self):
        if self.path.startswith(PROXY_PREFIX):
            self.handle_proxy('POST')
        else:
            self.send_error(404, "Not Found")

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def handle_proxy(self, method):
        # Construct target URL
        target_path = self.path[len(PROXY_PREFIX):]
        target_url = TARGET_BASE + target_path

        # Prepare headers
        headers = {}
        for key, value in self.headers.items():
            if key.lower() not in ['host', 'origin', 'referer', 'content-length']:
                headers[key] = value

        # Read body if present
        content_len = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_len) if content_len > 0 else None

        try:
            req = urllib.request.Request(target_url, data=body, headers=headers, method=method)
            with urllib.request.urlopen(req) as response:
                self.send_response(response.status)

                # Add CORS header to proxied response
                self.send_header('Access-Control-Allow-Origin', '*')

                for key, value in response.headers.items():
                    # Filter out hop-by-hop headers if strictly needed, but usually fine
                    # Also filter Access-Control-Allow-Origin to avoid duplicates
                    if key.lower() not in ['transfer-encoding', 'content-encoding', 'content-length', 'access-control-allow-origin']:
                        self.send_header(key, value)

                # Forward Content-Length specifically to be safe
                if response.headers.get('Content-Length'):
                    self.send_header('Content-Length', response.headers.get('Content-Length'))

                self.end_headers()
                self.wfile.write(response.read())

        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(e.read())
        except Exception as e:
            self.send_error(500, str(e))

if __name__ == "__main__":
    # Ensure we bind to all interfaces or just localhost
    # Using 0.0.0.0 allows access from other devices, localhost restricts.
    # localhost is safer for development.
    Handler = ProxyRequestHandler
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Serving at http://localhost:{PORT}")
        print(f"Proxying {PROXY_PREFIX} to {TARGET_BASE}")
        httpd.serve_forever()
