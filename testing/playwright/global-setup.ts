import {
  GSOrchestratorInitiator,
  ProcessServerInitiator,
  TestManager
} from '../src/TestManager';

export default async function globalSetup(): Promise<() => Promise<void>> {
  const testManager = new TestManager();

  await testManager.assureRunning([
    ProcessServerInitiator,
    GSOrchestratorInitiator
  ]);

  return async () => testManager.teardown();
}
