# Pengbo Agent Workflows

This document records the second-stage operating model for the ten Codex
agents installed for Pengbo. The agent definitions live in the personal Codex
directory; this repository file defines when they should be used together.

## Sub-Agent-First Execution Preference

For non-trivial work, the main thread should first evaluate whether an existing
configured sub-agent can materially advance the task and prefer using that
agent for a clearly bounded exploration, implementation, evidence, research,
or independent-verification subtask. The main thread retains scope, permission,
write ownership, integration, and final acceptance. Direct execution remains
correct for trivial, tightly coupled, urgent, or conflict-prone work; never add
delegation only for ceremony.

## Workflow A: feature or UI change

| Stage | Agent | Output |
|---|---|---|
| 1 | `pengbo-explorer` | Real code path, affected files, constraints, and existing tests |
| 2 | `Product Manager` | Problem statement, goals, non-goals, stories, acceptance criteria |
| 3 | `pengbo-task-board-sync` | Numbered executable tasks and aligned board/docs when requested |
| 4 | `Frontend Developer` or `pengbo-minimal-change-engineer` | Small implementation with targeted tests |
| 5 | `Evidence Collector` | Rendered UI, console/network, test, or build evidence |
| 6 | `Reality Checker` | Independent pass/fail/partial/unverified gate |
| 7 | `Technical Writer` | Updated user/developer documentation when the change requires it |

The implementation stage has one owner. Do not run the frontend and minimal
change agents as competing writers on the same files.

Evidence handoff rule: every stage that claims a result must leave a durable
artifact path (screenshot, JSON/log, report, or source map) for the next agent.
Chat-only summaries are context, not independent evidence. On Windows, record
the exact executable command used (`npm.cmd` rather than an ambiguous `npm`
alias when needed).

## Workflow B: internal stock/Crypto research mechanism

| Stage | Agent | Output |
|---|---|---|
| 1 | `Trend Researcher` | Dated source map, trend signals, counter-evidence, and research gaps |
| 2 | `Data Analyst` | Data definitions, cleaning record, analysis, uncertainty, and reproducible tables |
| 3 | `Reality Checker` | Challenge of unsupported claims, edge cases, and evidence coverage |
| 4 | `Technical Writer` | Reusable internal method note or research specification |

This workflow improves Pengbo's research process. It does not create an
automatic trader, investment recommendation engine, or order-execution path.

Research handoff rule: Data Analyst must persist a report artifact before
Reality Checker or Technical Writer reviews it. The artifact must include
source URLs and dates, retrieval time, raw-data access or snapshot status,
timezone/unit definitions, formulas, facts/inferences/unknowns, limitations,
and an explicit `failures` list. Missing raw snapshots or scripts remain
partial evidence and must not be silently upgraded to final statistics.

## Workflow C: bug or UI regression

```text
pengbo-explorer -> pengbo-minimal-change-engineer
                 -> Evidence Collector -> Reality Checker
```

Use the explorer only when the path is unclear. Use the evidence and reality
gates for user-visible or runtime claims; do not treat a passing unit test as
proof of correct packaged desktop rendering.

## Pilot acceptance checklist

Run one real example of each before changing the roster:

- one Pengbo UI feature;
- one existing bug or regression;
- one internal stock/Crypto research-mechanism question.

For each pilot, record:

1. whether the selected agent was the narrowest useful choice;
2. whether the output cited real files, commands, or dated sources;
3. whether any agent edited outside its assigned scope;
4. whether the final claim had an independent evidence/quality gate; and
5. which instruction, if any, needs revision.

The current product remains local-first: preserve the existing task-board
numbering, do not expose provider secrets, and keep execution explicitly gated.

Packaged pilot rule: when a pilot affects desktop startup or packaging, record
the installer source path and build timestamp, rebuild when the source changed,
and do not call an old installed artifact current-source signoff. For locked or
permission-gated routes, record both the expected blocked state and which
dependent checks were skipped.
