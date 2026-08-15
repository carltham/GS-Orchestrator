export type StateChangeTestStep<TResult = void> = () => TResult | Promise<TResult>;

export interface StateChangeTest<TResult> {
  validatePreState: StateChangeTestStep;
  executeStateChange: StateChangeTestStep<TResult>;
  validatePostState: (result: TResult) => void | Promise<void>;
}

export async function verifyStateChange<TResult>(test: StateChangeTest<TResult>): Promise<TResult> {
  await test.validatePreState();
  const result = await test.executeStateChange();
  await test.validatePostState(result);
  return result;
}