import { describe, expect, it } from 'bun:test';
import { calculateExecutionMetrics, createWorkspace } from '../src/index';

describe('Workspace Initialization', () => {
  it('should initialize a workspace correctly', () => {
    const ws = createWorkspace('TestProject', '1.0.0');
    expect(ws.name).toBe('TestProject');
    expect(ws.version).toBe('1.0.0');
    expect(ws.agentic).toBe(true);
  });

  it('should calculate task completion percentages correctly', () => {
    expect(calculateExecutionMetrics(5, 10)).toBe(50);
    expect(calculateExecutionMetrics(0, 10)).toBe(0);
    expect(calculateExecutionMetrics(10, 10)).toBe(100);
    expect(calculateExecutionMetrics(3, 0)).toBe(0);
  });
});
