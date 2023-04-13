/// <reference types="@types/gapi" />
//
import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export class Subject {
  public id = 0;
  public name = '';
  public source = '';
  public destination = '';
  public revoked = false;
}

export function sortSubjects(subjects: Subject[], mnemonic: keyof Subject) {
  return subjects.filter(x => x[mnemonic] !== '').sort((x, y) => {
    const a = x[mnemonic];
    const b = y[mnemonic];
    return a < b ? -1 : a > b ? 1 : 0;
  }).concat(subjects.filter(x => x[mnemonic] === ''));
}

export interface Item {
  source: number;
  destination: number;
  amount: number;
  description: string;
}

@Injectable()
export abstract class MoneyBookService {
  isSignedIn = new BehaviorSubject<null | boolean>(null);
  abstract signIn(): void;
  abstract signOut(): void;
  protected toMonth(x: Date) {
    const pad = (x: number) => `${x < 10 ? '0' : ''}${x}`;
    return `${x.getFullYear()}${pad(x.getMonth() + 1)}`;
  }
  abstract getSubjects(): Promise<Subject[]>;
  abstract putSubjects(subjects: Subject[]): Promise<void>;
  abstract getAllItems(): Promise<{date: string, items: Item[]}[]>;
  abstract getItems(date: Date): Promise<Item[]>;
  abstract putItems(date: Date, items: Item[]): Promise<void>;
  abstract getAllItemsPerMonth(months: Date[]): Promise<Item[][][]>;
}

@Injectable()
export class TestMoneyBookService extends MoneyBookService {
  subjects: string;
  items: {[month: string]: string[]} = {};
  constructor() {
    super();
    const subjects = [
      {id: 1, name: 'Cash', source: 'a', destination: '', revoked: false},
      {id: 2, name: 'Deposit', source: 'b', destination: '', revoked: false},
      {id: 3, name: 'Foods', source: '', destination: 'a', revoked: false},
      {id: 4, name: 'Others', source: '', destination: 'b', revoked: false}
    ];
    for (let i = 0; i < 24; ++i) subjects.push({
      id: subjects.length + 1, name: `Extra ${i}`, source: '', destination: String.fromCharCode('c'.charCodeAt(0) + i), revoked: false
    });
    this.subjects = JSON.stringify(subjects);
    const date = new Date();
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    date.setMonth(date.getMonth() + 1);
    const end = new Date(date.getTime());
    date.setFullYear(date.getFullYear() - 1);
    for (; date.getTime() < end.getTime(); date.setDate(date.getDate() + 1)) {
      const n = Math.floor(Math.random() * 5);
      if (n <= 0) continue;
      const items: Item[] = [];
      const d = Math.random();
      for (let i = 0; i < n; ++i) items.push({
        source: Math.random() < 0.9 ? 1 : 2,
        destination: d < 0.5 ? 3 : d < 0.7 ? 4 : Math.floor(Math.random() * 24) + 5,
        amount: Math.floor(Math.random() * 10000),
        description: ''
      });
      this._putItems(date, items);
    }
    setTimeout(() => this.isSignedIn.next(false), 1000);
  }
  signIn() {
    setTimeout(() => this.isSignedIn.next(true), 1000);
  }
  signOut() {
    setTimeout(() => this.isSignedIn.next(false), 1000);
  }
  getSubjects() {
    return new Promise<Subject[]>(resolve => setTimeout(() => {
      resolve(<Subject[]>JSON.parse(this.subjects));
    }, 1000));
  }
  putSubjects(subjects: Subject[]) {
    return new Promise<void>(resolve => setTimeout(() => {
      this.subjects = JSON.stringify(subjects);
      resolve();
    }, 1000));
  }
  getAllItems() {
    const pad = (x: number) => `${x < 10 ? '0' : ''}${x}`;
    return new Promise<{date: string, items: Item[]}[]>(resolve => setTimeout(() => {
      const months: any[] = [];
      for (const month in this.items) months.push(month);
      months.sort();
      const items: any[] = [];
      months.forEach(x => this.items[x].forEach((y, i) => items.push({
        date: x + pad(i),
        items: <Item[]>JSON.parse(y)
      })));
      resolve(items);
    }, 1000));
  }
  getItems(date: Date) {
    return new Promise<Item[]>(resolve => setTimeout(() => {
      const daily = this.items[this.toMonth(date)];
      const items = (daily ? daily : [])[date.getDate()];
      resolve(items ? <Item[]>JSON.parse(items) : []);
    }, 1000));
  }
  private _putItems(date: Date, items: Item[]) {
    const key = this.toMonth(date);
    let daily = this.items[key];
    if (!daily) this.items[key] = daily = [];
    daily[date.getDate()] = JSON.stringify(items);
  }
  putItems(date: Date, items: Item[]) {
    return new Promise<void>(resolve => setTimeout(() => {
      this._putItems(date, items);
      resolve();
    }, 1000));
  }
  getAllItemsPerMonth(months: Date[]) {
    return new Promise<Item[][][]>(resolve => setTimeout(() => resolve(months.map(x => {
      const daily = this.items[this.toMonth(x)];
      return daily ? daily.map(x => <Item[]>JSON.parse(x)) : [];
    })), 1000));
  }
}

function tryOrBackoff<T>(action: () => Promise<T>, delay: number): Promise<T> {
  return action().then(undefined, x => {
    if (!x.result || x.result.error.code !== 500 && !x.result.error.errors.some((x: any) => x.reason.match(/(userR|r)ateLimitExceeded/))) return Promise.reject(x);
    delay *= 2;
    return new Promise<T>(resolve => setTimeout(() => resolve(tryOrBackoff(action, delay)), delay));
  });
}

declare var google: any;

const CLIENT_ID = '243896661130-h89kibrpsj30pnjs89pl144jutkbrebh.apps.googleusercontent.com';

@Injectable()
export class GoogleDriveMoneyBookService extends MoneyBookService {
  tokenClient: any;
  constructor(private zone: NgZone) {
    super();
    this.zone.runOutsideAngular(() => gapi.load('client', () => gapi.client.init({
      discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
    }).then(() => {
      this.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/drive.appdata',
        callback: (response: any) => this.isSignedInChanged(gapi.client.getToken() !== null)
      });
      this.isSignedInChanged(gapi.client.getToken() !== null);
    })));
  }
  signIn() {
    this.zone.runOutsideAngular(() => this.tokenClient.requestAccessToken());
  }
  signOut() {
    this.zone.runOutsideAngular(() => {
      const token = gapi.client.getToken();
      if (!token) return;
      google.accounts.oauth2.revoke(token.access_token);
      gapi.client.setToken(null);
      this.isSignedInChanged(false);
    });
  }
  private isSignedInChanged(value: boolean) {
    this.zone.run(() => this.isSignedIn.next(value));
  }
  private tryOrBackoff<T>(action: () => Promise<T>, delay: number): Promise<T> {
    return tryOrBackoff(action, delay).then(undefined, x => x.result.error.code === 401 || x.result.error.code === 403 && x.result.error.status === 'PERMISSION_DENIED' ? new Promise<void>(resolve => {
      this.tokenClient.callback = (response: any) => {
        this.isSignedInChanged(gapi.client.getToken() !== null);
        resolve();
      }
      this.tokenClient.requestAccessToken();
    }).then(() => tryOrBackoff(action, delay)) : Promise.reject(x));
  }
  private getJSONByName(name: string) {
    return this.tryOrBackoff(() => (<any>gapi.client).drive.files.list({
      spaces: 'appDataFolder',
      q: `name = '${name}'`,
      fields: 'files(description)'
    }), 100).then((x: any) => x.result.files.length > 0 ? JSON.parse(x.result.files[0].description) : null);
  }
  private putJSONByName(name: string, value: any) {
    return this.tryOrBackoff(() => (<any>gapi.client).drive.files.list({
      spaces: 'appDataFolder',
      q: `name = '${name}'`,
      fields: 'files(id, name)'
    }), 100).then((x: any) => x.result.files).then(files => {
      if (!value) return files;
      if (files.length > 0) {
        const id = files.shift().id;
        return this.tryOrBackoff(() => (<any>gapi.client).drive.files.update({
          fileId: id,
          description: JSON.stringify(value)
        }), 100).then(() => files);
      } else {
        return this.tryOrBackoff(() => (<any>gapi.client).drive.files.create({
          parents: ['appDataFolder'],
          name: name,
          mimeType: 'application/vnd.google-apps.drive-sdk',
          description: JSON.stringify(value)
        }), 100).then(() => files);
      }
    }).then(files => files.reduce((promise: Promise<void>, x: any) =>
      promise.then(() => this.tryOrBackoff(() => (<any>gapi.client).drive.files.delete({fileId: x.id}), 100))
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
      const list = (token?: string): Promise<{date: string, items: Item[]}[]> => this.tryOrBackoff(() => (<any>gapi.client).drive.files.list({
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
    return this.runOutside(() => this.getJSONByName(this.toItemsName(date))).then(x => x ? <Item[]>x : []);
  }
  putItems(date: Date, items: Item[]) {
    return this.runOutside(() => this.putJSONByName(this.toItemsName(date), items.length > 0 ? items : null));
  }
  getAllItemsPerMonth(months: Date[]) {
    return this.runOutside(() => {
      const yms = months.map(x => this.toMonth(x));
      return this.tryOrBackoff(() => (<any>gapi.client).drive.files.list({
        spaces: 'appDataFolder',
        q: yms.map(x => `name contains 'items${x}'`).join(' or '),
        pageSize: 1000,
        fields: 'files(name, description)'
      }), 100).then((x: any) => {
        const ym2i: {[month: string]: Item[][]} = {};
        const items = yms.map((x, i) => ym2i[x] = <Item[][]>[]);
        x.result.files.forEach((x: any) =>
          ym2i[x.name.substr(5, 6)][+x.name.substr(11, 2)] = <Item[]>JSON.parse(x.description)
        );
        return items;
      });
    });
  }
}
