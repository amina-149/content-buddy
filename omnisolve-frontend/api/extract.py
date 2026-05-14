import json
import yt_dlp
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed_url = urlparse(self.path)
        url = parse_qs(parsed_url.query).get('url', [None])[0]
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept')
        self.end_headers()

        if self.command == 'OPTIONS':
            return
            
        if not url:
            self.wfile.write(json.dumps({'error': 'URL is required'}).encode())
            return
            
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
            'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        }
        
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                
                formats = []
                for f in info.get('formats', []):
                    # Only include formats with an actual URL and a video or audio codec
                    if f.get('url') and f.get('protocol') in ['https', 'http']:
                        resolution = f.get('resolution') or f.get('format_note') or ''
                        # Basic filtering to show nice formats
                        formats.append({
                            'format_id': f.get('format_id'),
                            'ext': f.get('ext'),
                            'resolution': resolution,
                            'filesize': f.get('filesize'),
                            'url': f.get('url'),
                            'vcodec': f.get('vcodec'),
                            'acodec': f.get('acodec'),
                            'has_video': f.get('vcodec') != 'none',
                            'has_audio': f.get('acodec') != 'none'
                        })
                
                # Sort formats by resolution/quality
                formats = sorted(formats, key=lambda x: (x['has_video'], x['has_audio']), reverse=True)
                        
                response = {
                    'title': info.get('title'),
                    'thumbnail': info.get('thumbnail'),
                    'duration': info.get('duration'),
                    'formats': formats
                }
                
                self.wfile.write(json.dumps(response).encode())
                
        except Exception as e:
            self.wfile.write(json.dumps({'error': str(e)}).encode())
