import { TestManager, ProcessServerInitiator, GSOrchestratorInitiator } from './TestManager';
import * as path from 'path';

async function run() {
  const manager = new TestManager();
  let exitCode = 0;

  try {
    // 1. Setup clean baseline folder and DB databases
    await manager.resetDatabaseState();

    // 2. Run standalone functional supertest specs in isolation
    console.log('\n=======================================');
    console.log('[TestManager] STAGE 1: Running Functional Specs (SFT)');
    console.log('=======================================');
    // Note: SFT tests mock database updates but don't need ports daemon active, except orchestrator-scanner.sft which checks mock ports.
    // To make sure orchestrator-scanner executes perfectly, we'll start Process Server daemon before and keep it alive for SFT and SIT.
    await manager.assureRunning([ProcessServerInitiator]);
    
    const sftExit = await manager.runTestCommand('npm', ['run', 'test:sft'], path.resolve(__dirname, '..'));
    if (sftExit !== 0) {
      console.error('❌ Stage 1 SFT testing failed.');
      exitCode = 1;
    } else {
      console.log('✅ Stage 1 SFT testing completed successfully.');
    }

    // 3. Start Orchestrator server for System Integration network-socket tests
    console.log('\n=======================================');
    console.log('[TestManager] STAGE 2: Starting Services & Running Integration Specs (SIT)');
    console.log('=======================================');
    await manager.assureRunning([GSOrchestratorInitiator]);

    const sitExit = await manager.runTestCommand('npm', ['run', 'test:sit'], path.resolve(__dirname, '..'));
    if (sitExit !== 0) {
      console.error('❌ Stage 2 SIT testing failed.');
      exitCode = 1;
    } else {
      console.log('✅ Stage 2 SIT testing completed successfully.');
    }

    // 4. Run Playwright User Interface Specs
    console.log('\n=======================================');
    console.log('[TestManager] STAGE 3: Running Playwright Browser Specs (UIT)');
    console.log('=======================================');
    
    // Playwright commands should target testing/playwright subfolder
    const uitExit = await manager.runTestCommand('npx', ['playwright', 'test', '--project=uit'], path.resolve(__dirname, '../playwright'));
    if (uitExit !== 0) {
      console.error('❌ Stage 3 UIT testing failed.');
      exitCode = 1;
    } else {
      console.log('✅ Stage 3 UIT testing completed successfully.');
    }

  } catch (error) {
    console.error('Fatal execution error inside TestManager run loop:', error);
    exitCode = 1;
  } finally {
    // Clear and terminate all matching subprocess segments cleanly
    await manager.teardown();
    process.exit(exitCode);
  }
}

run();
