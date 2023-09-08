import { Injectable } from '@angular/core';
import { ToastController } from '@ionic/angular';

type toastPosition = 'top' | 'bottom' | 'middle';

@Injectable({
  providedIn: 'root'
})
export class ToastService {

  constructor(private toastCtrl: ToastController) { }

  async toastSuccess(message: string, duration: number = 2000, position: toastPosition = 'top') {
    let toast = await this.toastCtrl.create({
      message: message,
      duration: duration,
      position: position,
      color: 'success',
      icon: 'checkmark-circle-outline',
      animated: true,
    });
    toast.present();
  }

  async toastError(message: string, duration: number = 2000, position: toastPosition = 'top') {
    let toast = await this.toastCtrl.create({
      message: message,
      duration: duration,
      position: position,
      color: 'danger',
      icon: 'close-circle-outline',
      animated: true,
    });
    toast.present();
  }

  async toastWarning(message: string, duration: number = 2000, position: toastPosition = 'top') {
    let toast = await this.toastCtrl.create({
      message: message,
      duration: duration,
      position: position,
      color: 'warning',
      icon: 'warning-outline',
      animated: true,
    });
    toast.present();
  }

}


