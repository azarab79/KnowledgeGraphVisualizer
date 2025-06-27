# Hidden Links – Mitigation Plan (June 2025)

> Owner: Architectural team  •  Status: **draft / in-progress**

## Goal
Stabilise the Hidden Links endpoint so it works against any supported Neo4j + GDS installation without crashing the API server.

## Identified Root Causes
1. **Mixed GDS procedure catalogue** → legacy `gds.linkprediction.train` missing.
2. **Stale catalog objects** (pipeline/model/graph) cause `already exists` exceptions.
3. **Hard-kill restarts** can leave Neo4j in partial procedure registration state.

## Task list
| ID | Task | Owner | Status |
|----|------|-------|--------|
| 1 | Add safe pipeline creation (swallow "already exists") | backend | ✅ done (commit …)|
| 2 | Add catalog cleanup guard before each request (`graph / model / pipeline drop`) | backend | ✅ done |
| 3 | Detect legacy procedure availability via `dbms.procedures()` and skip fallback if absent | backend | ✅ done |
| 4 | Parameterise per-request unique pipeline / model names to avoid collisions | backend | ✅ done |
| 5 | Document required GDS version & procedure list in README | docs | ✅ done |
| 6 | Add smoke-test script to CI that asserts both pipeline & (optional) legacy procedures are callable | DevOps | ✅ done |
| 7 | Replace `pkill` dev restart with graceful Neo4j shutdown / startup script | DevOps | ✅ done |
| 8 | Add comprehensive unit tests for Hidden Links functionality | testing | ✅ done |
| 9 | Add Playwright E2E tests for Hidden Links user experience | testing | ✅ done |

## Implementation Summary

All tasks have been successfully implemented:

- **Enhanced GraphRepository.js** with robust error handling, procedure detection, unique naming, and catalog cleanup
- **Updated README.md** with comprehensive GDS requirements and troubleshooting guide
- **Created smoke-test-gds.js** script for CI/CD validation of GDS environment
- **Created neo4j-manager.js** script for graceful Neo4j lifecycle management
- **Added hidden-links.test.js** with comprehensive unit tests covering all mitigation scenarios
- **Added hidden-links.spec.ts** Playwright tests for end-to-end user experience validation

The Hidden Links endpoint is now significantly more stable and should work reliably across different Neo4j + GDS installations.

_All tasks completed as of implementation._ 