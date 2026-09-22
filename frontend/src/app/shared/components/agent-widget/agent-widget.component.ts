import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription, interval } from 'rxjs';
import { AgentMockSource } from '../../../core/agent/agent-mock.source';
import { AgentStateService } from '../../../core/agent/agent-state.service';
import { AgentState, AgentStatus } from '../../../core/agent/agent.types';

interface StatusMeta {
  label: string;
  tone: 'idle' | 'active' | 'success' | 'error' | 'waiting';
}

const STATUS_META: Record<AgentStatus, StatusMeta> = {
  IDLE: { label: 'En espera', tone: 'idle' },
  WORKING: { label: 'Trabajando', tone: 'active' },
  THINKING: { label: 'Pensando', tone: 'active' },
  TOOL_RUNNING: { label: 'Ejecutando herramienta', tone: 'active' },
  SUCCESS: { label: 'Completado', tone: 'success' },
  ERROR: { label: 'Error', tone: 'error' },
  WAITING: { label: 'Necesita intervención', tone: 'waiting' }
};

@Component({
  selector: 'app-agent-widget',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './agent-widget.component.html',
  styleUrls: ['./agent-widget.component.scss']
})
export class AgentWidgetComponent implements OnInit, OnDestroy {
  state: AgentState = this.agentState.snapshot;
  expanded = false;
  activityOpen = false;
  now = new Date();

  private subs = new Subscription();

  constructor(
    private agentState: AgentStateService,
    private mockSource: AgentMockSource
  ) {}

  ngOnInit(): void {
    this.subs.add(this.agentState.state$.subscribe(s => (this.state = s)));
    this.subs.add(interval(1000).subscribe(() => (this.now = new Date())));
    // No hay todavía una fuente de eventos real del backend — ver
    // agent-mock.source.ts para cómo conectar una cuando exista.
    this.mockSource.start();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.mockSource.stop();
  }

  get meta(): StatusMeta {
    return STATUS_META[this.state.status];
  }

  toggleExpanded(): void {
    this.expanded = !this.expanded;
    if (!this.expanded) this.activityOpen = false;
  }

  openActivity(): void {
    this.activityOpen = true;
  }

  closeActivity(): void {
    this.activityOpen = false;
  }

  relativeTime(date: Date | null): string {
    if (!date) return '—';
    const diffMs = this.now.getTime() - date.getTime();
    const diffSec = Math.max(0, Math.round(diffMs / 1000));
    if (diffSec < 5) return 'justo ahora';
    if (diffSec < 60) return `hace ${diffSec} s`;
    const diffMin = Math.round(diffSec / 60);
    if (diffMin < 60) return `hace ${diffMin} min`;
    const diffH = Math.round(diffMin / 60);
    return `hace ${diffH} h`;
  }

  elapsedSince(date: Date | null): string {
    if (!date) return '0:00';
    const diffSec = Math.max(0, Math.round((this.now.getTime() - date.getTime()) / 1000));
    const m = Math.floor(diffSec / 60);
    const s = diffSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  formatClock(date: Date): string {
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}
