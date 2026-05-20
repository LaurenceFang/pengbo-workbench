# First Issue

## Candidate area

Choose a safe public contribution area:

- Documentation clarity.
- No-key demo guidance.
- Read-only Data Sources copy.
- Research-flow notes.
- Source-level UI copy polish.
- Pure tests that do not require credentials.

## Proposed change

Describe the small change you want to make.

## Validation plan

List the source-level checks you expect to run:

```powershell
npm run check:public-boundary
npm run typecheck
npm run build
```

## Safety boundary

This template is not for hosted support, signed binary release support, live
trading support, public API operation, or credential debugging. Do not include
secrets, local runtime data, Stronghold vaults, real account identifiers, or
unredacted logs.
