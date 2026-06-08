import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ThemePreference = 'light' | 'dark' | 'auto';
export type ResolvedTheme = 'light' | 'dark';

export interface ThemeOption {
  value: ThemePreference;
  label: string;
  description: string;
}

const THEME_STORAGE_KEY = 'theme';
const DEFAULT_THEME: ThemePreference = 'auto';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private mediaQuery: MediaQueryList | null = null;
  private preferenceSubject = new BehaviorSubject<ThemePreference>(this.readStoredTheme());
  private resolvedThemeSubject = new BehaviorSubject<ResolvedTheme>('light');

  readonly preference$ = this.preferenceSubject.asObservable();
  readonly resolvedTheme$ = this.resolvedThemeSubject.asObservable();
  readonly options: ThemeOption[] = [
    { value: 'light', label: 'Claro', description: 'Fondo blanco y naranja FidelyFood' },
    { value: 'dark', label: 'Oscuro', description: 'Premium oscuro de alto contraste' },
    { value: 'auto', label: 'Automático', description: 'Usar el sistema operativo' }
  ];

  constructor() {
    this.mediaQuery = this.getMediaQuery();
    this.bindSystemListener();
    this.applyTheme(this.preferenceSubject.value);
  }

  get preference(): ThemePreference {
    return this.preferenceSubject.value;
  }

  get resolvedTheme(): ResolvedTheme {
    return this.resolvedThemeSubject.value;
  }

  setTheme(preference: ThemePreference): void {
    const nextPreference = this.isThemePreference(preference) ? preference : DEFAULT_THEME;
    localStorage.setItem(THEME_STORAGE_KEY, nextPreference);
    this.preferenceSubject.next(nextPreference);
    this.applyTheme(nextPreference);
  }

  private applyTheme(preference: ThemePreference): void {
    const resolvedTheme = this.resolveTheme(preference);
    const root = document.documentElement;

    root.setAttribute('data-theme', resolvedTheme);
    root.setAttribute('data-theme-preference', preference);
    root.style.colorScheme = resolvedTheme;
    document.body.classList.toggle('dark-theme', resolvedTheme === 'dark');
    document.body.classList.toggle('light-theme', resolvedTheme === 'light');

    this.resolvedThemeSubject.next(resolvedTheme);
  }

  private resolveTheme(preference: ThemePreference): ResolvedTheme {
    if (preference === 'auto') {
      return this.mediaQuery?.matches ? 'dark' : 'light';
    }

    return preference;
  }

  private bindSystemListener(): void {
    if (!this.mediaQuery) return;

    const handleSystemThemeChange = () => {
      if (this.preferenceSubject.value === 'auto') {
        this.applyTheme('auto');
      }
    };

    if (this.mediaQuery.addEventListener) {
      this.mediaQuery.addEventListener('change', handleSystemThemeChange);
      return;
    }

    this.mediaQuery.addListener(handleSystemThemeChange);
  }

  private getMediaQuery(): MediaQueryList | null {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return null;
    }

    return window.matchMedia('(prefers-color-scheme: dark)');
  }

  private readStoredTheme(): ThemePreference {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    return storedTheme && this.isThemePreference(storedTheme) ? storedTheme : DEFAULT_THEME;
  }

  private isThemePreference(value: string): value is ThemePreference {
    return ['light', 'dark', 'auto'].includes(value);
  }
}
