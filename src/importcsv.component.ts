import { Component } from '@angular/core';
import { Subject, Item, MoneyBookService } from './money-book.service';

@Component({
  template: `
    <div>
      <input type="file" hidden (change)="importSubjects($event.target!)" #subjects>
      <button mat-button (click)="subjects.click()" i18n>Import Subjects</button>
    </div>
    <div>
      <input type="file" hidden (change)="importItems($event.target!)" #items>
      <button mat-button (click)="items.click()" i18n>Import Items</button>
    </div>
    <pre>{{result}}</pre>
  `
})
export class ImportCSVComponent {
  result = '';
  constructor(private service: MoneyBookService) {}
  private parse<T>(files: FileList, create: (lines: string[]) => T): Promise<T[]> {
    return new Promise<T[]>((resolve, reject) => {
      const f = files[0];
      if (f === null) return reject();
      const reader = new FileReader();
      reader.onload = e => {
        const lines = (<{result: string}><any>e.target).result.split('\n');
        lines.shift();
        if (lines[lines.length - 1].trim() === '') lines.pop();
        resolve(lines.map(x => create(x.split(',').map(x => x.trim()))));
      };
      reader.readAsText(f);
    });
  }
  importSubjects(target: EventTarget) {
    this.parse<Subject>((<HTMLInputElement>target).files!, xs => ({
      id: +xs[0],
      name: xs[1],
      source: xs[2],
      destination: xs[3],
      revoked: false
    })).then(x => this.service.putSubjects(x)).then(() => this.result = 'Done.');
  }
  importItems(target: EventTarget) {
    this.parse<{date: Date, item: Item}>((<HTMLInputElement>target).files!, xs => ({
      date: new Date(xs[1]),
      item: {
        source: +xs[2],
        destination: +xs[3],
        amount: parseFloat(xs[4]),
        description: `${xs[5]} ${xs[6]}`.trim()
      }
    })).then(x => {
      const items: {[date: string]: Item[]} = {};
      const dates: Date[] = [];
      x.forEach(x => {
        const date = x.date.getTime();
        let daily = items[date];
        if (!daily) {
          items[date] = daily = [];
          dates.push(x.date);
        }
        daily.push(x.item);
      });
      dates.sort((x, y) => x.getTime() - y.getTime());
      return dates.reduce((promise, x, i) => promise.then(() => {
        this.result = `[${i + 1}/${dates.length}] ${x.getFullYear()}-${x.getMonth() + 1}-${x.getDate()}`
        return this.service.putItems(x, items[x.getTime()])
      }), Promise.resolve()).then(() => this.result = 'Done.', x => this.result = x.message);
    });
  }
}
