# Screener Universe Notes

## Current Scope

This release runs screeners against the catalog-backed searchable universe only.
Today that means the app evaluates the assets already curated in the local catalog and returns:

- live or cached quote-driven results
- per-row stale state
- data source metadata
- missing metric notes when a provider cannot supply the required inputs

## Contract Stability

The request contract already includes `universeSource`.
The current implementation supports:

- `catalog`

Future desktop releases can add broader market coverage without changing the frontend contract by registering another universe source implementation under a new key.

## Extension Pattern

To add a larger market universe later:

1. Implement a new source object that exposes the same `assets_for(asset_type)` behavior.
2. Register it in `backend/app/services/screener_service.py`.
3. Keep the response shape unchanged so the desktop UI can switch sources without a redesign.

Possible next sources:

- OpenBB-backed equities universe
- exchange-wide Binance spot universe
- locally cached custom watchlists or strategy universes

## Desktop Implication

The desktop shell is now wired to a stable screener API surface.
What is still missing for a truly complete experience is broader market coverage, more durable factor definitions, and richer handling when upstream data is partially unavailable.
