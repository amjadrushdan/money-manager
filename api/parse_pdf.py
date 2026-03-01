"""
Vercel Serverless Function — PDF Parser
POST /api/parse_pdf
Accepts multipart PDF upload, parses transactions, inserts into Supabase.
"""

import json
import os
import sys
import tempfile

# Allow importing from parsers/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from supabase import create_client
from parsers.public_bank import PublicBankParser
import pdfplumber


PARSERS = [PublicBankParser()]


def _get_supabase():
    url = os.environ['SUPABASE_URL']
    service_key = os.environ['SUPABASE_SERVICE_KEY']
    return create_client(url, service_key)


def _detect_parser(pdf_path: str):
    with pdfplumber.open(pdf_path) as pdf:
        text = '\n'.join(page.extract_text() or '' for page in pdf.pages[:2])
    for parser in PARSERS:
        if parser.can_parse(text):
            return parser
    return None


def _get_or_create_account(sb, user_id: str, bank_name: str) -> str:
    result = sb.table('accounts') \
        .select('id') \
        .eq('user_id', user_id) \
        .eq('bank_name', bank_name) \
        .limit(1) \
        .execute()

    if result.data:
        return result.data[0]['id']

    insert = sb.table('accounts').insert({
        'user_id': user_id,
        'bank_name': bank_name,
        'account_type': 'credit',
    }).execute()
    return insert.data[0]['id']


def _deduplicate(sb, account_id: str, transactions: list) -> list:
    if not transactions:
        return []

    existing = sb.table('transactions') \
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


def _json(status: int, body: dict):
    return {
        'statusCode': status,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps(body),
    }


def handler(request):
    if request.method != 'POST':
        return _json(405, {'error': 'Method not allowed'})

    content_type = request.headers.get('content-type', '')
    if 'multipart/form-data' not in content_type:
        return _json(400, {'error': 'Expected multipart/form-data'})

    form = request.form
    files = request.files

    pdf_file = files.get('file')
    if pdf_file is None:
        return _json(400, {'error': 'No file field in request'})

    user_id = form.get('user_id')
    if not user_id:
        return _json(400, {'error': 'user_id is required'})

    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
        pdf_file.save(tmp)
        tmp_path = tmp.name

    try:
        parser = _detect_parser(tmp_path)
        if parser is None:
            return _json(422, {'error': 'Unsupported bank statement format'})

        transactions = parser.parse(tmp_path)

        sb = _get_supabase()
        account_id = _get_or_create_account(sb, user_id, 'Public Bank')
        new_txs = _deduplicate(sb, account_id, transactions)

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
            sb.table('transactions').insert(rows).execute()

        return _json(200, {
            'inserted': len(new_txs),
            'duplicates_skipped': len(transactions) - len(new_txs),
            'total_parsed': len(transactions),
        })

    except Exception as e:
        return _json(500, {'error': str(e)})

    finally:
        os.unlink(tmp_path)
