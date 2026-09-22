/**
 * Contrato de eventos del agente. Esto es lo que un backend/agente real
 * emitiría (por SSE, WebSocket, o polling) para que el frontend actualice
 * el Agent Widget — ver AgentStateService.handleEvent().
 *
 * Hoy no existe un backend que emita esto: AgentMockSource genera estos
 * mismos objetos AgentEvent y los pasa por el mismo handleEvent(), así que
 * conectar una fuente real más adelante es solo sustituir quién los emite,
 * no cómo se procesan.
 */

export type AgentEventType =
  | 'agent.started'
  | 'agent.thinking'
  | 'agent.tool_started'
  | 'agent.tool_completed'
  | 'agent.progress'
  | 'agent.step_started'
  | 'agent.step_completed'
  | 'agent.task_completed'
  | 'agent.error'
  | 'agent.waiting_for_input'
  | 'agent.idle';

export interface AgentStartedPayload {
  task: string;
  steps?: { id: string; label: string }[];
}

export interface AgentThinkingPayload {
  message: string;
}

export interface AgentToolPayload {
  tool: string;
  detail?: string;
}

export interface AgentProgressPayload {
  percent: number;
  message?: string;
}

export interface AgentStepPayload {
  id: string;
  label?: string;
}

export interface AgentTaskCompletedPayload {
  summary: string;
  itemsProcessed?: number;
  durationMs?: number;
  nextAction?: string | null;
}

export interface AgentErrorPayload {
  message: string;
  recoverable: boolean;
}

export interface AgentWaitingPayload {
  reason: string;
}

export interface AgentEvent<T = unknown> {
  type: AgentEventType;
  at: string; // ISO timestamp
  payload?: T;
}
