import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  AgentErrorPayload,
  AgentEvent,
  AgentProgressPayload,
  AgentStartedPayload,
  AgentStepPayload,
  AgentTaskCompletedPayload,
  AgentThinkingPayload,
  AgentToolPayload,
  AgentWaitingPayload
} from './agent-event.types';
import { AgentState, AgentStatus, AgentTimelineEntry, initialAgentState } from './agent.types';

const STATUS_LABEL: Record<AgentStatus, string> = {
  IDLE: 'En espera',
  WORKING: 'Trabajando',
  THINKING: 'Pensando',
  TOOL_RUNNING: 'Ejecutando herramienta',
  SUCCESS: 'Completado',
  ERROR: 'Error',
  WAITING: 'Necesita intervención'
};

let entryId = 0;
function nextId(): string {
  entryId += 1;
  return `evt-${entryId}`;
}

const MAX_TIMELINE_ENTRIES = 50;

// Puente hacia el widget de escritorio (Übersicht) — ver
// access-center/server.js (POST/GET /api/agent-state). Si el Access Center
// no está corriendo, el POST simplemente falla en silencio: es telemetría
// opcional, nunca debe romper la app si no está disponible.
const DESKTOP_BRIDGE_URL = 'http://localhost:5757/api/agent-state';

/**
 * Única fuente de verdad del estado del Agent Widget.
 *
 * Reduce AgentEvent -> AgentState. La UI (AgentWidgetComponent) solo lee
 * state$, nunca escribe estado directamente. Cualquier fuente de eventos
 * (mock hoy, SSE/WebSocket real mañana) solo necesita llamar a
 * handleEvent() con el mismo contrato AgentEvent — ver agent-event.types.ts
 * y agent-mock.source.ts.
 */
@Injectable({ providedIn: 'root' })
export class AgentStateService {
  private readonly stateSubject = new BehaviorSubject<AgentState>(initialAgentState());
  readonly state$: Observable<AgentState> = this.stateSubject.asObservable();

  get snapshot(): AgentState {
    return this.stateSubject.getValue();
  }

  handleEvent(event: AgentEvent): void {
    const current = this.stateSubject.getValue();
    const at = new Date(event.at);

    switch (event.type) {
      case 'agent.started': {
        const payload = event.payload as AgentStartedPayload;
        this.emit({
          ...current,
          status: 'WORKING',
          currentAction: payload.task,
          currentTool: null,
          progress: null,
          error: null,
          waitingFor: null,
          startedAt: at,
          lastActionAt: at,
          nextAction: null,
          steps: (payload.steps || []).map((s, i) => ({
            id: s.id,
            label: s.label,
            state: i === 0 ? 'active' : 'pending'
          }))
        }, this.timelineEntry(current, 'info', `Iniciado: ${payload.task}`, at));
        break;
      }

      case 'agent.thinking': {
        const payload = event.payload as AgentThinkingPayload;
        this.emit({
          ...current,
          status: 'THINKING',
          currentAction: payload.message,
          lastActionAt: at
        }, this.timelineEntry(current, 'active', payload.message, at));
        break;
      }

      case 'agent.tool_started': {
        const payload = event.payload as AgentToolPayload;
        this.emit({
          ...current,
          status: 'TOOL_RUNNING',
          currentTool: { name: payload.tool, detail: payload.detail },
          lastActionAt: at
        }, this.timelineEntry(
          current,
          'active',
          `${payload.tool}${payload.detail ? ' → ' + payload.detail : ''}`,
          at
        ));
        break;
      }

      case 'agent.tool_completed': {
        const payload = event.payload as AgentToolPayload;
        this.emit({
          ...current,
          status: 'WORKING',
          lastActionAt: at
        }, this.timelineEntry(current, 'done', `${payload.tool} completado`, at));
        break;
      }

      case 'agent.progress': {
        const payload = event.payload as AgentProgressPayload;
        this.emit({
          ...current,
          progress: payload.percent,
          currentAction: payload.message ?? current.currentAction,
          lastActionAt: at
        }, null);
        break;
      }

      case 'agent.step_started': {
        const payload = event.payload as AgentStepPayload;
        this.emit({
          ...current,
          steps: current.steps.map(s => ({
            ...s,
            state: s.id === payload.id ? 'active' : (s.state === 'active' ? 'done' : s.state)
          })),
          lastActionAt: at
        }, null);
        break;
      }

      case 'agent.step_completed': {
        const payload = event.payload as AgentStepPayload;
        this.emit({
          ...current,
          steps: current.steps.map(s =>
            s.id === payload.id ? { ...s, state: 'done' } : s
          ),
          lastActionAt: at
        }, null);
        break;
      }

      case 'agent.task_completed': {
        const payload = event.payload as AgentTaskCompletedPayload;
        this.emit({
          ...current,
          status: 'SUCCESS',
          currentAction: null,
          currentTool: null,
          progress: 100,
          steps: current.steps.map(s => ({ ...s, state: 'done' })),
          lastActionAt: at,
          nextAction: payload.nextAction ?? null,
          tasksCompletedToday: current.tasksCompletedToday + 1,
          lastTaskSummary: payload.summary
        }, this.timelineEntry(current, 'done', payload.summary, at));
        break;
      }

      case 'agent.error': {
        const payload = event.payload as AgentErrorPayload;
        this.emit({
          ...current,
          status: 'ERROR',
          error: { message: payload.message, recoverable: payload.recoverable },
          lastActionAt: at
        }, this.timelineEntry(current, 'error', payload.message, at));
        break;
      }

      case 'agent.waiting_for_input': {
        const payload = event.payload as AgentWaitingPayload;
        this.emit({
          ...current,
          status: 'WAITING',
          waitingFor: payload.reason,
          lastActionAt: at
        }, this.timelineEntry(current, 'info', `Esperando: ${payload.reason}`, at));
        break;
      }

      case 'agent.idle': {
        this.emit({
          ...current,
          status: 'IDLE',
          currentAction: null,
          currentTool: null,
          progress: null,
          waitingFor: null,
          error: null,
          lastActionAt: at
        }, null);
        break;
      }
    }
  }

  private timelineEntry(
    current: AgentState,
    kind: AgentTimelineEntry['kind'],
    message: string,
    at: Date
  ): AgentTimelineEntry {
    return { id: nextId(), at, kind, message };
  }

  private emit(next: AgentState, newEntry: AgentTimelineEntry | null): void {
    const timeline = newEntry
      ? [newEntry, ...next.timeline].slice(0, MAX_TIMELINE_ENTRIES)
      : next.timeline;
    const finalState = { ...next, timeline };
    this.stateSubject.next(finalState);
    this.publishToDesktopWidget(finalState);
  }

  private publishToDesktopWidget(state: AgentState): void {
    fetch(DESKTOP_BRIDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: state.status,
        statusLabel: STATUS_LABEL[state.status],
        currentAction: state.currentAction,
        currentTool: state.currentTool,
        progress: state.progress,
        steps: state.steps,
        recentTimeline: state.timeline.slice(0, 8),
        startedAt: state.startedAt,
        lastActionAt: state.lastActionAt,
        nextAction: state.nextAction,
        tasksCompletedToday: state.tasksCompletedToday,
        error: state.error,
        waitingFor: state.waitingFor,
        lastTaskSummary: state.lastTaskSummary
      })
    }).catch(() => {
      // Access Center no está corriendo o no es alcanzable: no pasa nada,
      // el widget in-app sigue funcionando igual, solo no hay espejo en escritorio.
    });
  }
}
