/**
 * Modelo de estado del Agent Widget. El estado NUNCA se edita directamente
 * desde la UI — solo se deriva de AgentEvent a través de AgentStateService.
 */

export type AgentStatus =
  | 'IDLE'
  | 'WORKING'
  | 'THINKING'
  | 'TOOL_RUNNING'
  | 'SUCCESS'
  | 'ERROR'
  | 'WAITING';

export type StepState = 'done' | 'active' | 'pending';

export interface AgentStep {
  id: string;
  label: string;
  state: StepState;
}

export type TimelineKind = 'done' | 'active' | 'error' | 'info';

export interface AgentTimelineEntry {
  id: string;
  at: Date;
  kind: TimelineKind;
  message: string;
}

export interface AgentToolUsage {
  name: string;
  detail?: string;
}

export interface AgentError {
  message: string;
  recoverable: boolean;
}

export interface AgentState {
  status: AgentStatus;
  currentAction: string | null;
  currentTool: AgentToolUsage | null;
  progress: number | null;
  steps: AgentStep[];
  timeline: AgentTimelineEntry[];
  startedAt: Date | null;
  lastActionAt: Date | null;
  nextAction: string | null;
  tasksCompletedToday: number;
  error: AgentError | null;
  waitingFor: string | null;
  lastTaskSummary: string | null;
}

export function initialAgentState(): AgentState {
  return {
    status: 'IDLE',
    currentAction: null,
    currentTool: null,
    progress: null,
    steps: [],
    timeline: [],
    startedAt: null,
    lastActionAt: null,
    nextAction: null,
    tasksCompletedToday: 0,
    error: null,
    waitingFor: null,
    lastTaskSummary: null
  };
}
