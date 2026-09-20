/**
 * Core application entry point
 */

export interface WorkspaceConfig {
  name: string;
  version: string;
  agentic: boolean;
}

export function createWorkspace(name: string, version = '0.1.0'): WorkspaceConfig {
  return {
    name,
    version,
    agentic: true,
  };
}

export function calculateExecutionMetrics(tasksCompleted: number, totalTasks: number): number {
  if (totalTasks <= 0) return 0;
  return Math.round((tasksCompleted / totalTasks) * 100);
}

if (import.meta.main) {
  const ws = createWorkspace('ZedWorkspace');
  console.log(`🚀 Agentic workspace '${ws.name}' initialized (v${ws.version})`);
}
