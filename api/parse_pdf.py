"""
Vercel Serverless Function — PDF Parser
POST /api/parse_pdf
Accepts multipart PDF upload, parses transactions, inserts into Supabase.
"""

import cgi
import json
import os
import sys
import tempfile
from http.server import BaseHTTPRequestHandler

# Allow importing from parsers/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from supabase import create_client
from parsers.public_bank import PublicBankParser
import pdfplumber


PARSERS = [PublicBankParser()]


def _get_supabase(auth_header: str):
    url = os.environ['SUPABASE_URL']
    service_key = os.environ['SUPABASE_SERVICE_KEY']
    client = create_client(url, service_key)
    # Set the user JWT so RLS policies apply correctly
    if auth_header and auth_header.startswith('Bearer '):
        client.auth.set_session(auth_header[7:], '')
    return client


def _detect_parser(pdf_path: str):
    with pdfplumber.open(pdf_path) as pdf:
        text = '\n'.join(page.extract_text() or '' for page in pdf.pages[:2])
    for parser in PARSERS:
        if parser.can_parse(text):
            return parser
    return None


def _get_or_create_account(supabase, user_id: str, bank_name: str) -> str:
    result = supabase.table('accounts') \
        .select('id') \
        .eq('user_id', user_id) \
        .eq('bank_name', bank_name) \
        .limit(1) \
        .execute()

    if result.data:
        return result.data[0]['id']

    insert = supabase.table('accounts').insert({
        'user_id': user_id,
        'bank_name': bank_name,
        'account_type': 'credit',
    }).execute()
    return insert.data[0]['id']


def _deduplicate(supabase, account_id: str, transactions: list) -> list:
    """Remove transactions already in the DB (match on account_id + date + description + amount)."""
    if not transactions:
        return []

    existing = supabase.table('transactions') \
        .select('date, description, amount') \
        .eq('account_id', account_id) \
        .execute()

    existing_set = {
        (r['date'], r['description'], float(r['amount']))
        for r in (existing.data or [])
    }

    return [
        t for t in transactions
        if (str(t.date), t.description, t.amount) not in existing_set
    ]


class handler(BaseHTTPRequestHandler):

    def do_POST(self):
        auth = self.headers.get('Authorization', '')
        content_type = self.headers.get('Content-Type', '')

        if 'multipart/form-data' not in content_type:
            self._respond(400, {'error': 'Expected multipart/form-data'})
            return

        # Parse multipart body
        environ = {
            'REQUEST_METHOD': 'POST',
            'CONTENT_TYPE': content_type,
            'CONTENT_LENGTH': self.headers.get('Content-Length', '0'),
        }
        form = cgi.FieldStorage(
            fp=self.rfile,
            headers=self.headers,
            environ=environ,
        )

        pdf_field = form.get('file')
        if pdf_field is None or not hasattr(pdf_field, 'file'):
            self._respond(400, {'error': 'No file field in request'})
            return

        user_id = form.getvalue('user_id')
        if not user_id:
            self._respond(400, {'error': 'user_id is required'})
            return

        # Save PDF to temp file
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
            tmp.write(pdf_field.file.read())
            tmp_path = tmp.name

        try:
            parser = _detect_parser(tmp_path)
            if parser is None:
                self._respond(422, {'error': 'Unsupported bank statement format'})
                return

            transactions = parser.parse(tmp_path)

            supabase = _get_supabase(auth)
            account_id = _get_or_create_account(supabase, user_id, 'Public Bank')
            new_txs = _deduplicate(supabase, account_id, transactions)

            if new_txs:
                rows = [
                    {
                        'account_id': account_id,
                        'date': str(t.date),
                        'description': t.description,
                        'amount': t.amount,
                        'type': t.type,
                        'category': t.category,
                        'source': 'pdf',
                        'raw_text': t.raw_text,
                    }
                    for t in new_txs
                ]
                supabase.table('transactions').insert(rows).execute()

            self._respond(200, {
                'inserted': len(new_txs),
                'duplicates_skipped': len(transactions) - len(new_txs),
                'total_parsed': len(transactions),
            })

        except Exception as e:
            self._respond(500, {'error': str(e)})

        finally:
            os.unlink(tmp_path)

    def _respond(self, status: int, body: dict):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(body).encode())
