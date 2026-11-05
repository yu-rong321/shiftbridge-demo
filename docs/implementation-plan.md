# ShiftBridge v0.1 Implementation Plan

Goal: implement and publish the five requested workflows with source traceability.

Architecture: static ES modules and synthetic JSON. Pure domain functions power DOM rendering. GitHub Actions validates and uploads only dist/ to Pages.

Spec: docs/design.md. Execution is authorized by the user's development request.

## Tasks

- [x] 1. Evidence model. Core evidence rules implemented; 27 contract tests pass after review corrections.
- [x] 2. Workspace. Five English workflows implemented. 13 DOM workflows pass on GitHub Actions. Keyboard focus and mobile CSS are implemented; real-browser visual inspection remains unverified.
- [ ] 3. Delivery. Source and workflow committed. Final validation passes 40 tests, static checks, build and artifact upload. Deployment is blocked by Pages not being enabled. Public URL verification remains incomplete. See docs/verification.md.

## Review focus

LocalStorage failures must be visible. Unknown equipment IDs must abstain. Outdated or edited review snapshots cannot save. Source links must not expose another equipment record. A newly entered RESOLVED record requires evidence and must not silently close unrelated issues.
