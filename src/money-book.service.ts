import {Injectable, NgZone} from '@angular/core';
import {BehaviorSubject} from 'rxjs/BehaviorSubject';

export class Subject {
  id: number;
  name = '';
  source = '';
  destination = '';
  revoked = false;
  constructor() {}
}

export function sortSubjects(subjects: Subject[], mnemonic: string) {
  return subjects.filter(x => x[mnemonic] !== '').sort((x, y) => {
    const a = x[mnemonic];
    const b = y[mnemonic];
    return a < b ? -1 : a > b ? 1 : 0;
  }).concat(subjects.filter(x => x[mnemonic] === ''));
}

export class Item {
  source: number;
  destination: number;
  amount: number;
  description: string;
  constructor() {}
}

export interface Series {
  [subject: number]: number[];
}

@Injectable()
export abstract class MoneyBookService {
  isSignedIn = new BehaviorSubject<null | boolean>(null);
  abstract sign(which: string): void;
  protected toMonth(x: Date) {
    const pad = (x: number) => `${x < 10 ? '0' : ''}${x}`;
    return `${x.getFullYear()}${pad(x.getMonth() + 1)}`;
  }
  abstract getSubjects(): Promise<Subject[]>;
  abstract putSubjects(subjects: Subject[]): Promise<void>;
  abstract getAllItems(): Promise<{date: string, items: Item[]}[]>;
  abstract getItems(date: Date): Promise<Item[]>;
  abstract putItems(date: Date, items: Item[]): Promise<void>;
  abstract getMonthlyTotals(months: Date[], sources: {[id: number]: boolean}, destinations: {[id: number]: boolean}): Promise<[Series, Series]>;
}

@Injectable()
export class TestMoneyBookService extends MoneyBookService {
  subjects: Subject[];
  items: {[month: string]: Item[][]} = {};
  constructor() {
    super();
    this.subjects = [
      {id: 1, name: 'Cash', source: 'a', destination: '', revoked: false},
      {id: 2, name: 'Deposit', source: 'b', destination: '', revoked: false},
      {id: 3, name: 'Foods', source: '', destination: 'a', revoked: false},
      {id: 4, name: 'Others', source: '', destination: 'b', revoked: false}
    ];
    const date = new Date();
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    date.setMonth(date.getMonth() + 1);
    const end = new Date(date.getTime());
    date.setFullYear(date.getFullYear() - 1);
    while (date.getTime() < end.getTime()) {
      const items: Item[] = [];
      const n = Math.floor(Math.random() * 5);
      for (let i = 0; i < n; ++i) items.push({
        source: Math.random() < 0.9 ? 1 : 2,
        destination: Math.random() < 0.7 ? 3 : 4,
        amount: Math.floor(Math.random() * 10000),
        description: ''
      });
      this._putItems(date, items);
      date.setDate(date.getDate() + 1);
    }
    setTimeout(() => this.isSignedIn.next(false), 1000);
  }
  sign(which: string) {
    setTimeout(() => this.isSignedIn.next(which === 'In'), 1000);
  }
  getSubjects() {
    return new Promise(resolve => setTimeout(() => {
      resolve(JSON.parse(JSON.stringify(this.subjects)) as Subject[]);
    }, 1000));
  }
  putSubjects(subjects: Subject[]) {
    return new Promise<void>(resolve => setTimeout(() => {
      this.subjects = JSON.parse(JSON.stringify(subjects)) as Subject[];
      resolve();
    }, 1000));
  }
  getAllItems() {
    const pad = (x: number) => `${x < 10 ? '0' : ''}${x}`;
    return new Promise(resolve => setTimeout(() => {
      const months: any[] = [];
      for (const month in this.items) months.push(month);
      months.sort();
      const items: any[] = [];
      months.forEach(x => this.items[x].forEach((y, i) => items.push({
        date: x + pad(i),
        items: JSON.parse(JSON.stringify(y)) as Item[]
      })));
      resolve(items);
    }, 1000));
  }
  getItems(date: Date) {
    return new Promise(resolve => setTimeout(() => {
      let x = this.items[this.toMonth(date)];
      if (!x) x = [];
      const items = x[date.getDate()];
      resolve(JSON.parse(JSON.stringify(items ? items : [])) as Item[]);
    }, 1000));
  }
  private _putItems(date: Date, items: Item[]) {
    const key = this.toMonth(date);
    let monthly = this.items[key];
    if (!monthly) this.items[key] = monthly = [];
    monthly[date.getDate()] = <Item[]>JSON.parse(JSON.stringify(items));
  }
  putItems(date: Date, items: Item[]) {
    return new Promise<void>(resolve => setTimeout(() => {
      this._putItems(date, items);
      resolve();
    }, 1000));
  }
  getMonthlyTotals(months: Date[], sources: {[id: number]: boolean}, destinations: {[id: number]: boolean}) {
    const series0: Series = {};
    for (const id in sources) if (sources[id]) series0[id] = Array<number>(months.length).fill(0);
    const series1: Series = {};
    for (const id in destinations) if (destinations[id]) series1[id] = Array<number>(months.length).fill(0);
    months.forEach((x, i) => {
      const monthly = this.items[this.toMonth(x)];
      if (monthly) monthly.forEach(x => x.filter(x => sources[x.source] && destinations[x.destination]).forEach(x => {
        series0[x.source][i] += x.amount;
        series1[x.destination][i] += x.amount;
      }));
    });
    return new Promise(resolve => setTimeout(() => {
      resolve([series0, series1]);
    }, 1000));
  }
}

function tryOrBackoff<T>(action: () => Promise<T>, delay: number): Promise<T> {
  return action().then(undefined, x => {
    if (!x.result || x.result.code !== 500 && !x.result.error.errors.some((x: any) => x.reason.match(/(userR|r)ateLimitExceeded/))) return Promise.reject(x);
    delay *= 2;
    return new Promise<T>(resolve => setTimeout(() => resolve(tryOrBackoff(action, delay)), delay));
  });
}

declare var gapi: any;

const CLIENT_ID = '243896661130-h89kibrpsj30pnjs89pl144jutkbrebh.apps.googleusercontent.com';

@Injectable()
export class GoogleDriveMoneyBookService extends MoneyBookService {
  constructor(private zone: NgZone) {
    super();
    this.zone.runOutsideAngular(() => gapi.load('client:auth2', () => gapi.client.init({
      discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
      clientId: CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/drive.appdata'
    }).then(() => {
      gapi.auth2.getAuthInstance().isSignedIn.listen((x: boolean) => this.isSignedInChanged(x));
      this.isSignedInChanged(gapi.auth2.getAuthInstance().isSignedIn.get());
    })));
  }
  sign(which: string) {
    this.zone.runOutsideAngular(() => gapi.auth2.getAuthInstance()['sign' + which]());
  }
  private isSignedInChanged(value: boolean) {
    this.zone.run(() => this.isSignedIn.next(value));
  }
  private getJSONByName(name: string) {
    return tryOrBackoff(() => gapi.client.drive.files.list({
      spaces: 'appDataFolder',
      q: `name = '${name}'`,
      fields: 'files(description)'
    }), 100).then((x: any) => x.result.files.length > 0 ? JSON.parse(x.result.files[0].description) : null);
  }
  private putJSONByName(name: string, value: any) {
    return tryOrBackoff(() => gapi.client.drive.files.list({
      spaces: 'appDataFolder',
      q: `name = '${name}'`,
      fields: 'files(id, name)'
    }), 100).then((x: any) => x.result.files).then(files => {
      if (!value) return files;
      if (files.length > 0) {
        const id = files.shift().id;
        return tryOrBackoff(() => gapi.client.drive.files.update({
          fileId: id,
          description: JSON.stringify(value)
        }), 100).then(() => files);
      } else {
        return tryOrBackoff(() => gapi.client.drive.files.create({
          parents: ['appDataFolder'],
          name: name,
          mimeType: 'application/vnd.google-apps.drive-sdk',
          description: JSON.stringify(value)
        }), 100).then(() => files);
      }
    }).then(files => files.reduce((promise: Promise<void>, x: any) =>
      promise.then(() => tryOrBackoff(() => gapi.client.drive.files.delete({fileId: x.id}), 100))
    , Promise.resolve()));
  }
  private runOutside<T>(action: () => Promise<T>) {
    return new Promise<T>((resolve, reject) => this.zone.runOutsideAngular(action).then(
      (x: T) => this.zone.run(() => resolve(x)),
      (x: any) => this.zone.run(() => reject(x.result ? x.result.error : x))
    ));
  }
  getSubjects() {
    return this.runOutside(() => this.getJSONByName('subjects')).then(x => x ? <Subject[]>x : [
      {id: 1, name: 'Cash', source: 'a', destination: '', revoked: false},
      {id: 2, name: 'Foods', source: '', destination: 'a', revoked: false}
    ]);
  }
  putSubjects(subjects: Subject[]) {
    return this.runOutside(() => this.putJSONByName('subjects', subjects));
  }
  getAllItems() {
    return this.runOutside(() => {
      const items: {date: string, items: Item[]}[] = [];
      const list = (token?: string): Promise<{date: string, items: Item[]}[]> => tryOrBackoff(() => gapi.client.drive.files.list({
        spaces: 'appDataFolder',
        q: `name contains 'items'`,
        orderBy: 'name',
        pageSize: 1000,
        pageToken: token,
        fields: 'nextPageToken, files(name, description)'
      }), 100).then((x: any) => {
        x.result.files.forEach((x: any) => items.push({
          date: x.name.substr(5),
          items: JSON.parse(x.description)
        }));
        return x.result.nextPageToken ? list(x.result.nextPageToken) : items;
      });
      return list();
    });
  }
  private toItemsName(x: Date) {
    const pad = (x: number) => `${x < 10 ? '0' : ''}${x}`;
    return `items${this.toMonth(x)}${pad(x.getDate())}`;
  }
  getItems(date: Date) {
    return this.runOutside(() => this.getJSONByName(this.toItemsName(date))).then(x => x ? x as Item[] : []);
  }
  putItems(date: Date, items: Item[]) {
    return this.runOutside(() => this.putJSONByName(this.toItemsName(date), items.length > 0 ? items : null));
  }
  getMonthlyTotals(months: Date[], sources: {[id: number]: boolean}, destinations: {[id: number]: boolean}) {
    return this.runOutside(() => {
      const yms = months.map(x => this.toMonth(x));
      return tryOrBackoff(() => gapi.client.drive.files.list({
        spaces: 'appDataFolder',
        q: `(${yms.map(x => `name contains 'items${x}'`).join(' or ')})`,
        pageSize: 1000,
        fields: 'files(name, description)'
      }), 100).then((x: any) => {
        const series0: Series = {};
        for (const id in sources) if (sources[id]) series0[id] = Array<number>(yms.length).fill(0);
        const series1: Series = {};
        for (const id in destinations) if (destinations[id]) series1[id] = Array<number>(yms.length).fill(0);
        const ym2i: {[month: string]: number} = {};
        yms.forEach((x, i) => ym2i[x] = i);
        x.result.files.forEach((x: any) => {
          const i = ym2i[x.name.substr(5, 6)];
          (<Item[]>JSON.parse(x.description)).filter(x => sources[x.source] && destinations[x.destination]).forEach(x => {
            series0[x.source][i] += x.amount;
            series1[x.destination][i] += x.amount;
          });
        });
        return [series0, series1];
      });
    });
  }
}
