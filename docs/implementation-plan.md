# ShiftBridge v0.1 Implementation Plan

Goal: implement and publish the five requested workflows with source traceability.

Architecture: static ES modules and synthetic JSON. Pure domain functions power DOM rendering. GitHub Actions validates and uploads only dist/ to Pages.

Spec: docs/design.md. Execution is authorized by the user's development request.

## Tasks

- [ ] 1. Evidence model. Write tests for equipment boundaries, draft exclusion, current issue state, confirmation, validation and sourced Q&A. Observe failure, implement js/core.js and data/demo.json, run npm test.
- [ ] 2. Workspace. Implement index.html, css/styles.css, js/app.js and icon.svg. Verify record review invalidation, simulated save/reload, history, handover, Q&A, source drawer, keyboard and narrow screens.
- [ ] 3. Delivery. Add build/check/serve scripts, README and Pages workflow. Run tests/check/build, review delivered files, publish through GitHub connector, inspect Actions and verify the public URL.

## Review focus

LocalStorage failures must be visible. Unknown equipment IDs must abstain. Outdated or edited review snapshots cannot save. Source links must not expose another equipment record. A newly entered RESOLVED record requires evidence and must not silently close unrelated issues.
