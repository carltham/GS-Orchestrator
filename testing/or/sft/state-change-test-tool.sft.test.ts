import { verifyStateChange } from '../../src/StateChangeTestTool';

describe('StateChangeTestTool', () => {
  test('validates pre-state, executes the action, then validates its result', async () => {
    const steps: string[] = [];

    const result = await verifyStateChange({
      validatePreState: () => {
        steps.push('pre');
      },
      executeStateChange: () => {
        steps.push('execute');
        return { status: 'stopped' };
      },
      validatePostState: (executionResult) => {
        steps.push('post');
        expect(executionResult.status).toBe('stopped');
      }
    });

    expect(steps).toEqual(['pre', 'execute', 'post']);
    expect(result).toEqual({ status: 'stopped' });
  });
});