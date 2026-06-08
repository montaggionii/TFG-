import { Directive, ElementRef, HostBinding, HostListener, Input, OnChanges, Renderer2, SimpleChanges, inject } from '@angular/core';
import { RestauranteService } from '../../core/services/restaurante.service';

@Directive({
  selector: 'img[appSafeRestaurantImage]',
  standalone: true
})
export class SafeRestaurantImageDirective implements OnChanges {
  @Input('appSafeRestaurantImage') source: any;
  @Input() imageFallback?: string;

  @HostBinding('class.ff-image-loading') isLoading = true;
  @HostBinding('class.ff-image-loaded') isLoaded = false;
  @HostBinding('class.ff-image-fallback') isFallback = false;

  private restauranteService = inject(RestauranteService);
  private elementRef = inject<ElementRef<HTMLImageElement>>(ElementRef);
  private renderer = inject(Renderer2);

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['source'] && !changes['imageFallback']) return;

    this.isLoading = true;
    this.isLoaded = false;
    this.isFallback = false;

    const src = this.restauranteService.resolveRestaurantImage(this.source);
    this.renderer.setAttribute(this.elementRef.nativeElement, 'src', src);
  }

  @HostListener('load')
  onLoad(): void {
    this.isLoading = false;
    this.isLoaded = true;
  }

  @HostListener('error')
  onError(): void {
    const fallback = this.imageFallback || this.restauranteService.restaurantPlaceholder;
    const img = this.elementRef.nativeElement;

    if (img.getAttribute('src') === fallback || img.src.endsWith(fallback)) {
      this.isLoading = false;
      this.isLoaded = true;
      this.isFallback = true;
      return;
    }

    this.isFallback = true;
    this.renderer.setAttribute(img, 'src', fallback);
  }
}
