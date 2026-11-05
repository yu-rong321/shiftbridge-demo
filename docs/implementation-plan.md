# ShiftBridge v0.1 Implementation Plan

Goal: implement and publish the five requested workflows with source traceability.

Architecture: static ES modules and synthetic JSON. Pure domain functions power DOM rendering. GitHub Actions validates and uploads only dist/ to Pages.

Spec: docs/design.md. Execution is authorized by the user's development request.

## Tasks

- [x] 1. Evidence model. Core evidence rules implemented; 25 local contract tests pass after review corrections.
- [x] 2. Workspace. Five English workflows implemented. 12 DOM workflows passed on GitHub Actions before the final verification-reset regression was added. Keyboard focus and mobile CSS are implemented; real-browser visual inspection is unavailable in this host.
- [ ] 3. Delivery. Source and workflow committed. Static check/build pass. Deployment attempted and blocked by Pages not being enabled; final CI rerun and public URL verification tracked in docs/verification.md.

## Review focus

LocalStorage failures must be visible. Unknown equipment IDs must abstain. Outdated or edited review snapshots cannot save. Source links must not expose another equipment record. A newly entered RESOLVED record requires evidence and must not silently close unrelated issues.
