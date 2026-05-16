from __future__ import annotations

import re

from ..data_seed import AssetCatalogEntry


class FilingsProvider:
    def __init__(self, identity: str | None) -> None:
        self.identity = identity

    @property
    def is_configured(self) -> bool:
        return bool(self.identity)

    @property
    def credential_summary(self) -> str | None:
        if not self.identity:
            return None

        identity = self.identity.strip()
        if not identity:
            return None

        email_match = re.search(r"([A-Z0-9._%+-]+)@([A-Z0-9.-]+\.[A-Z]{2,})", identity, flags=re.IGNORECASE)
        if email_match is None:
            if len(identity) <= 6:
                return f"Identity {identity[:1]}...{identity[-1:]}"
            return f"Identity {identity[:3]}...{identity[-3:]}"

        local_part, domain = email_match.groups()
        if len(local_part) <= 2:
            masked_local = f"{local_part[:1]}..."
        else:
            masked_local = f"{local_part[:2]}...{local_part[-1:]}"
        masked_email = f"{masked_local}@{domain}"

        display_name = identity[: email_match.start()].strip()
        return masked_email if not display_name else f"{display_name} <{masked_email}>"

    def get_filings(self, entry: AssetCatalogEntry) -> list[dict[str, str]]:
        if not entry.is_us_equity:
            return []
        if not self.identity:
            raise ValueError("EDGAR_IDENTITY is required to fetch SEC filings.")

        from edgar import Company, set_identity

        set_identity(self.identity)
        company = Company(entry.symbol)
        filings = company.get_filings(form=["10-K", "10-Q", "8-K"])
        items: list[dict[str, str]] = []
        for filing in filings[:3]:
            headline = (
                f"{filing.company} {filing.form} filed"
                if not getattr(filing, "items", None)
                else f"{filing.company} {filing.form} items {filing.items}"
            )
            items.append(
                {
                    "type": filing.form,
                    "filed_at": filing.filing_date.isoformat(),
                    "headline": headline,
                    "status": "live",
                }
            )
        return items
