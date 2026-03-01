"""
Vercel Serverless Function — Transactions API
Phase 1: stub (client uses Supabase JS SDK directly)
Phase 2+: will handle PDF-parsed bulk inserts
"""

from http.server import BaseHTTPRequestHandler
import json


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"status": "ok", "message": "transactions endpoint"}).encode())
