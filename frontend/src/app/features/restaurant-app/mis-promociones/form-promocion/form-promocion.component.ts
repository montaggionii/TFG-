import { Component, OnInit, inject, ChangeDetectorRef, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { IonicModule, ToastController, LoadingController, NavController, ModalController } from '@ionic/angular';
import { PromocionService } from '../../../../core/services/promocion.service';
import { RestauranteService } from '../../../../core/services/restaurante.service';
import { addIcons } from 'ionicons';
import { 
  closeOutline, 
  imageOutline, 
  cloudUploadOutline, 
  checkmarkCircle, 
  alertCircle,
  saveOutline,
  swapHorizontalOutline,
  cart,
  gift
} from 'ionicons/icons';

@Component({
  selector: 'app-form-promocion',
  templateUrl: './form-promocion.component.html',
  styleUrls: ['./form-promocion.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, ReactiveFormsModule]
})
export class FormPromocionComponent implements OnInit {
  @Input() promo: any = null; // Para edición

  private fb = inject(FormBuilder);
  private promocionService = inject(PromocionService);
  private restauranteService = inject(RestauranteService);
  private toastCtrl = inject(ToastController);
  private loadingCtrl = inject(LoadingController);
  private cdr = inject(ChangeDetectorRef);
  private modalCtrl = inject(ModalController);

  promotionForm: FormGroup;
  previewUrl: string | null = null;
  selectedFile: File | null = null;
  isSubmitting: boolean = false;

  constructor() {
    addIcons({ 
      closeOutline, 
      imageOutline, 
      cloudUploadOutline, 
      checkmarkCircle, 
      alertCircle,
      saveOutline,
      swapHorizontalOutline,
      cart,
      gift
    });
    
    this.promotionForm = this.fb.group({
      titulo: ['', [Validators.required]],
      descripcion: ['', [Validators.required]],
      puntosNecesarios: [null, [Validators.required, Validators.min(1)]],
      tipo: ['GANAR', [Validators.required]],
      imagenUrl: ['']
    });
  }

  ngOnInit() {
    if (this.promo) {
      this.promotionForm.patchValue({
        titulo: this.promo.titulo,
        descripcion: this.promo.descripcion,
        puntosNecesarios: this.promo.puntosNecesarios,
        tipo: this.promo.tipo || 'GANAR',
        imagenUrl: this.promo.imagen // Esto es el nombre del archivo o URL
      });
      this.previewUrl = this.promo.imagenUrl ? this.restauranteService.resolverImagenUrl(this.promo.imagenUrl) : null;
    }

    this.promotionForm.get('imagenUrl')?.valueChanges.subscribe(val => {
      if (!this.selectedFile) {
        this.previewUrl = val && (val.startsWith('http') || val.startsWith('data:')) ? val : null;
        this.cdr.detectChanges();
      }
    });

    // SUSCRIPCIÓN GLOBAL PARA VISTA PREVIA EN TIEMPO REAL
    this.promotionForm.valueChanges.subscribe(() => {
      this.cdr.detectChanges();
    });
  }

  closeModal() {
    this.modalCtrl.dismiss();
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    console.log("Evento de selección de archivo disparado");
    
    if (file) {
      console.log("Archivo seleccionado:", file.name, "Tipo:", file.type, "Tamaño:", file.size);
      this.selectedFile = file;
      this.promotionForm.patchValue({ imagenUrl: '' }, { emitEvent: false });

      const reader = new FileReader();
      reader.onload = () => {
        console.log("Lector de archivos cargado correctamente");
        this.previewUrl = reader.result as string;
        this.cdr.detectChanges();
      };
      reader.onerror = (error) => {
        console.error("Error al leer el archivo:", error);
      };
      reader.readAsDataURL(file);
    } else {
      console.warn("No se detectó ningún archivo en el evento");
    }
  }

  clearFileSelection() {
    this.selectedFile = null;
    this.previewUrl = this.promo?.imagenUrl || null;
    this.cdr.detectChanges();
  }

  async onSubmit() {
    if (this.promotionForm.invalid || this.isSubmitting) return;

    this.isSubmitting = true;
    const isEdit = !!this.promo;

    const loading = await this.loadingCtrl.create({
      message: isEdit ? 'Actualizando promoción...' : 'Creando promoción...',
      spinner: 'crescent'
    });
    await loading.present();

    let payload: any;

    if (this.selectedFile) {
      // Caso: Subida de archivo (solo para creación o cambio de imagen)
      const formData = new FormData();
      formData.append('titulo', this.promotionForm.value.titulo);
      formData.append('descripcion', this.promotionForm.value.descripcion);
      formData.append('puntosNecesarios', String(this.promotionForm.value.puntosNecesarios));
      formData.append('tipo', this.promotionForm.value.tipo);
      formData.append('imagen', this.selectedFile);
      payload = formData;
    } else {
      // Caso: JSON (edición sin cambiar imagen o creación con URL si aplicara)
      payload = {
        titulo: this.promotionForm.value.titulo,
        descripcion: this.promotionForm.value.descripcion,
        puntosNecesarios: Number(this.promotionForm.value.puntosNecesarios),
        tipo: this.promotionForm.value.tipo,
        imagen: this.promotionForm.value.imagenUrl || this.promo?.imagen
      };
    }

    const request = isEdit 
      ? this.promocionService.updatePromocion(this.promo.id, payload)
      : this.promocionService.crearPromocion(payload);

    request.subscribe({
      next: async () => {
        await loading.dismiss();
        this.isSubmitting = false;
        this.mostrarToast(isEdit ? '¡Promoción actualizada!' : '¡Promoción creada!', 'success', 'checkmark-circle');
        this.modalCtrl.dismiss({ success: true });
      },
      error: async (err) => {
        await loading.dismiss();
        this.isSubmitting = false;
        console.error('Error detallado:', err);
        const msg = err.error?.message || err.error || 'Error al procesar la solicitud';
        this.mostrarToast(msg, 'danger', 'alert-circle');
      }
    });
  }

  private async mostrarToast(message: string, color: string, icon?: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'top',
      icon
    });
    toast.present();
  }
}
