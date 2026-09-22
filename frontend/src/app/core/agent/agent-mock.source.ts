import { Injectable } from '@angular/core';
import { AgentEvent } from './agent-event.types';
import { AgentStateService } from './agent-state.service';

interface ScriptStep {
  delayMs: number;
  event: AgentEvent;
}

function iso(): string {
  return new Date().toISOString();
}

/**
 * Simula un ciclo completo de trabajo del agente contra tareas reales de
 * este proyecto (revisar negocios, sincronizar puntos, generar informe).
 *
 * Emite los mismos AgentEvent que emitiría un backend real, a través del
 * mismo AgentStateService.handleEvent() — no toca el estado directamente.
 * Para conectar una fuente real más adelante: sustituir el `setTimeout` de
 * este fichero por un EventSource/WebSocket que llame a
 * agentState.handleEvent(JSON.parse(msg.data)) con eventos del mismo tipo
 * (ver agent-event.types.ts). El resto de la app no cambia.
 */
@Injectable({ providedIn: 'root' })
export class AgentMockSource {
  private timers: ReturnType<typeof setTimeout>[] = [];
  private running = false;

  constructor(private agentState: AgentStateService) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.runCycle();
  }

  stop(): void {
    this.running = false;
    this.timers.forEach(t => clearTimeout(t));
    this.timers = [];
  }

  private runCycle(): void {
    const script = this.buildScript();
    this.playScript(script, () => {
      if (!this.running) return;
      // Vuelve a IDLE un rato, y arranca otro ciclo — simula un agente que
      // sigue trabajando en tareas del proyecto de forma continua.
      const idleFor = 14000;
      const t = setTimeout(() => {
        this.agentState.handleEvent({ type: 'agent.idle', at: iso() });
        const t2 = setTimeout(() => this.running && this.runCycle(), idleFor);
        this.timers.push(t2);
      }, 800);
      this.timers.push(t);
    });
  }

  private playScript(script: ScriptStep[], onDone: () => void): void {
    let elapsed = 0;
    script.forEach(step => {
      elapsed += step.delayMs;
      const t = setTimeout(() => {
        if (!this.running) return;
        this.agentState.handleEvent(step.event);
      }, elapsed);
      this.timers.push(t);
    });
    const t = setTimeout(onDone, elapsed + 600);
    this.timers.push(t);
  }

  private buildScript(): ScriptStep[] {
    const steps = [
      { id: 'scan', label: 'Revisar negocios pendientes' },
      { id: 'sync', label: 'Sincronizar puntos y movimientos' },
      { id: 'report', label: 'Generar informe de actividad' }
    ];

    return [
      {
        delayMs: 200,
        event: { type: 'agent.started', at: iso(), payload: { task: 'Auditoría diaria de FidelyFood', steps } }
      },
      {
        delayMs: 700,
        event: { type: 'agent.thinking', at: iso(), payload: { message: 'Planificando qué negocios revisar hoy...' } }
      },
      {
        delayMs: 1200,
        event: { type: 'agent.step_started', at: iso(), payload: { id: 'scan' } }
      },
      {
        delayMs: 400,
        event: { type: 'agent.tool_started', at: iso(), payload: { tool: 'API Negocios', detail: 'Consultando /api/admin/businesses' } }
      },
      {
        delayMs: 900,
        event: { type: 'agent.progress', at: iso(), payload: { percent: 20, message: 'Analizando negocios activos...' } }
      },
      {
        delayMs: 1000,
        event: { type: 'agent.progress', at: iso(), payload: { percent: 45, message: 'Comprobando datos de contacto...' } }
      },
      {
        delayMs: 900,
        event: { type: 'agent.tool_completed', at: iso(), payload: { tool: 'API Negocios' } }
      },
      {
        delayMs: 300,
        event: { type: 'agent.step_completed', at: iso(), payload: { id: 'scan' } }
      },
      {
        delayMs: 500,
        event: { type: 'agent.step_started', at: iso(), payload: { id: 'sync' } }
      },
      {
        delayMs: 400,
        event: { type: 'agent.tool_started', at: iso(), payload: { tool: 'Base de datos', detail: 'Movimientos de puntos' } }
      },
      {
        delayMs: 1000,
        event: { type: 'agent.progress', at: iso(), payload: { percent: 68, message: 'Verificando integridad de puntos...' } }
      },
      {
        delayMs: 900,
        event: { type: 'agent.tool_completed', at: iso(), payload: { tool: 'Base de datos' } }
      },
      {
        delayMs: 300,
        event: { type: 'agent.step_completed', at: iso(), payload: { id: 'sync' } }
      },
      {
        delayMs: 500,
        event: { type: 'agent.step_started', at: iso(), payload: { id: 'report' } }
      },
      {
        delayMs: 400,
        event: { type: 'agent.thinking', at: iso(), payload: { message: 'Redactando resumen de actividad...' } }
      },
      {
        delayMs: 1000,
        event: { type: 'agent.progress', at: iso(), payload: { percent: 90, message: 'Generando informe...' } }
      },
      {
        delayMs: 700,
        event: { type: 'agent.step_completed', at: iso(), payload: { id: 'report' } }
      },
      {
        delayMs: 400,
        event: {
          type: 'agent.task_completed',
          at: iso(),
          payload: {
            summary: 'Auditoría diaria completada: negocios revisados, puntos sincronizados.',
            nextAction: 'Esperando próxima tarea'
          }
        }
      }
    ];
  }
}
