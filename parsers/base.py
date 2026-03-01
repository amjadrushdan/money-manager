"""
Base bank parser — all bank-specific parsers extend this class.
Adding a new bank = create one new file + class, no touching existing code.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date
from typing import Optional


@dataclass
class Transaction:
    date: date
    description: str
    amount: float          # always positive
    type: str              # 'debit' | 'credit'
    category: Optional[str] = None
    raw_text: Optional[str] = None
    source: str = 'pdf'


class BaseBankParser(ABC):
    """Abstract base class for all bank PDF parsers."""

    @abstractmethod
    def can_parse(self, text: str) -> bool:
        """Return True if this parser recognises the PDF content."""
        ...

    @abstractmethod
    def parse(self, pdf_path: str) -> list[Transaction]:
        """Extract transactions from the PDF. Returns list of Transaction objects."""
        ...

    def _categorize(self, description: str) -> str:
        """Simple keyword-based categorization. Override in subclass if needed."""
        desc = description.lower()
        if any(kw in desc for kw in ['mcd', "mcdonald", 'kfc', 'pizza', 'restaurant', 'cafe', 'food', 'mamak', 'grab food']):
            return 'food'
        if any(kw in desc for kw in ['grab', 'myrapid', 'mrt', 'lrt', 'petrol', 'petronas', 'shell', 'petron', 'touch n go', 'tng']):
            return 'transport'
        if any(kw in desc for kw in ['tnb', 'telekom', 'unifi', 'maxis', 'celcom', 'digi', 'time', 'syabas', 'indah water']):
            return 'bills'
        if any(kw in desc for kw in ['netflix', 'spotify', 'cinema', 'gsc', 'tgv', 'game', 'steam']):
            return 'entertainment'
        if any(kw in desc for kw in ['shopee', 'lazada', 'zalora', 'h&m', 'zara', 'ikea', 'mr diy']):
            return 'shopping'
        if any(kw in desc for kw in ['clinic', 'hospital', 'pharmacy', 'guardian', 'watson', 'doctor']):
            return 'health'
        if any(kw in desc for kw in ['university', 'college', 'school', 'tuition', 'education']):
            return 'education'
        return 'others'
