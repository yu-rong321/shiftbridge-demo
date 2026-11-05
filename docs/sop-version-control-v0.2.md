# ShiftBridge v0.2 — SOP Version Control Contract

## Scope

This contract applies **only** to the synthetic Aster Semiconductor Fab 01 interactive demo, not the UGREEN Uliya runtime, a real manufacturer service manual, or any industrial control system.

The v0.1 maintenance workflow, equipment isolation and browser-local confirmed records remain unchanged. All SOP records are fictional. Do not claim external certification or real operating approval.

## Deterministic version fields

Each `data/demo.json.sops[]` revision has:

| Field | Meaning |
| --- | --- |
| `id` | Unique immutable citation/source identifier |
| `equipmentId`, `topic` | Exact permitted equipment and topic |
| `document`, `section`, `revision` | Human-readable document identity |
| `versionStatus` | `ACTIVE`, `SUPERSEDED`, `EXPIRED`, `WITHDRAWN` |
| `approvalStatus` | `APPROVED` in this synthetic test only |
| `effectiveDate` | ISO day, inclusive beginning of synthetic validity |
| `retiredDate` | ISO day, exclusive end of validity, or null for current revisions |
| `supersedesId` | Direct prior revision ID or null |
| `supersededById` | Direct successor revision ID or null |

The evaluation time is fixed to `data/demo.json.scenarioDate`. This prevents different real-world dates or browser time zones from producing contradictory demo answers.

Demo fixtures: `SOP-01-2-OLD` (SUPERSEDED, replaced by `SOP-01-2`), `SOP-02-2-OLD` (EXPIRED, replaced by `SOP-02-2`). The four previously defined current SOP sections remain `ACTIVE`.

## Evidence gates

1. Topic and equipment must match exactly.
2. Required dates, approval state, revision status and supersession metadata must be valid.
3. A replaced revision must link to a reciprocal successor in the **same** equipment/topic, with an aligned transition date.
4. Each requested equipment/topic must have **exactly one** effective `ACTIVE` SOP revision at the scenario date.
5. Normal SOP queries return only the current approved revision and its source ID. Historical revisions are never substituted.
6. Historical/revoked SOP queries return archived version **status and dates** plus the current successor, citing both source IDs. Old procedures are not quoted as directions.
7. Missing current approval, overlapping active revisions, broken chains, date anomalies or cross-equipment successors require a **No supported answer** result.
8. Operational decisions, interlock bypass, setpoints, recipes and repair authorization remain unsupported regardless of the SOP version.

## Test examples

| Selected equipment | Question | Expected outcome |
| --- | --- | --- |
| ETCH-01 | What does the SOP say about pumpdown? | Current `SOP-01-2` only |
| ETCH-01 | Should I follow the old SOP for the pumpdown issue? | Historical `SOP-01-2-OLD` is SUPERSEDED; cite successor `SOP-01-2`; **do not authorize use** |
| ETCH-02 | Is the old reflected RF SOP still valid? | Historical `SOP-02-2-OLD` is EXPIRED; cite successor `SOP-02-2` |
| ETCH-02 | What does the SOP say about pumpdown? | Abstain (out of scope) |
| ETCH-01 | What is the current SOP version for pumpdown? | Active revision and effective date |
| ETCH-01 | Can I bypass the interlock using the old SOP? | Abstain |
| Any | Multiple active SOPs for same scope | Abstain |
| Any | Expired / missing current SOP | Abstain |
| Any | Invalid or cross-equipment supersession | Abstain |

## Verification limits

GitHub Actions `npm test`, `npm run test:ui`, `npm run check` and `npm run build` verify deterministic contract logic and simulated DOM workflow only. They do **not** establish a real AI model's response quality, real NAS permissions, actual manufacturing SOP currency, safety suitability or human identity verification.
