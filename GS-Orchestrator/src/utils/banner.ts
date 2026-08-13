/**
 * Utility for printing the GS-Orchestrator central service dashboard endpoints and information banner.
 */
export function showBanner(port: number, regPath: string, unregPath: string, usrPath: string): void {
  console.log(`🎯 GS-Orchestrator running on http://localhost:${port}`);
  console.log(`📋 Registry: ${regPath}`);
  console.log(`🔍 Unregistered Servers File: ${unregPath}`);
  console.log(`👥 Users Database: ${usrPath}`);
  console.log(`\nAuthentication Endpoints:`);
  console.log(`  POST   /api/auth/login          - Login (username required, password optional for thor)`);
  console.log(`  POST   /api/auth/logout         - Logout`);
  console.log(`  GET    /api/auth/current-user   - Get current user`);
  console.log(`  GET    /api/auth/check          - Check authentication status`);
  console.log(`\nAdmin Endpoints (Superadmin only):`);
  console.log(`  GET    /api/admin/users         - List all users`);
  console.log(`  POST   /api/admin/users         - Create new user`);
  console.log(`  PUT    /api/admin/users/:id     - Update user`);
  console.log(`  DELETE /api/admin/users/:id     - Delete user`);
  console.log(`  POST   /api/admin/users/:id/disable  - Disable user`);
  console.log(`  POST   /api/admin/users/:id/enable   - Enable user`);
  console.log(`  POST   /api/admin/users/:id/change-password - Change password`);
  console.log(`\nOrchestrator Endpoints:`);
  console.log(`  POST   /api/register      - Register a project and allocate ports`);
  console.log(`  DELETE /api/register/:name - Unregister a project`);
  console.log(`  POST   /api/health        - Receive health report from project`);
  console.log(`  GET    /api/signals/:name - Get pending signals for project`);
  console.log(`  POST   /api/signals/:name/ack - Mark signals as processed`);
  console.log(`  GET    /api/unregistered  - List detected unregistered running servers`);
  console.log(`  GET    /health            - Health check`);

  console.log(`\n🔍 Scanning for unregistered running servers...`);
}
