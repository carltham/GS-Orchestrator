# Task: Installer Delivery Clean-up

Exposes client script deliveries exclusively via the Process Server, eliminating duplication of binary delivery across microservices.

---

## Technical Goal
Define the Process Server daemon as the single source of truth for host bootstraps and dynamic class adapter generation templates.

---

## Action Items
- [ ] Remove `GET /install.sh` and `GET /install.js` routes from the Orchestrator's [server.ts](GS-Orchestrator/src/server.ts).
- [ ] Edit dynamic templates inside the Angular dashboard UI components:
  - Route the "Download install.sh" layout action to:
    ```
    http://localhost:9999/install.sh
    ```
  - Route the "Download install.js" layout action to:
    ```
    http://localhost:9999/install.js
    ```
- [ ] Ensure SFT tests assert the health of Orchestrator routes without testing script endpoints, and SIT tests affirm Process Server continues to deliver installers as designed.
