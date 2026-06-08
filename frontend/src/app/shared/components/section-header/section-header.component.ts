import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-section-header',
  template: `
    <div class="section-header-container">
      <div class="title-group">
        <h3 class="section-title">{{ title }}</h3>
        <p *ngIf="subtitle" class="sub-label">{{ subtitle }}</p>
      </div>
      <span *ngIf="actionText" class="action-link tap-effect" (click)="onAction.emit()">
        {{ actionText }}
      </span>
    </div>
  `,
  styles: [`
    .section-header-container {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-bottom: 1rem;
    }
    .title-group {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .section-title {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--text-primary);
    }
    .sub-label {
      margin: 0;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .action-link {
      color: var(--accent-blue);
      font-size: 0.85rem;
      font-weight: 700;
      cursor: pointer;
    }
  `],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class SectionHeaderComponent {
  @Input() title: string = '';
  @Input() subtitle: string = '';
  @Input() actionText: string = '';
  @Output() onAction = new EventEmitter<void>();
}
