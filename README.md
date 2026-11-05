# ShiftBridge Interactive Demo v0.1

**AI Maintenance Knowledge & Handover** — an English interactive concept demo for the fictional Aster Semiconductor · Fab 01.

Intended GitHub Pages URL: https://yu-rong321.github.io/shiftbridge-demo/

## Try the five workflows

1. **Facility Overview** — inspect ETCH-01 and ETCH-02 and select an equipment workspace.
2. **Record My Shift** — load a sample or enter an observation, check fields, review the snapshot, then explicitly confirm and simulate save.
3. **Maintenance History** — inspect only the active equipment's confirmed records. Filter by status or search. Open a source to view its exact content.
4. **Brief Next Shift** — review unresolved follow-ups separately from verified completed work, with source links on every entry.
5. **Equipment Knowledge Q&A** — ask about open issues, recent work or the listed SOP topics. Unsupported or cross-equipment questions abstain.

## Boundaries

All organizations, equipment, people, SOPs, observations and verifications are synthetic. Q&A uses deterministic topic rules, not an AI model. No NAS, UGREEN runtime or AI API is connected. No operational instructions or release authority are implied. Real UGREEN submission Skill ZIPs and proposal PDFs are not included or modified.

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
npm test            # 21 core evidence-contract tests
npm install        # optional local DOM test dependency
npm run test:ui     # jsdom workflow integration tests, no real-browser layout test
npm run check      # syntax and static asset checks
npm run build      # copies the six site assets to dist/ with version hashes
```

## GitHub Pages

In **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**. The included workflow runs core tests, DOM integration tests, static checks and the static packaging step before deployment. Only `dist/` is published. Pull requests run validation without publishing. The repository must have Pages enabled by an administrator; the ordinary Actions token cannot enable a new Pages site.

Hash routes and relative asset URLs support the `/shiftbridge-demo/` project subpath. A successful deployment is followed by HTTP checks of the public HTML, CSS, JS, JSON and version manifest.

## Source layout

- `data/demo.json`: six seed records, two equipment entries and four source SOP sections.
- `js/core.js`: pure validation, confirmation, equipment scoping, issue state, handover and Q&A.
- `js/app.js`: English DOM interface and browser-local simulated storage.
- `tests/`: domain acceptance tests. `ui/`: DOM workflow integration tests.
- `docs/`: design, implementation progress and verification notes.

No external fonts, images, scripts, analytics or runtime services are requested by the site. The equipment illustrations and bridge icon are original SVGs. This version is suitable for demonstrating the product concept, not real factory deployment.
