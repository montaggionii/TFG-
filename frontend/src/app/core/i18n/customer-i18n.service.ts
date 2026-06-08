import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, catchError, of } from 'rxjs';

export type CustomerLanguage = 'es' | 'en' | 'it' | 'fr' | 'ca';

export interface CustomerLanguageOption {
  code: CustomerLanguage;
  label: string;
  nativeName: string;
}

const STORAGE_KEY = 'fidely_customer_language';
const DEFAULT_LANGUAGE: CustomerLanguage = 'es';

const DEFAULT_TRANSLATIONS: Record<string, string> = {
  'common.back': 'Volver',
  'common.cancel': 'Cancelar',
  'common.close': 'Cerrar',
  'common.confirm': 'Confirmar',
  'common.loading': 'Cargando...',
  'common.points': 'Puntos',
  'common.pts': 'pts',
  'common.retry': 'Reintentar',
  'common.save': 'Guardar',
  'nav.home': 'Inicio',
  'nav.map': 'Mapa',
  'nav.history': 'Historial',
  'nav.profile': 'Perfil',
  'profile.settings.language.title': 'Idioma',
  'profile.settings.language.subtitle': 'Español',
  'profile.language.modal.title': 'Idioma',
  'profile.language.saved': 'Idioma guardado'
};

@Injectable({ providedIn: 'root' })
export class CustomerI18nService {
  private http = inject(HttpClient);
  private translations: Record<string, string> = DEFAULT_TRANSLATIONS;
  private currentLanguageSubject = new BehaviorSubject<CustomerLanguage>(this.readStoredLanguage());

  readonly currentLanguage$ = this.currentLanguageSubject.asObservable();
  readonly languages: CustomerLanguageOption[] = [
    { code: 'es', label: 'Español', nativeName: 'Español' },
    { code: 'en', label: 'English', nativeName: 'English' },
    { code: 'it', label: 'Italiano', nativeName: 'Italiano' },
    { code: 'fr', label: 'Français', nativeName: 'Français' },
    { code: 'ca', label: 'Valencià / Català', nativeName: 'Valencià / Català' }
  ];

  constructor() {
    this.use(this.currentLanguageSubject.value, false);
  }

  get currentLanguage(): CustomerLanguage {
    return this.currentLanguageSubject.value;
  }

  get currentLanguageLabel(): string {
    return this.languages.find(language => language.code === this.currentLanguage)?.label || 'Español';
  }

  use(language: CustomerLanguage, persist = true): void {
    const nextLanguage = this.isSupportedLanguage(language) ? language : DEFAULT_LANGUAGE;

    this.http.get<Record<string, string>>(`assets/i18n/${nextLanguage}.json`).pipe(
      catchError(() => of(DEFAULT_TRANSLATIONS))
    ).subscribe(dictionary => {
      this.translations = {
        ...DEFAULT_TRANSLATIONS,
        ...dictionary
      };

      if (persist) {
        localStorage.setItem(STORAGE_KEY, nextLanguage);
      }

      this.currentLanguageSubject.next(nextLanguage);
    });
  }

  instant(key: string, params?: Record<string, string | number | undefined | null>): string {
    const value = this.translations[key] || DEFAULT_TRANSLATIONS[key] || key;

    if (!params) {
      return value;
    }

    return Object.entries(params).reduce((text, [paramKey, paramValue]) => {
      return text.replace(new RegExp(`{{\\s*${paramKey}\\s*}}`, 'g'), String(paramValue ?? ''));
    }, value);
  }

  private readStoredLanguage(): CustomerLanguage {
    const storedLanguage = localStorage.getItem(STORAGE_KEY) as CustomerLanguage | null;
    return storedLanguage && this.isSupportedLanguage(storedLanguage) ? storedLanguage : DEFAULT_LANGUAGE;
  }

  private isSupportedLanguage(language: string): language is CustomerLanguage {
    return ['es', 'en', 'it', 'fr', 'ca'].includes(language);
  }
}
