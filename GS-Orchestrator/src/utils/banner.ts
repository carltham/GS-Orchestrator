/**
 * Utility for printing the GS-Orchestrator central service dashboard endpoints and information banner.
 */
export function showBanner(port: number, regPath: string, unregPath: string, usrPath: string): void {
  console.log(`🎯 GS-Orchestrator running on http://localhost:${port}`);
  console.log(`📋 Registry: ${regPath}`);
  console.log(`🔍 Unregistered Servers File: ${unregPath}`);
  console.log(`👥 Users Database: ${usrPath}`);
  console.log(`\nAuthentication Endpoints:`);
  console.log(`  POST   /auth/login          - Login (username required, password optional for thor)`);
  console.log(`  POST   /auth/logout         - Logout`);
  console.log(`  GET    /auth/current-user   - Get current user`);
  console.log(`  GET    /auth/check          - Check authentication status`);
  console.log(`\nAdmin Endpoints (Superadmin only):`);
  console.log(`  GET    /admin/users         - List all users`);
  console.log(`  POST   /admin/users         - Create new user`);
  console.log(`  PUT    /admin/users/:id     - Update user`);
  console.log(`  DELETE /admin/users/:id     - Delete user`);
  console.log(`  POST   /admin/users/:id/disable  - Disable user`);
  console.log(`  POST   /admin/users/:id/enable   - Enable user`);
  console.log(`  POST   /admin/users/:id/change-password - Change password`);
  console.log(`\nOrchestrator Endpoints:`);
  console.log(`  POST   /orch/project/register       - Register a project and allocate ports`);
  console.log(`  DELETE /orch/project/:name          - Unregister a project`);
  console.log(`  GET    /orch/project/registry       - List registered projects`);
  console.log(`  GET    /orch/project/unregistered   - List detected unregistered running servers`);
  console.log(`  POST   /orch/reporting/project/health - Receive health report from project`);
  console.log(`  GET    /orch/reporting/health       - Health check`);

  console.log(`\n🔍 Scanning for unregistered running servers...`);
}
