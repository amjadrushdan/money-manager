"""
Public Bank PDF Statement Parser (Phase 2)
"""

from .base import BaseBankParser, Transaction


class PublicBankParser(BaseBankParser):
    """Parser for Public Bank savings/current account statements."""

    def can_parse(self, text: str) -> bool:
        return 'public bank' in text.lower() or 'publicbank' in text.lower()

    def parse(self, pdf_path: str) -> list[Transaction]:
        # Phase 2 implementation
        raise NotImplementedError("Public Bank parser coming in Phase 2")
