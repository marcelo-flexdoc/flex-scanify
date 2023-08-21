import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { map } from 'rxjs';

@Component({
  selector: 'app-result',
  templateUrl: './result.page.html',
  styleUrls: ['./result.page.scss'],
})
export class ResultPage implements OnInit {

  documents: IDocument[] = []

  constructor() { }

  ngOnInit() {
    if (history.state.documents) {
      this.documents = history.state.documents
    }
  }

}

export interface IDocument {
  descr: string;
  imgUrl: string;
}
