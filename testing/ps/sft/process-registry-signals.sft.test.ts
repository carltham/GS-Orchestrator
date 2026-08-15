import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ProcessRegistry } from '../../../lib/process-server/src/models/ProcessRegistry';

describe('ProcessRegistry leased signal queue', () => {
  let temporaryDirectory: string;
  let signalsPath: string;

  beforeEach(() => {
    temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-signals-'));
    signalsPath = path.join(temporaryDirectory, 'signals.json');
  });

  afterEach(() => {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  test('peeks without consuming and deduplicates idempotent commands', () => {
    const registry = new ProcessRegistry(signalsPath);
    const first = registry.queueSignal({
      targetProject: 'example',
      targetClientInstanceId: 'client-a',
      action: 'STOP',
      idempotencyKey: 'request-1'
    });
    const duplicate = registry.queueSignal({
      targetProject: 'example',
      targetClientInstanceId: 'client-a',
      action: 'STOP',
      idempotencyKey: 'request-1'
    });

    expect(duplicate.id).toBe(first.id);
    expect(registry.peekSignalsForProject('example')).toHaveLength(1);
    expect(registry.peekSignalsForProject('example')).toHaveLength(1);
  });

  test('leases only to the target instance and requires owner acknowledgment', () => {
    const registry = new ProcessRegistry(signalsPath);
    const queued = registry.queueSignal({
      targetProject: 'example',
      targetClientInstanceId: 'client-a',
      action: 'START'
    });

    expect(registry.claimSignalsForProject('example', 'client-b')).toHaveLength(0);
    expect(registry.claimSignalsForProject('example', 'client-a')).toHaveLength(1);
    expect(registry.acknowledgeSignal(queued.id, 'client-b')).toBeUndefined();
    expect(registry.acknowledgeSignal(queued.id, 'client-a')?.id).toBe(queued.id);
    expect(new ProcessRegistry(signalsPath).peekSignalsForProject('example')).toHaveLength(0);
  });

  test('persists leases and redelivers released commands', () => {
    const registry = new ProcessRegistry(signalsPath);
    const queued = registry.queueSignal({
      targetProject: 'example',
      action: 'STOP'
    });

    expect(registry.claimSignalsForProject('example', 'client-a')[0].attempts).toBe(1);
    const reloaded = new ProcessRegistry(signalsPath);
    expect(reloaded.claimSignalsForProject('example', 'client-b')).toHaveLength(0);
    expect(reloaded.releaseSignal(queued.id, 'client-a')).toBe(true);
    expect(reloaded.claimSignalsForProject('example', 'client-b')[0].attempts).toBe(2);
  });
});