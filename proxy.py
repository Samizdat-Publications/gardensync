#!/usr/bin/env python3
"""
GardenSync API Proxy Server
Handles CORS for browser-to-API requests (Gemini + Claude).
Run: python3 proxy.py
Serves the app on http://localhost:8080 and proxies /api/gemini/* and /api/claude/*.
"""

import http.server
import json
import os
import re
import urllib.request
import urllib.error
from urllib.parse import urlparse

PORT = 8080
GEMINI_API_BASE = "https://generativelanguage.googleapis.com"
CLAUDE_API_BASE = "https://api.anthropic.com"
ALLOWED_ORIGIN = f"http://localhost:{PORT}"
MAX_BODY_SIZE = 10 * 1024 * 1024  # 10 MB
# Only allow alphanumeric, slashes, hyphens, dots, colons, and query strings
SAFE_PATH_RE = re.compile(r'^[a-zA-Z0-9/_\-.:?&=%+]+$')
# Blocked file patterns for static file serving
BLOCKED_PATHS = ('.env', '.git', '.claude/settings.json')
ALLOWED_EXTENSIONS = ('.html', '.css', '.js', '.json', '.png', '.jpg', '.jpeg',
                      '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.webp',
                      '.webmanifest', '.map')


class GardenSyncHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # CORS: restrict to localhost only
        self.send_header('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, x-goog-api-key, x-api-key, anthropic-version')
        # Disable caching for dev
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_GET(self):
        """Serve static files with path restrictions"""
        # Block sensitive files
        path_lower = self.path.lower().split('?')[0]
        for blocked in BLOCKED_PATHS:
            if blocked in path_lower:
                self.send_response(403)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Forbidden"}).encode())
                return
        super().do_GET()

    def do_OPTIONS(self):
        """Handle CORS preflight"""
        self.send_response(200)
        self.end_headers()

    def _validate_proxy_path(self, path):
        """Validate proxy path to prevent SSRF and path traversal"""
        if '..' in path or '@' in path or '\\' in path:
            return None
        if not SAFE_PATH_RE.match(path):
            return None
        return path

    def _read_body(self):
        """Read request body with size limit"""
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length > MAX_BODY_SIZE:
            return None
        return self.rfile.read(content_length)

    def _send_error(self, code, message="Internal server error"):
        """Send generic error without leaking internals"""
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({"error": {"message": message}}).encode())

    def do_POST(self):
        """Proxy POST requests to Gemini or Claude API"""
        if self.path.startswith('/api/gemini/'):
            self.proxy_to_gemini()
        elif self.path.startswith('/api/claude/'):
            self.proxy_to_claude()
        else:
            self._send_error(404, "Not found")

    def proxy_to_gemini(self):
        try:
            gemini_path = self.path.replace('/api/gemini/', '/')
            validated_path = self._validate_proxy_path(gemini_path)
            if not validated_path:
                self._send_error(400, "Invalid proxy path")
                return

            target_url = GEMINI_API_BASE + validated_path

            # Verify the constructed URL still points to the intended host
            parsed = urlparse(target_url)
            if parsed.hostname != urlparse(GEMINI_API_BASE).hostname:
                self._send_error(400, "Invalid proxy target")
                return

            body = self._read_body()
            if body is None:
                self._send_error(413, "Request body too large")
                return

            api_key = self.headers.get('x-goog-api-key', '')

            req = urllib.request.Request(
                target_url,
                data=body,
                headers={
                    'Content-Type': 'application/json',
                    'x-goog-api-key': api_key,
                },
                method='POST'
            )

            # Use default SSL context (proper cert verification)
            with urllib.request.urlopen(req, timeout=120) as resp:
                response_data = resp.read()
                self.send_response(resp.status)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(response_data)

        except urllib.error.HTTPError as e:
            error_body = e.read().decode('utf-8', errors='replace')
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(error_body.encode())

        except Exception as e:
            print(f"\033[31m[ERROR]\033[0m Gemini proxy error: {e}")
            self._send_error(500, "Proxy request failed")

    def proxy_to_claude(self):
        """Proxy POST requests to Anthropic Claude API"""
        try:
            claude_path = self.path.replace('/api/claude/', '/')
            validated_path = self._validate_proxy_path(claude_path)
            if not validated_path:
                self._send_error(400, "Invalid proxy path")
                return

            target_url = CLAUDE_API_BASE + validated_path

            # Verify the constructed URL still points to the intended host
            parsed = urlparse(target_url)
            if parsed.hostname != urlparse(CLAUDE_API_BASE).hostname:
                self._send_error(400, "Invalid proxy target")
                return

            body = self._read_body()
            if body is None:
                self._send_error(413, "Request body too large")
                return

            api_key = self.headers.get('x-api-key', '')
            anthropic_version = self.headers.get('anthropic-version', '2023-06-01')

            req = urllib.request.Request(
                target_url,
                data=body,
                headers={
                    'Content-Type': 'application/json',
                    'x-api-key': api_key,
                    'anthropic-version': anthropic_version,
                },
                method='POST'
            )

            # Use default SSL context (proper cert verification)
            with urllib.request.urlopen(req, timeout=120) as resp:
                response_data = resp.read()
                self.send_response(resp.status)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(response_data)

        except urllib.error.HTTPError as e:
            error_body = e.read().decode('utf-8', errors='replace')
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(error_body.encode())

        except Exception as e:
            print(f"\033[31m[ERROR]\033[0m Claude proxy error: {e}")
            self._send_error(500, "Proxy request failed")

    def log_message(self, format, *args):
        """Custom log with color"""
        if '/api/gemini/' in str(args[0]):
            print(f"\033[32m[GEMINI]\033[0m {args[0]}")
        elif '/api/claude/' in str(args[0]):
            print(f"\033[35m[CLAUDE]\033[0m {args[0]}")
        elif '404' in str(args[1]) if len(args) > 1 else False:
            print(f"\033[31m[404]\033[0m {args[0]}")
        else:
            # Suppress normal static file logs to reduce noise
            pass


if __name__ == '__main__':
    import subprocess
    import signal
    import sys

    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    # Force UTF-8 output on Windows
    if sys.platform == 'win32':
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')

    # Auto-kill anything already on the port
    try:
        if sys.platform == 'win32':
            result = subprocess.run(
                ['netstat', '-ano'], capture_output=True, text=True
            )
            for line in result.stdout.splitlines():
                if f':{PORT}' in line and 'LISTENING' in line:
                    pid = line.strip().split()[-1]
                    if pid.isdigit():  # Validate PID is numeric
                        subprocess.run(['taskkill', '/F', '/PID', pid],
                                       capture_output=True)
                        print(f"Killed old process on port {PORT} (PID {pid})")
                        import time
                        time.sleep(1)
        else:
            result = subprocess.run(['lsof', '-ti', f':{PORT}'], capture_output=True, text=True)
            if result.stdout.strip():
                for pid in result.stdout.strip().split('\n'):
                    try:
                        os.kill(int(pid), signal.SIGKILL)
                        print(f"Killed old process on port {PORT} (PID {pid})")
                    except Exception:
                        pass
                import time
                time.sleep(1)
    except Exception:
        pass

    print(f"""
  GARDENSYNC // FOOD NOT BOMBS CANTON
  Server running on http://localhost:{PORT}
  Gemini API proxy active at /api/gemini/*
  Claude API proxy active at /api/claude/*
  Press Ctrl+C to stop
""")

    import socketserver
    socketserver.TCPServer.allow_reuse_address = True
    # Bind to localhost only — not accessible from network
    # ThreadingHTTPServer so a stuck/aborted client connection doesn't block
    # other requests (single-threaded HTTPServer hung when browser refreshes
    # piled up half-aborted requests).
    server = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), GardenSyncHandler)
    server.allow_reuse_address = True
    server.daemon_threads = True
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        server.server_close()
