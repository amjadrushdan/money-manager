"""
Public Bank credit card statement parser.
Handles the 4-column layout: Posting Date | Transaction Date | Description | Amount (RM)
"""

import re
from datetime import date, datetime
from typing import Optional

import pdfplumber

from .base import BaseBankParser, Transaction

# Months in the PDF use 3-letter English abbreviations
MONTH_MAP = {
    'JAN': 1, 'FEB': 2, 'MAR': 3, 'APR': 4,
    'MAY': 5, 'JUN': 6, 'JUL': 7, 'AUG': 8,
    'SEP': 9, 'OCT': 10, 'NOV': 11, 'DEC': 12,
}

# Rows to skip — not real transactions
SKIP_PATTERNS = [
    r'^previous balance',
    r'^finance charge',
    r'^card service tax',
    r'^this month total',
    r'^grand total',
    r'^jumlah besar',
    r'^invoice:',
    r'^\s*$',
]

_SKIP_RE = re.compile('|'.join(SKIP_PATTERNS), re.IGNORECASE)


def _should_skip(description: str) -> bool:
    return bool(_SKIP_RE.match(description.strip()))


def _parse_date(day_month: str, year: int) -> Optional[date]:
    """Parse '08 JAN' or '01 FEB' into a date object."""
    parts = day_month.strip().split()
    if len(parts) != 2:
        return None
    try:
        day = int(parts[0])
        month = MONTH_MAP.get(parts[1].upper())
        if not month:
            return None
        return date(year, month, day)
    except (ValueError, KeyError):
        return None


def _parse_amount(raw: str) -> tuple[float, str]:
    """
    Parse amount string. Returns (amount, type).
    '1,000.00CR' -> (1000.0, 'credit')
    '40.05'      -> (40.05, 'debit')
    """
    raw = raw.strip()
    is_credit = raw.upper().endswith('CR')
    cleaned = raw.upper().replace('CR', '').replace(',', '').strip()
    try:
        amount = float(cleaned)
        tx_type = 'credit' if is_credit else 'debit'
        return amount, tx_type
    except ValueError:
        return 0.0, 'debit'


def _extract_year(text: str) -> int:
    """Extract the statement year from 'STATEMENT DATE  07 FEB 2026'."""
    match = re.search(r'statement\s+date\s+\d{1,2}\s+\w+\s+(\d{4})', text, re.IGNORECASE)
    if match:
        return int(match.group(1))
    return datetime.now().year


class PublicBankParser(BaseBankParser):

    def can_parse(self, text: str) -> bool:
        return 'public bank' in text.lower() and 'penyata kad' in text.lower()

    def parse(self, pdf_path: str) -> list[Transaction]:
        transactions: list[Transaction] = []

        with pdfplumber.open(pdf_path) as pdf:
            full_text = '\n'.join(page.extract_text() or '' for page in pdf.pages)
            year = _extract_year(full_text)

            for page in pdf.pages:
                lines = (page.extract_text() or '').splitlines()
                for line in lines:
                    tx = self._parse_line(line, year)
                    if tx:
                        transactions.append(tx)

        return transactions

    def _parse_line(self, line: str, year: int) -> Optional[Transaction]:
        """
        Each transaction line looks like:
          08 JAN   06 JAN   PUTRAJAYA SENTRAL   PUTRAJAYA   MYS   4.70
          11 JAN   11 JAN   MOBILE BANKING PAYMENT RECD-THANK YOU   1,000.00CR

        Pattern: DD MMM  [DD MMM]  <description>  <amount>
        The posting date is always present; transaction date may be absent on some rows.
        """
        line = line.strip()
        if not line:
            return None

        # Match leading posting date: "08 JAN" or "01 FEB"
        date_re = r'^(\d{1,2}\s+[A-Z]{3})\s+'
        m = re.match(date_re, line, re.IGNORECASE)
        if not m:
            return None

        posting_str = m.group(1)
        rest = line[m.end():]

        # Optional transaction date right after posting date
        m2 = re.match(date_re, rest, re.IGNORECASE)
        if m2:
            tx_date_str = m2.group(1)
            rest = rest[m2.end():]
        else:
            tx_date_str = posting_str

        # Amount is the last token: digits/commas/dots optionally followed by CR
        amount_re = r'([\d,]+\.\d{2}(?:CR)?)\s*$'
        am = re.search(amount_re, rest, re.IGNORECASE)
        if not am:
            return None

        raw_amount = am.group(1)
        description = rest[:am.start()].strip()

        # Clean up trailing country code "MYS" and extra spaces
        description = re.sub(r'\s+MYS\s*$', '', description).strip()
        description = re.sub(r'\s{2,}', ' ', description)

        if not description or _should_skip(description):
            return None

        tx_date = _parse_date(tx_date_str, year)
        if not tx_date:
            return None

        # Handle year rollover: e.g. JAN statement with DEC transactions = previous year
        posting_date = _parse_date(posting_str, year)
        if posting_date and tx_date > posting_date:
            tx_date = tx_date.replace(year=year - 1)

        amount, tx_type = _parse_amount(raw_amount)
        if amount == 0:
            return None

        category = self._categorize(description)

        return Transaction(
            date=tx_date,
            description=description,
            amount=amount,
            type=tx_type,
            category=category,
            raw_text=line,
            source='pdf',
        )
