import http.server
import socketserver
import urllib.request
import urllib.error
import sys
import os
import json

PORT = 8080

def load_dotenv():
    try:
        if os.path.exists('.env'):
            with open('.env', 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith('#'):
                        continue
                    if '=' in line:
                        k, v = line.split('=', 1)
                        k = k.strip()
                        v = v.strip().strip("'").strip('"')
                        os.environ[k] = v
            print("Loaded environment from .env file successfully.")
    except Exception as e:
        print("Warning: could not load .env file:", e)

# Load environment variables from .env if present
load_dotenv()

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
        elif self.path == '/api/transcribe' or self.path == '/api/speak':
            try:
                import os
                dg_key = os.environ.get('DEEPGRAM_API_KEY')
                if not dg_key:
                    auth_header = self.headers.get('Authorization')
                    if auth_header and auth_header.startswith('Bearer '):
                        dg_key = auth_header.replace('Bearer ', '')
                
                if not dg_key:
                    self.send_response(401)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(b'{"error": "DEEPGRAM_API_KEY not configured on server"}')
                    return
                
                content_length = int(self.headers.get('Content-Length', 0))
                post_data = self.rfile.read(content_length) if content_length > 0 else b''
                print(f"[DEBUG] API request: path={self.path}, len={content_length}, body={post_data[:200]}")
                
                if self.path == '/api/transcribe':
                    dg_url = 'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&filler_words=true'
                    content_type = self.headers.get('Content-Type', 'audio/webm')
                else:
                    dg_url = 'https://api.deepgram.com/v1/speak?model=aura-asteria-en'
                    content_type = 'application/json'
                
                req = urllib.request.Request(
                    dg_url,
                    data=post_data,
                    headers={
                        'Content-Type': content_type,
                        'Authorization': f'Token {dg_key}'
                    },
                    method='POST'
                )
                
                with urllib.request.urlopen(req, timeout=45) as response:
                    res_data = response.read()
                    self.send_response(200)
                    self.send_header('Content-Type', response.headers.get('Content-Type', 'application/octet-stream'))
                    self.end_headers()
                    self.wfile.write(res_data)
                    
            except urllib.error.HTTPError as e:
                err_data = e.read()
                print(f"[DEBUG] Deepgram API HTTPError: status={e.code}, body={err_data}")
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

    def do_GET(self):
        if self.path == '/api/config':
            supabase_url = os.environ.get('SUPABASE_URL', '')
            supabase_anon_key = os.environ.get('SUPABASE_ANON_KEY', '')
            
            res_data = json.dumps({
                'supabaseUrl': supabase_url,
                'supabaseAnonKey': supabase_anon_key
            }).encode('utf-8')
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', self.headers.get('Origin', '*'))
            self.end_headers()
            self.wfile.write(res_data)
        else:
            super().do_GET()

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
