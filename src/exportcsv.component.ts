import { Component, OnDestroy } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { MoneyBookService } from './money-book.service';

@Component({
  template: `
    <div class="centerable">
      <div>
        <button mat-button (click)="exportSubjects()" i18n>Export Subjects</button>
        <a mat-button *ngIf="subjects" [href]="subjects" download="subjects.csv" i18n>Save</a>
      </div>
      <div>
        <button mat-button (click)="exportItems()" i18n>Export Items</button>
        <a mat-button *ngIf="items" [href]="items" download="items.csv" i18n>Save</a>
      </div>
      <mat-spinner *ngIf="waiting" class="center"></mat-spinner>
    </div>
  `
})
export class ExportCSVComponent implements OnDestroy {
  waiting = false;
  subjects?: SafeUrl;
  items?: SafeUrl;
  constructor(private service: MoneyBookService, private sanitizer: DomSanitizer) {}
  ngOnDestroy() {
    if (this.subjects) URL.revokeObjectURL(this.subjects.toString());
    if (this.items) URL.revokeObjectURL(this.items.toString());
  }
  exportSubjects() {
    this.waiting = true;
    if (this.subjects) {
      URL.revokeObjectURL(this.subjects.toString());
      this.subjects = undefined;
    }
    this.service.getSubjects().then(x => {
      this.subjects = this.sanitizer.bypassSecurityTrustUrl(
        URL.createObjectURL(new Blob([
          'id,name,source,destination\n',
          x.map(x => `${x.id},${x.name},${x.source},${x.destination}\n`).join('')
        ], {type: 'text/csv'}))
      );
      this.waiting = false;
    });
  }
  exportItems() {
    this.waiting = true;
    if (this.items) {
      URL.revokeObjectURL(this.items.toString());
      this.items = undefined;
    }
    this.service.getAllItems().then(x => {
      const items: string[] = [];
      x.forEach(x => x.items.forEach(y => items.push([
        '', `${x.date.substr(0,4)}/${+x.date.substr(4,2)}/${+x.date.substr(6,2)}`,
        y.source, y.destination, y.amount, y.description, '\n'
      ].join())));
      this.items = this.sanitizer.bypassSecurityTrustUrl(
        URL.createObjectURL(new Blob([
          ',date,source,destination,amount,description,\n',
          items.join('')
        ], {type: 'text/csv'}))
      );
      this.waiting = false;
    });
  }
}
