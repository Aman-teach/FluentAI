import http.server
import socketserver
import urllib.request
import urllib.error
import sys

PORT = 8080

class ProxyHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        url = None
        if self.path == '/api/gemini':
            # Google Gemini OpenAI-compatible endpoint
            url = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
        elif self.path == '/api/nvidia':
            # NVIDIA NIM OpenAI-compatible endpoint
            url = 'https://integrate.api.nvidia.com/v1/chat/completions'
        elif self.path == '/api/zerog':
            # 0G Private Computer endpoint
            url = 'https://router-api.0g.ai/v1/chat/completions'

        if url:
            try:
                # Read the request body
                content_length = int(self.headers.get('Content-Length', 0))
                post_data = self.rfile.read(content_length) if content_length > 0 else b''

                auth_header = self.headers.get('Authorization')
                
                # Support loading API keys from local environment variables if frontend hasn't provided one
                if not auth_header or auth_header.strip() == 'Bearer' or auth_header.strip() == 'Bearer null':
                    import os
                    if self.path == '/api/gemini':
                        env_var = 'GEMINI_API_KEY'
                    elif self.path == '/api/zerog':
                        env_var = 'ZEROG_API_KEY'
                    else:
                        env_var = 'NVIDIA_API_KEY'
                    env_key = os.environ.get(env_var)
                    if env_key:
                        auth_header = f"Bearer {env_key}"

                req_headers = {
                    'Content-Type': 'application/json'
                }
                if auth_header:
                    req_headers['Authorization'] = auth_header

                req = urllib.request.Request(
                    url,
                    data=post_data,
                    headers=req_headers,
                    method='POST'
                )

                # Send request to the selected API server
                with urllib.request.urlopen(req, timeout=45) as response:
                    res_data = response.read()
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(res_data)

            except urllib.error.HTTPError as e:
                err_data = e.read()
                self.send_response(e.code)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(err_data)
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'text/plain')
                self.end_headers()
                self.wfile.write(str(e).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

# Set up the server
handler = ProxyHandler
socketserver.ThreadingTCPServer.allow_reuse_address = True

with socketserver.ThreadingTCPServer(("127.0.0.1", PORT), handler) as httpd:
    print(f"Proxy server running at http://localhost:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        sys.exit(0)
