import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ActionSheetController, LoadingController } from '@ionic/angular';
import { IDocument } from '../result/result.page';
import JScanify from './jscanify/jscanify';
import { OpencvService } from './services/opencv.service';

@Component({
  selector: 'app-scanner',
  templateUrl: './scanner.page.html',
  styleUrls: ['./scanner.page.scss'],
})
export class ScannerPage implements OnInit {

  showPanel: "INIT" | "SUCCESS" | "FAIL" = "INIT";
  isLoading = false;
  openModalScanner = false;
  openModalResult = false;
  scannedImageBase64: string = "";
  loadingCtl: any;
  video!: HTMLVideoElement;
  documents: IDocument[] = []

  constructor(
    private route: Router,
    private opencvService: OpencvService,
    private loadingController: LoadingController,
    private actionSheetCtrl: ActionSheetController
  ) { }

  ngOnInit() {
    this.showPanel = "INIT";
    this.loadingOpenCV();
  }

  loadingOpenCV() {
    this.isLoading = true;
    this.opencvService.loadOpenCV()
      .then(() => {
        this.isLoading = false;
      })
      .catch((err) => {
        this.isLoading = false;
      });
  }

  async presentLoading() {
    this.loadingCtl = await this.loadingController.create({
      message: 'Preparando a Câmera...'
    });
    this.loadingCtl.present();
  }

  async startVideoScanner() {

    console.debug('STARTING SCAN');
    await this.presentLoading()

    // busca os elementos da tela
    this.video = document.getElementById('video') as HTMLVideoElement;
    const content = document.getElementById('content') as HTMLDivElement;
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const frame = document.getElementById('frame') as HTMLCanvasElement;
    const crop = document.getElementById('crop') as HTMLCanvasElement;
    const canvasCtx = canvas.getContext("2d");
    const frameCtx = frame.getContext("2d");
    const cropCtx = crop.getContext("2d");

    // inicia configurações de video e canvas
    const videScanning = (stream: MediaStream) => {

      console.log('VIDEO STARTING', stream.getVideoTracks()); //[0].getSettings()

      this.video.srcObject = stream;

      this.video.onloadedmetadata = () => {

        console.log('VIDEO PLAYING', this.video.videoWidth, this.video.videoHeight);
        console.log('VIEW PORT', content.clientWidth, content.clientHeight);

        const isPortrait = content.clientWidth < content.clientHeight;
        const [innerWidth, innerHeight] = isPortrait ? [content.clientWidth, content.clientWidth * (this.video.videoHeight / this.video.videoWidth)] : [content.clientHeight * (this.video.videoWidth / this.video.videoHeight), content.clientHeight];

        frame.width = this.video.videoWidth;
        frame.height = this.video.videoHeight;
        frame.style.width = innerWidth + 'px';
        frame.style.height = innerHeight + 'px';

        canvas.width = this.video.videoWidth;
        canvas.height = this.video.videoHeight;
        canvas.style.width = innerWidth + 'px';
        canvas.style.height = innerHeight + 'px';

        this.video.play();

        let interval: any;

        // função chamada quando o crop é detectado
        const detected = (crop: HTMLCanvasElement) => {
          console.log('DETECTED');
          // interrompe o video e captura de frames
          clearInterval(interval);
          this.stopAudioAndVideo();

          // desenha o crop
          cropCtx?.drawImage(crop, 10, 10, crop.width - 20, crop.height - 20);
          this.scannedImageBase64 = crop.toDataURL();
          // exibe modal com o resultado
          setTimeout(() => this.activateModalResult(), 1000);
        }

        // inicia o scanner
        const scanner = new JScanify();
        // configurações do scanner
        const options = { detectedCrop: detected, showRefRect: true, padding: canvas.width * 0.15 };

        // captura frames
        interval = setInterval(() => {
          // captura frames
          canvasCtx?.drawImage(this.video, 0, 0, this.video.videoWidth, this.video.videoHeight);
          // destaca o documento
          const highlight = scanner.highlightPaper(canvas, options);
          frameCtx?.drawImage(highlight, 0, 0, highlight.width, highlight.height);
        }, 100);

        this.loadingCtl.dismiss();
      };
    };

    navigator.mediaDevices.getUserMedia({
      video: {
        width: { min: 1280, ideal: 1920, max: 2560 }, height: { min: 720, ideal: 1080, max: 1440 }, facingMode: "environment"
      }
    }).then(videScanning);

  }

  goToScanner() {
    this.scannedImageBase64 = "";
    this.activateModalScanner();
  }

  activateModalScanner() {
    this.openModalScanner = true;
    this.openModalResult = false;
  }

  onModalScannerOpened() {
    this.startVideoScanner();
  }

  onModalScannerClosed() {
    this.stopAudioAndVideo();
    this.openModalScanner = false;
  }

  activateModalResult() {
    this.openModalResult = true;
    this.openModalScanner = false;
  }

  onModalResultClosed() {
    this.openModalResult = false;
  }

  onModalResultOpened() {
    // this.actionSheet();
  }

  confirm() {
    this.openModalResult = false;
    this.showPanel = "SUCCESS";
    this.saveData();
  }

  retry() {
    this.goToScanner();
  }

  dismiss() {
    this.scannedImageBase64 = "";
    this.openModalResult = false;
    this.showPanel = "FAIL";
  }

  saveData() {
    console.log("SAVED", this.scannedImageBase64);
    this.documents.push({
      descr: "Documento " + (this.documents.length + 1),
      imgUrl: this.scannedImageBase64
    });
  }

  goToInit() {
    this.showPanel = "INIT";
  }

  goToNextStep() {
    this.route.navigate(['/result'], {
      state: { documents: this.documents }
    });
  }

  stopAudioAndVideo() {
    if (this.video.srcObject) {
      const stream = this.video.srcObject as MediaStream;
      stream.getTracks().forEach((track) => {
        if (track.readyState == 'live') {
          track.stop();
        }
      });
      this.video.srcObject = null;
    }
  }

  async actionSheet() {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Documento Digitalizado',
      buttons: [{
        text: 'Confirmar',
        icon: 'checkmark',
        handler: () => this.confirm()
      }, {
        text: 'Repetir',
        icon: 'camera-reverse',
        handler: () => this.retry()
      }, {
        text: 'Cancelar',
        icon: 'trash',
        role: 'destructive',
        handler: () => this.dismiss()
      }]
    });
    await actionSheet.present();
  }

}
