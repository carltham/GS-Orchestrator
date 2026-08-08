# How to Install `@gs/orchestrator-client`

`@gs/orchestrator-client` is installed directly from the running `GS-Orchestrator` server via `curl`.

---

## ⚡ Quick One-Line Installation

Navigate to your consuming project directory and run:

```bash
curl -sSL http://localhost:9000/install.sh | bash
```

Or using the Node.js installer:

```bash
curl -sSL http://localhost:9000/install.js | node - .
```

To install on a specific project path:

```bash
curl -sSL http://localhost:9000/install.sh | bash -s -- /path/to/target-project
```

---

## ⚙️ What the Installer Does Automatically

When executed, the installer endpoint performs all setup steps autonomously:

1. **Builds Client:** Compiles the latest `@gs/orchestrator-client` library.
2. **Installs Package:** Installs `@gs/orchestrator-client` as a dependency in the target project.
3. **Generates `startupHandler.js`:** Inspects the target project structure (detecting Node/TypeScript backend, Angular/Vite frontend, or Docker container) and writes a custom `startupHandler.js` at the project root.
4. **Updates `package.json`:** Registers `"startupHandler": "node startupHandler.js"` in the target project's `package.json`.

---

## 🚀 Code Usage Example

Import and run `OrchestratedLauncher` inside your target project's entry point (`src/server.ts`):

```typescript
import { OrchestratedLauncher } from '@gs/orchestrator-client';

async function main() {
  const launcher = new OrchestratedLauncher();
  await launcher.start();
}

if (require.main === module) {
  main().catch((err) => console.error('Startup failed:', err));
}
```

---

## 🧪 Verification & Health Checks

1. **Verify Registration:**
   Query `GS-Orchestrator` status endpoint:
   ```bash
   curl http://localhost:9000/api/health
   ```
2. **View Registered Projects:**
   Query active project count:
   ```bash
   curl http://localhost:9000/api/count
   ```
3. **Run Client Integration Tests:**
   Inside `lib/orchestrator-client`:
   ```bash
   npm test
   ```
