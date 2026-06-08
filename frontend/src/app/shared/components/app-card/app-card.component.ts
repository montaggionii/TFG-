import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-card',
  template: `
    <div [class]="'app-card ' + customClass" [ngStyle]="customStyle">
      <ng-content></ng-content>
    </div>
  `,
  styles: [`
    .app-card {
      background: var(--bg-surface);
      border-radius: var(--border-radius-md);
      box-shadow: var(--premium-shadow);
      border: 1px solid rgba(255, 255, 255, 0.03);
      padding: 1.25rem;
      overflow: hidden;
      position: relative;
    }
  `],
  standalone: true,
  imports: [CommonModule]
})
export class AppCardComponent {
  @Input() customClass: string = '';
  @Input() customStyle: any = {};
}
