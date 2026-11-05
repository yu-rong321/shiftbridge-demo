# v0.1 verification record

Date: 2026-11-05 (Europe/Berlin). Repository: yu-rong321/shiftbridge-demo.

## Scope and evidence

The public repository was empty when inspected. All implementation files were added in a new isolated shiftbridge-demo directory. No UGREEN submission ZIP or proposal PDF was opened for writing, replaced or included in this repository.

Core tests, syntax/static checks and static packaging run locally. DOM workflows run through jsdom on GitHub Actions because this host cannot resolve the npm registry. jsdom checks DOM behavior and persistence interactions; it does not establish real-browser rendering or responsive visual quality.

The first workflow uncovered a sample-loader edge case and an ES-module/global-binding mismatch in the DOM test harness. Both were corrected; the next validation job passed 21 core tests and 12 DOM workflows. A read-only independent review then identified missing unknown-topic/issue abstention and stale negative verification accepted for closure. Regression tests were added before these fixes and the failing local run was observed. The final suite also covers calendar-date validation and fresh verification on status change.

## Acceptance coverage

| Requirement | Automated evidence |
| --- | --- |
| Equipment records do not mix | Scoped history and issues, equipment switch, cross-equipment source/Q&A rejection |
| Unconfirmed records are not formal data | Required-field gate, separate review/acknowledgement, draft exclusion, fresh acknowledgement after editing |
| OPEN is not inferred repaired | Explicit issue status, verified resolution, rejection of missing/negative evidence, fresh verification on entering RESOLVED |
| Answers provide relevant sources | Scoped sources on each returned item, source inspector, unsupported-topic/issue abstention |
| Simulated saving is honest | Readback, reload restoration, storage failure, exact-key reset, corrupt-state exclusion |
| Pages project path is supported | Relative links, /shiftbridge-demo/ dataset fetch, six-asset dist manifest |

## Deployment status

Final source commit: `61abc47b9bdc2d5999cb3e3cbba25e9864fbbab5`.

Final GitHub Actions run: [42028333015](https://github.com/yu-rong321/shiftbridge-demo/actions/runs/42028333015). Validation job 127248074082 passed **27 core tests + 13 DOM workflow tests = 40 tests, zero failures**, followed by syntax/static checks, static packaging and Pages artifact upload. Deployment job 127248202999 failed at the Pages configuration step; publication and public asset verification did not run. The independent review findings and their targeted follow-up findings were corrected with regression tests.

A local preview server was started for HTTP checks, but the sandbox denied loopback connections with Windows error 10013. The owned preview process was stopped. No successful local-browser or visual rendering claim is made.

GitHub Actions run 42027304753 passed validation and packaging, then failed at actions/configure-pages@v5. Reported condition: “Get Pages site failed. Please verify that the repository has Pages enabled and configured to build using GitHub Actions”, followed by HTTP Not Found.

The connected GitHub tools can publish commits and inspect Actions but expose no Pages administration operation. Local GitHub CLI is unauthenticated. Browser control stopped because it could not reliably determine the Windows browser URL. The ordinary GitHub Actions token cannot enable a new Pages site. This is a deployment block, not a deployment PASS.

Required setting: Settings → Pages → Build and deployment → Source → GitHub Actions. Then rerun the Validate and deploy ShiftBridge workflow (or push another commit).

Intended URL, **not yet verified live**: https://yu-rong321.github.io/shiftbridge-demo/

Real-browser visual inspection and public URL verification remain incomplete until deployment is enabled.
