import { Pipe, PipeTransform, inject } from '@angular/core';
import { CustomerI18nService } from './customer-i18n.service';

@Pipe({
  name: 'ffTranslate',
  standalone: true,
  pure: false
})
export class CustomerTranslatePipe implements PipeTransform {
  private i18n = inject(CustomerI18nService);

  transform(key: string, params?: Record<string, string | number | undefined | null>): string {
    return this.i18n.instant(key, params);
  }
}
