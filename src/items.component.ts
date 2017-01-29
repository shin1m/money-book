import {Component, EventEmitter, Input, OnInit, Output, QueryList, ViewChildren} from '@angular/core';
import {Observable} from 'rxjs/Observable';
import {Subject as RxSubject} from 'rxjs/Subject';
import 'rxjs/add/observable/fromPromise';
import 'rxjs/add/operator/debounceTime';
import 'rxjs/add/operator/distinctUntilChanged';
import 'rxjs/add/operator/switchMap';
import {MdSnackBar} from '@angular/material';
import {Subject, sortSubjects, Item, MoneyBookService} from './money-book.service';
import {CanComponentDeactivate} from './can-deactivate-guard.service';
import {MessageComponent} from './message.component';

@Component({
  selector: 'mb-select-subject',
  template: `
    <md-select [ngModel]="selected" (ngModelChange)="selected = $event; selectedChange.emit($event)">
      <md-option *ngFor="let subject of subjects" [value]="subject.id">
        {{subject[mnemonic]}} {{subject.name}}
      </md-option>
    </md-select>
  `
})
export class SelectSubjectComponent {
  @Input() subjects: Subject[];
  @Input() mnemonic: string;
  @Input() selected: number;
  @Output() selectedChange = new EventEmitter<number>();
}

@Component({
  template: `
    <mb-message name="confirm" i18n>Are you sure you want to discard changes?</mb-message>
    <mb-message name="saved" i18n>Saved</mb-message>
    <mb-message name="failed" i18n>Failed</mb-message>
    <mb-message name="close" i18n>Close</mb-message>
    <div class="centerable">
      <ng-container *ngIf="subjects && items">
        <md-toolbar>
          <md-input-container>
            <input md-input [disabled]="modified" [(ngModel)]="year" type="number" class="year" required>
          </md-input-container>
          <md-input-container>
            <input md-input [disabled]="modified" [(ngModel)]="month" type="number" class="month" required>
          </md-input-container>
          <md-input-container>
            <input md-input [disabled]="modified" [(ngModel)]="date" type="number" class="date" required>
          </md-input-container>
          <span class="app-toolbar-filler"></span>
          <button md-icon-button *ngIf="modified" [disabled]="waiting || invalid" (click)="save()" i18n-mdTooltip mdTooltip="Save">
            <md-icon>done</md-icon>
          </button>
          <button md-icon-button *ngIf="modified" [disabled]="waiting" (click)="discard()" i18n-mdTooltip mdTooltip="Discard">
            <md-icon>close</md-icon>
          </button>
        </md-toolbar>
        <table class="source">
          <tr>
            <td i18n>Source</td>
            <td class="select">
              <mb-select-subject [subjects]="sources" mnemonic="source" [(selected)]="source"></mb-select-subject>
            </td>
            <td>
              <md-chip-list>
                <md-chip *ngFor="let summary of summaries" [selected]="summary.id === source">
                  {{summary.name}} {{summary.count}}
                </md-chip>
              </md-chip-list>
            </td>
          </tr>
        </table>
        <table>
          <tr>
            <td i18n>Destination</td>
            <td i18n>Amount</td>
            <td i18n>Description</td>
            <td></td>
          </tr>
          <tr *ngFor="let item of itemsOfSource">
            <td>
              <mb-select-subject [subjects]="destinations" mnemonic="destination" [(selected)]="item.destination"></mb-select-subject>
            </td>
            <td>
              <md-input-container>
                <input md-input [(ngModel)]="item.amount" type="number" required class="amount" #amount="ngModel">
                <div [hidden]="!amount.invalid" class="error" i18n>Required</div>
              </md-input-container>
            </td>
            <td>
              <md-input-container>
                <input md-input [(ngModel)]="item.description">
              </md-input-container>
            </td>
            <td>
              <button md-icon-button (click)="remove(item)" i18n-mdTooltip mdTooltip="Delete this item">
                <md-icon>delete</md-icon>
              </button>
            </td>
          </tr>
          <tr>
            <td>
              <mb-select-subject [subjects]="destinations" mnemonic="destination" [(selected)]="newItem.destination"></mb-select-subject>
            </td>
            <td>
              <md-input-container>
                <input md-input [(ngModel)]="newItem.amount" type="number" required i18n-placeholder placeholder="New" class="amount" #amount="ngModel">
              </md-input-container>
            </td>
            <td>
              <md-input-container>
                <input md-input [(ngModel)]="newItem.description" required>
              </md-input-container>
            </td>
            <td>
              <button md-icon-button [disabled]="amount.invalid" (click)="add()" i18n-mdTooltip mdTooltip="Add new item">
                <md-icon>add</md-icon>
              </button>
            </td>
          </tr>
        </table>
      </ng-container>
      <md-spinner *ngIf="waiting" class="center"></md-spinner>
    </div>
  `,
  styles: [`
    input.year {
      width: 4em;
      text-align: right;
    }
    input.month {
      width: 3em;
      text-align: right;
    }
    input.date {
      width: 3em;
      text-align: right;
    }
    table.source {
      padding-top: 2em;
      padding-bottom: 2em;
    }
    table.source td.select {
      padding-left: 1em;
      padding-right: 1em;
    }
    input.amount {
      width: 4em;
      text-align: right;
    }
  `]
})
export class ItemsComponent implements OnInit, CanComponentDeactivate {
  private name2message: {[name: string]: string} = {};
  @ViewChildren(MessageComponent) set messages(values: QueryList<MessageComponent>) {
    values.forEach(x => this.name2message[x.name] = x.value);
  }
  waiting = true;
  subjects: {[id: number]: Subject};
  sources: Subject[];
  destinations: Subject[];
  private _date = new Date();
  private targetDates = new RxSubject<number>();
  items: Item[];
  private original: string;
  newItem: Item;
  source: number;
  constructor(private service: MoneyBookService, private snackBar: MdSnackBar) {
    this._date.setHours(0, 0, 0, 0);
  }
  ngOnInit() {
    this.targetDates.debounceTime(500).distinctUntilChanged().switchMap(x => {
      this.waiting = true;
      return Observable.fromPromise(this.service.getItems(new Date(x)));
    }).subscribe(x => {
      this.items = x;
      this.original = JSON.stringify(this.items);
      this.waiting = false;
    });
    this.service.getSubjects().then(x => {
      this.subjects = [];
      x.forEach(x => this.subjects[x.id] = x);
      this.sources = sortSubjects(x, 'source');
      this.destinations = sortSubjects(x, 'destination');
      this.setNewItem();
      this.source = this.sources[0].id;
      this.load();
    });
  }
  canDeactivate() {
    return !this.modified || confirm(this.name2message['confirm']);
  }
  private setNewItem() {
    this.newItem = new Item();
    this.newItem.destination = this.destinations[0].id;
  }
  get modified() {
    return JSON.stringify(this.items) !== this.original;
  }
  get invalid() {
    return this.items.some(x => typeof x.amount !== 'number');
  }
  private load() {
    this.waiting = true;
    this.service.getItems(this._date).then(x => {
      this.items = x;
      this.original = JSON.stringify(this.items);
      this.waiting = false;
    });
  }
  save() {
    this.waiting = true;
    const original = JSON.stringify(this.items);
    this.service.putItems(this._date, this.items).then(() => {
      this.original = original;
      this.snackBar.open(this.name2message['saved'], null, {duration: 1000});
    }, x => {
      console.log(x);
      this.snackBar.open(`${this.name2message['failed']}: ${x.message}`, this.name2message['close']);
    }).then(() => this.waiting = false);
  }
  discard() {
    if (this.canDeactivate()) this.load();
  }
  private setDate(value: Date) {
    if (value === this._date) return;
    this._date = value;
    this.targetDates.next(this._date.getTime());
  }
  get year() {
    return this._date.getFullYear();
  }
  set year(value: number) {
    this.setDate(new Date(value, this.month - 1, this.date));
  }
  get month() {
    return this._date.getMonth() + 1;
  }
  set month(value: number) {
    this.setDate(new Date(this.year, value - 1, this.date));
  }
  get date() {
    return this._date.getDate();
  }
  set date(value: number) {
    this.setDate(new Date(this.year, this.month - 1, value));
  }
  get itemsOfSource() {
    return this.items.filter(x => x.source === this.source);
  }
  get summaries() {
    const summaries: {id: number, name: string, count: number}[] = [];
    this.sources.forEach(subject => {
      const count = this.items.filter(x => x.source === subject.id).length;
      if (count > 0) summaries.push({id: subject.id, name: subject.name, count: count});
    });
    return summaries;
  }
  add() {
    this.newItem.source = this.source;
    this.items.push(this.newItem);
    this.setNewItem();
  }
  remove(item: Item) {
    this.items.splice(this.items.indexOf(item), 1);
  }
}
