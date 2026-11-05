# ShiftBridge Interactive Demo v0.1

The user authorizes implementation, testing and public GitHub Pages deployment of an English, white engineering workspace in the existing shiftbridge-demo repository. Scope: Facility Overview, Record My Shift, Maintenance History, Brief Next Shift and Equipment Knowledge Q&A. All people, equipment, documents and observations are synthetic.

## Architecture decision

Use buildless HTML/CSS/ES modules with JSON fixtures and localStorage. This matches the requested stack, works under a GitHub Pages project subpath and needs no credentials or production infrastructure. A framework or live AI service adds runtime dependencies without helping the requested concept demonstration. Q&A is explicitly deterministic retrieval with supported topics, source citations and abstention. It does not represent a deployed AI model or UGREEN integration.

## Evidence rules

- Scope every query, history, issue and citation by equipment ID. Reject explicit requests for a different or unknown equipment ID.
- Drafts never enter the confirmed dataset. Review snapshots are invalidated by edits. Saving requires an explicit human checkbox and current valid snapshot.
- localStorage is simulated browser-local persistence, not an authentication, audit, security or multiuser boundary. No NAS/API writes.
- Issue state is the latest confirmed record for its issue ID. OPEN remains OPEN even if free text claims a repair. RESOLVED requires verification evidence. There is no inference of repair from actions alone.
- Every handover claim and answer item carries a resolvable source. Unsupported questions produce an explicit no-evidence answer. SOPs describe fictional checks and do not override current issue status.
- Imported/restored local records are revalidated and deduplicated. Invalid data is excluded and the interface reports degraded persistence.

## Experience

Left navigation, persistent site/equipment context, responsive content, source drawer, keyboard focus, form labels and live validation. The overview presents two equipment cards, open follow-ups and a short guided demo. Recording uses three stages: enter, review, confirmed simulated save. History can filter by equipment/status and inspect records. Handover separates open follow-ups from verified completed work. Q&A offers supported example questions, current equipment scope and citation chips. Reset removes only this demo's local state after an in-app confirmation.

## Acceptance

Automated domain tests cover the four user constraints plus invalid fields, issue transitions, edited reviews, corrupted storage, unsupported questions, cross-equipment requests and source resolution. DOM integration tests exercise the record flow, citations, navigation, local reload, isolation and responsive CSS. CI gates publication on tests/check/build. Public verification checks the deployed HTML, JS, CSS, JSON and browser behavior when available. Existing UGREEN ZIP/PDF files are outside this checkout and untouched.
