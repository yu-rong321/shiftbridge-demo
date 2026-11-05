# ShiftBridge Interactive Demo v0.4 — Trustworthy Knowledge Continuity

**AI Maintenance Knowledge & Handover** — an English interactive concept demo for the fictional Aster Semiconductor · Fab 01.

Intended GitHub Pages URL: https://yu-rong321.github.io/shiftbridge-demo/

## Try the five workflows

1. **Facility Overview** — inspect ETCH-01 and ETCH-02 and select an equipment workspace.
2. **Record My Shift** — enter a narrative using a documented, limited pattern; generate a deterministic structured draft (never real AI), edit fields, and explicitly confirm before simulated local save. Manual entry remains available.
3. **Maintenance History** — inspect only the active equipment's confirmed records. Filter by status or search. Open a source to view its exact content.
4. **Brief Next Shift** — review unresolved follow-ups separately from verified completed work, with source links on every entry.
5. **Equipment Knowledge Q&A** — ask about open issues, recent work or listed version-aware SOP topics. Every supported answer cites synthetic evidence.

The Facility Overview also includes **Start guided demo**, a five-step visitor flow: explore ETCH-01 → inspect example narrative → review and confirm → inspect handover → ask with citations. The guide never resets previous confirmed browser data and can be exited at any time. Unsupported or cross-equipment questions abstain.

## Evidence integrity and three-shift walkthrough (v0.4)

The overview now includes a **three-shift evidence trail** for the fictional ETCH-01 issue `ISS-103`. Each of its three source records can be opened independently: `REC-104` (OPEN, observation logged), `REC-105` (MONITORING, issue recurred), and `REC-106` (RESOLVED only after a separately recorded synthetic verification). This is a complete traceable example, not a claim that equipment was released for production.

New browser-local observations more than five minutes in the future are rejected. A later entry for an existing issue must have a strictly newer observation time; equal/older timestamps are rejected instead of silently changing the issue's latest handover state. Previously recorded synthetic seed history remains unchanged. This is a conservative **demo policy**: the browser clock and localStorage are not trusted production audit infrastructure.

The fixed Q&A refuses mixed SOP + issue-status requests instead of answering only one part. It also recognizes issue-scoped maintenance questions such as "What was checked for ISS-101?". All supported answers still cite their source records, and unsupported topics abstain.

Acceptance matrix and browser-check list: [`docs/v0.4-verification.md`](docs/v0.4-verification.md). An evidence-based review of the separate UGREEN Round 1 Skill ZIP and proposal PDF, including the major scope and schema differences from this website, is in [`docs/ugreen-skill-proposal-alignment-v0.4.md`](docs/ugreen-skill-proposal-alignment-v0.4.md). **The two submission candidates were inspected but not modified.**

## Natural-language demonstration and cross-shift continuity (v0.3)

`data/demo.json.guidedDemoNote` supplies one original fictional ETCH-01 technician narrative. The on-device JavaScript extractor (`parseShiftNote`) uses strict, transparent rules and copies only **explicit** observation, action, author, shift, equipment, OPEN/MONITORING status and next-action text. It refuses unknown/conflicting/cross-equipment notes and does not invent facts, diagnose equipment, infer a root cause, call an AI model or bypass human review. Other text can be entered as manual structured fields.

Once a new browser-local issue is confirmed, its `ISS-LOCAL-*` ID becomes selectable on later shifts for the **same equipment**. A follow-up maintains that ID but has its own `LOCAL-*` record and confirmation. Rehydration checks prior confirmed records in order; unconfirmed, forged, missing-parent, cross-equipment and out-of-order dependent references are excluded. Handover uses the latest confirmed observation **per issue**, leaving historic source entries intact. Existing v0.1 locally saved records are still supported; the existing localStorage key is intentionally unchanged.

This is an append-only demonstration inside one browser, **not** authenticated multi-user issue tracking or shared NAS persistence.

## SOP version control (v0.2)

The fictional dataset evaluates SOP approval and validity against its fixed `scenarioDate` (2026-11-05), **not the viewer's system clock**. Each SOP revision has `versionStatus`, `approvalStatus`, `effectiveDate`, `retiredDate`, `supersedesId`, and `supersededById` metadata. `ACTIVE` is an approval label only within this fictional scenario, not real facility authorization. `SUPERSEDED` and `EXPIRED` revisions remain available for historical source inspection but are excluded from current-procedure answers.

Normal SOP Q&A selects exactly one effective approved revision per equipment/topic and cites only that revision. Historical-version questions cite the archived source **and** the current successor, reporting their statuses and dates without quoting old operating instructions or authorizing use. Missing current revisions, conflicting active revisions, broken successor links, invalid approval or date metadata, and cross-equipment replacements fail closed. A historical question about an unsupported topic is explicitly unanswered. Details: [`docs/sop-version-control-v0.2.md`](docs/sop-version-control-v0.2.md).

## Boundaries

All organizations, equipment, people, SOPs, observations and verifications are synthetic. Q&A uses deterministic evidence and SOP-version rules, not an AI model. No NAS, UGREEN runtime or AI API is connected. No operational instructions or release authority are implied. Real UGREEN submission Skill ZIPs and proposal PDFs are not included or modified.

Confirmed demo records are stored only in this browser's localStorage under `shiftbridge.demo.v01.records`. They survive reloads in the same browser/origin but are not shared between users or devices. Confirmation is an interaction demonstration, not authenticated approval. Local browser state is editable by its owner and is not a trusted audit store. Drafts remain in memory and are discarded when equipment changes or the page reloads.

An OPEN record stays OPEN regardless of its action text. A RESOLVED record requires a verification field; the demo cannot independently verify that evidence. The latest confirmed observation per issue determines its handover state. Historic record status remains unchanged. Related-issue selection in v0.1 supports the seeded issues; a new observation receives its own local issue ID. No editing or deletion of individual confirmed records is offered.

Reset asks for confirmation and removes only this demo's browser-local records. If storage is blocked or exhausted, the interface reports failure and does not claim a successful save. A conflicting change in another browser tab blocks further saving until reload.

## Run locally

Node.js 24 is used for verification. The website itself has no runtime dependencies or build framework.

```sh
npm run serve
```

Open http://127.0.0.1:4173. Use HTTP(S); opening the HTML as a filesystem URL cannot fetch JSON modules reliably.

```sh
npm test            # core evidence-contract tests
npm install        # optional local DOM test dependency
npm run test:ui     # jsdom workflow integration tests, no real-browser layout test
npm run check      # syntax and static asset checks
npm run build      # copies the six site assets to dist/ with version hashes
```

## GitHub Pages

In **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**. The included workflow runs core tests, DOM integration tests, static checks and the static packaging step before deployment. Only `dist/` is published. Pull requests run validation without publishing. The repository must have Pages enabled by an administrator; the ordinary Actions token cannot enable a new Pages site.

Hash routes and relative asset URLs support the `/shiftbridge-demo/` project subpath. A successful deployment is followed by HTTP checks of the public HTML, CSS, JS, JSON and version manifest.

## Source layout

- `data/demo.json`: nine seed records (including a three-shift same-issue case), two equipment entries, four current SOP sections, two archived revisions and a guided synthetic shift note.
- `js/core.js`: pure validation, confirmation, equipment scoping, issue state, handover and Q&A.
- `js/app.js`: English DOM interface and browser-local simulated storage.
- `tests/`: domain acceptance tests. `ui/`: DOM workflow integration tests.
- `docs/`: design, implementation progress and verification notes.

No external fonts, images, scripts, analytics or runtime services are requested by the site. `npm test` and jsdom `npm run test:ui` check narrative parsing, issue chronology, three-shift provenance, guided path, safety refusal and prior v0.2/v0.3 behavior. The equipment illustrations and bridge icon are original SVGs. This version is suitable for demonstrating the product concept, not real factory deployment. Its five website views must not be presented as five implemented UGREEN Skill modes; the reviewed Round 1 Skill candidate has only Record My Shift and Brief Next Shift.
