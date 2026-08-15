import { MockProcessServer } from '../../src/mocks/MockProcessServer';
import { ProcessClient } from '../../../lib/process-client/src/launcher/ProcessClient';
import { IProcessAdapter } from '../../../lib/process-client/src/types/IProcessAdapter';

class MockAdapter implements IProcessAdapter {
  public startCalls: Array<Record<string, number> | undefined> = [];
  public stopCalls: number = 0;
  public status: 'RUNNING' | 'STOPPED' = 'STOPPED';

  public async start(ports?: Record<string, number>): Promise<void> {
    this.startCalls.push(ports);
    this.status = 'RUNNING';
  }

  public async stop(): Promise<void> {
    this.stopCalls++;
    this.status = 'STOPPED';
  }

  public async getStatus(): Promise<{ status: 'RUNNING' | 'STOPPED'; pid?: number; components?: Record<string, any> }> {
    return {
      status: this.status,
      pid: 12345,
      components: {
        'backend::mock': { status: this.status, port: 3000, pid: 12345 }
      }
    };
  }

  public getServiceTypes(): Record<string, string> {
    return { backend: 'node-ts', frontend: 'vite' };
  }
}

describe('ProcessClient SFT - Mock Server Endpoint & Ticket Polling Inspection', () => {
  const MOCK_PORT = 9998;
  let mockServer: MockProcessServer;

  beforeAll(async () => {
    mockServer = new MockProcessServer(MOCK_PORT);
    await mockServer.start();
  });

  afterAll(async () => {
    await mockServer.stop();
  });

  beforeEach(() => {
    mockServer.clearLogs();
  });

  test('configures custom endpoint to mock server and logs client registration, heartbeats, and polling', async () => {
    const adapter = new MockAdapter();
    const client = new ProcessClient({
      projectName: 'TestMockService',
      processServerUrl: mockServer.url,
      pollIntervalMs: 50,
      heartbeatIntervalMs: 50,
      adapter,
    });

    await client.start();

    // Allow a few ticks of metronome
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Verify client registered with the mock server endpoint
    const registrations = mockServer.getRegistrations();
    expect(registrations.length).toBeGreaterThanOrEqual(1);
    expect(registrations[0].body.projectName).toBe('TestMockService');
    expect(registrations[0].body.serviceTypes).toEqual({ backend: 'node-ts', frontend: 'vite' });

    // Verify heartbeat posts were received and logged
    const heartbeats = mockServer.getHeartbeats();
    expect(heartbeats.length).toBeGreaterThanOrEqual(1);
    expect(heartbeats[0].body.projectName).toBe('TestMockService');
    expect(heartbeats[0].body.status).toBe('RUNNING');

    // Verify signal/ticket polling requests were logged
    const polls = mockServer.getSignalPolls();
    expect(polls.length).toBeGreaterThanOrEqual(1);
    expect(polls[0].query.projectName).toBe('TestMockService');

    await client.stop();
  });

  test('polls and processes tickets/signals dispatched from mock server', async () => {
    const adapter = new MockAdapter();
    const client = new ProcessClient({
      projectName: 'TicketTestService',
      processServerUrl: mockServer.url,
      pollIntervalMs: 50,
      heartbeatIntervalMs: 50,
      adapter,
    });

    await client.start();

    // Queue a STOP ticket on mock server
    mockServer.queueSignal('TicketTestService', {
      id: 'ticket-stop-001',
      action: 'STOP',
    });

    // Wait for client to poll and process ticket
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(adapter.stopCalls).toBeGreaterThanOrEqual(1);

    // Queue a START ticket with custom ports
    mockServer.queueSignal('TicketTestService', {
      id: 'ticket-start-002',
      action: 'START',
      ports: { backend: 8080, frontend: 4200 },
    });

    await new Promise((resolve) => setTimeout(resolve, 150));
    const lastStart = adapter.startCalls[adapter.startCalls.length - 1];
    expect(lastStart).toEqual({ backend: 8080, frontend: 4200 });

    await client.stop();
  });
});
