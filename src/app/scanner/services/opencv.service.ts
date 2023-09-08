import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class OpencvService {

  isOpenCvLoaded = false;

  constructor() { }

  loadOpenCV() {
    return new Promise<void>((resolve, reject) => {
      // verifica se opencv já foi carregado
      if (this.isOpenCvLoaded) {
        resolve();
      } else {
        // cria elemento script para carregar opencv
        const script = document.createElement('script');
        script.src = 'https://docs.opencv.org/4.8.0/opencv.js';
        script.async = true;
        script.onload = () => {
          this.isOpenCvLoaded = true;
          console.debug('OPENCV LOADED');
          resolve();
        };
        script.onerror = (err) => {
          this.isOpenCvLoaded = false;
          console.error('OPENCV ERROR', err);
          reject(err);
        };
        // adiciona script ao head
        document.head.appendChild(script);
      }
    });
  }

}
