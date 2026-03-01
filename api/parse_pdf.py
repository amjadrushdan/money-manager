"""
Vercel Serverless Function — PDF Parser
Phase 2: accepts multipart PDF upload, returns parsed transactions JSON
"""

from http.server import BaseHTTPRequestHandler
import json


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        self.send_response(501)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(
            json.dumps({"error": "PDF parsing not implemented yet (Phase 2)"}).encode()
        )
