import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLogStore } from '../logs';
import { LOGGING } from '../../lib/zmninja-ng-constants';

describe('Log Store', () => {
  beforeEach(() => {
    useLogStore.setState({ logs: [] });
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid-1' });
  });

  it('adds log entries with generated ids', () => {
    useLogStore.getState().addLog({
      timestamp: '2024-01-01T00:00:00Z',
      level: 'INFO',
      message: 'Test log',
    });

    const logs = useLogStore.getState().logs;
    expect(logs).toHaveLength(1);
    expect(logs[0].id).toBe('uuid-1');
    expect(logs[0].message).toBe('Test log');
  });

  it('keeps only the latest N logs as configured', () => {
    const store = useLogStore.getState();
    const testCount = LOGGING.maxLogEntries + 100;

    for (let i = 0; i < testCount; i += 1) {
      store.addLog({
        timestamp: `2024-01-01T00:00:${String(i).padStart(2, '0')}Z`,
        level: 'DEBUG',
        message: `Log ${i}`,
      });
    }

    expect(useLogStore.getState().logs).toHaveLength(LOGGING.maxLogEntries);
    expect(useLogStore.getState().logs[0].message).toBe(`Log ${testCount - 1}`);
  });

  it('clears logs', () => {
    useLogStore.setState({
      logs: [
        {
          id: 'id-1',
          timestamp: '2024-01-01T00:00:00Z',
          level: 'INFO',
          message: 'Test log',
        },
      ],
    });

    useLogStore.getState().clearLogs();

    expect(useLogStore.getState().logs).toHaveLength(0);
  });
});
