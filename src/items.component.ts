import {
  Component,
  DoCheck,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  QueryList,
  ViewChild,
  ViewChildren
} from '@angular/core';
import {Observable} from 'rxjs/Observable';
import {Subscription} from 'rxjs/Subscription';
import {Subject as RxSubject} from 'rxjs/Subject';
import 'rxjs/add/observable/fromEvent';
import 'rxjs/add/observable/fromPromise';
import 'rxjs/add/operator/debounceTime';
import 'rxjs/add/operator/distinctUntilChanged';
import 'rxjs/add/operator/switchMap';
import {MdSelect, MdSnackBar} from '@angular/material';
import {Subject, sortSubjects, Item, MoneyBookService} from './money-book.service';
import {CanComponentDeactivate} from './can-deactivate-guard.service';
import {MessageComponent} from './message.component';

@Component({
  selector: 'mb-select-subject',
  template: `
    <md-select [ngModel]="selected" (ngModelChange)="select($event)" (onClose) ="commit.emit()">
      <md-option *ngFor="let subject of subjects" [value]="subject.id">
        {{subject[mnemonic]}} {{subject.name}}
      </md-option>
    </md-select>
  `
})
export class SelectSubjectComponent implements OnInit {
  @ViewChild(MdSelect) mdSelect: MdSelect;
  @Input() subjects: Subject[];
  @Input() mnemonic: string;
  @Input() selected: number;
  @Output() selectedChange = new EventEmitter<number>();
  @Output() commit = new EventEmitter<void>();
  private keydowns: Subscription;
  private find(key: string) {
    key = key.toLowerCase();
    return this.mdSelect.options.find(x => x.viewValue.toLowerCase().startsWith(key));
  }
  constructor(private element: ElementRef) {}
  ngOnInit() {
    Observable.fromEvent(this.element.nativeElement, 'keydown', true).subscribe((x: KeyboardEvent) => {
      if (x.key === 'Enter') {
        x.stopPropagation();
        this.commit.emit();
      } else {
        const option = this.find(x.key);
        if (option) option.select();
        this.select(this.mdSelect.selected.value);
      }
    });
    this.mdSelect.overlayDir.attach.subscribe(() => {
      this.keydowns = Observable.fromEvent(this.mdSelect.overlayDir.overlayRef.overlayElement, 'keydown').subscribe((x: KeyboardEvent) => {
        const option = this.find(x.key);
        if (option) option.focus();
      });
    });
    this.mdSelect.overlayDir.detach.subscribe(() => this.keydowns.unsubscribe());
  }
  select(value: number) {
    this.selected = value;
    this.selectedChange.emit(value);
  }
  focus() {
    this.mdSelect.close();
  }
}

@Component({
  template: `
    <mb-message name="confirm" i18n>Are you sure you want to discard changes?</mb-message>
    <mb-message name="saved" i18n>Saved</mb-message>
    <mb-message name="failed" i18n>Failed</mb-message>
    <mb-message name="close" i18n>Close</mb-message>
    <div class="centerable">
      <ng-container *ngIf="subjects">
        <md-toolbar>
          <button md-icon-button [disabled]="modified" (click)="date = date - 1" i18n-mdTooltip mdTooltip="Previous day">
            <md-icon>chevron_left</md-icon>
          </button>
          <md-input-container>
            <input mdInput [disabled]="modified" [(ngModel)]="year" type="number" class="year" required>
          </md-input-container>
          <md-input-container>
            <input mdInput [disabled]="modified" [(ngModel)]="month" type="number" class="month" required>
          </md-input-container>
          <md-input-container>
            <input mdInput [disabled]="modified" [(ngModel)]="date" type="number" class="date" required>
          </md-input-container>
          <button md-icon-button [disabled]="modified" (click)="date = date + 1" i18n-mdTooltip mdTooltip="Next day">
            <md-icon>chevron_right</md-icon>
          </button>
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
                <md-chip *ngFor="let summary of summaries" [selected]="summary.subject.id === source">
                  {{summary.subject.name}} {{summary.count}}
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
                <input mdInput [(ngModel)]="item.amount" type="number" required class="amount" #amount="ngModel">
                <div [hidden]="!amount.invalid" class="error" i18n>Required</div>
              </md-input-container>
            </td>
            <td>
              <md-input-container>
                <input mdInput [(ngModel)]="item.description">
              </md-input-container>
            </td>
            <td>
              <button *ngIf="item.source" md-icon-button (click)="remove(item)" i18n-mdTooltip mdTooltip="Delete this item">
                <md-icon>delete</md-icon>
              </button>
            </td>
          </tr>
          <tr>
            <td>
              <mb-select-subject [subjects]="destinations" mnemonic="destination" [(selected)]="newItem.destination" (commit)="newDestinationCommit()" #newDestination></mb-select-subject>
            </td>
            <td (keydown)="newAmountKeydown($event.key)">
              <md-input-container>
                <input mdInput [(ngModel)]="newItem.amount" type="number" required i18n-placeholder placeholder="New" class="amount" #amount="ngModel" #newAmount>
              </md-input-container>
            </td>
            <td (keydown)="newDescriptionKeydown($event.key)">
              <md-input-container>
                <input mdInput [(ngModel)]="newItem.description" #newDescription>
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
      width: 3em;
      text-align: right;
    }
    input.month {
      width: 2em;
      text-align: right;
    }
    input.date {
      width: 2em;
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
export class ItemsComponent implements OnInit, DoCheck, CanComponentDeactivate {
  private name2message: {[name: string]: string} = {};
  @ViewChildren(MessageComponent) set messages(values: QueryList<MessageComponent>) {
    values.forEach(x => this.name2message[x.name] = x.value);
  }
  @ViewChild('newDestination') newDestination: SelectSubjectComponent;
  @ViewChild('newAmount') newAmount: ElementRef;
  @ViewChild('newDescription') newDescription: ElementRef;
  waiting = true;
  subjects: {[id: number]: Subject};
  sources: Subject[] = [];
  destinations: Subject[];
  private _date = new Date();
  private targetDates = new RxSubject<number>();
  items: Item[] = [];
  private original = '[]';
  newItem = new Item();
  source: number;
  itemsOfSource: Item[];
  summaries: {subject: Subject, count: number}[];
  modified: boolean;
  invalid: boolean;
  private modifieds = new RxSubject<boolean>();
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
    this.modifieds.debounceTime(3000).filter(x => x).subscribe(x => {
      if (!this.waiting && this.modified && !this.invalid) this.save();
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
  ngDoCheck() {
    this.itemsOfSource = this.items.filter(x => x.source === this.source);
    this.summaries = this.sources.map(subject => ({
      subject: subject,
      count: this.items.filter(x => x.source === subject.id).length
    })).filter(x => x.count > 0);
    this.modified = JSON.stringify(this.items) !== this.original;
    this.invalid = this.items.some(x => typeof x.amount !== 'number') || typeof this.newItem.amount === 'number' || !!this.newItem.description;
    this.modifieds.next(this.modified);
  }
  canDeactivate() {
    return !this.modified || confirm(this.name2message['confirm']);
  }
  private setNewItem() {
    this.newItem = new Item();
    this.newItem.destination = this.destinations[0].id;
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
    if (value.getTime() === this._date.getTime()) return;
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
  add() {
    this.newItem.source = this.source;
    this.items.push(this.newItem);
    this.setNewItem();
  }
  remove(item: Item) {
    this.items.splice(this.items.indexOf(item), 1);
  }
  newDestinationCommit() {
    setTimeout(() => this.newAmount.nativeElement.focus(), 0);
  }
  newAmountKeydown(key: string) {
    if (typeof this.newItem.amount !== 'number' || key !== 'Enter') return;
    setTimeout(() => this.newDescription.nativeElement.focus(), 0);
  }
  newDescriptionKeydown(key: string) {
    if (typeof this.newItem.amount !== 'number' || key !== 'Enter') return;
    this.add();
    setTimeout(() => this.newDestination.focus(), 0);
  }
}
