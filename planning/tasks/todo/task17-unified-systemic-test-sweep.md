# Task 17: Full Core Verification & Automated Tests Verification

## Description
Execute end-to-end typechecks, standalone server builds, and complete test suites validating that the MVC decoupling performs flawlessly.

## Deliverables
- [ ] Run full typecheck and build sequence: `npm run build` at workspace root.
- [ ] Verify standalone daemon execution: Run `npm start` at root.
- [ ] Run systemic and server integration tests: `npm run test:sft && npm run test:sit`.
- [ ] Run Playwright automated E2E browser tests: `npm run test:uit`.

## Completion Criteria
- [ ] All 10+ core test suites run green.
- [ ] Client elements register smoothly on `ProcessServer` registry, showing up inside GS-Orchestrator's responsive frontend view.

---

# Verification Steps
`npm run test:all` or `npx playwright test` passes fully!
