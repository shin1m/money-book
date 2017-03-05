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
import {ActivatedRoute, Router} from '@angular/router';
import {Observable} from 'rxjs/Observable';
import {Subscription} from 'rxjs/Subscription';
import {Subject as RxSubject} from 'rxjs/Subject';
import 'rxjs/add/observable/fromEvent';
import 'rxjs/add/observable/fromPromise';
import 'rxjs/add/operator/debounceTime';
import 'rxjs/add/operator/distinctUntilChanged';
import 'rxjs/add/operator/switchMap';
import {MdSelect, MdSnackBar} from '@angular/material';
import {IMyOptions, IMyDate, IMyDateModel} from 'mydatepicker';
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

function toYYYYMMDD(x: Date) {
  const pad = (x: number) => `${x < 10 ? '0' : ''}${x}`;
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

@Component({
  template: `
    <mb-message name="confirm" i18n>Are you sure you want to discard changes?</mb-message>
    <mb-message name="saved" i18n>Saved</mb-message>
    <mb-message name="failed" i18n>Failed</mb-message>
    <mb-message name="close" i18n>Close</mb-message>
    <div class="centerable">
      <ng-container *ngIf="subjects">
        <my-date-picker [options]="myDatePickerOptions" i18n-locale locale="en" [selDate]="myDate" (dateChanged)="onDateChanged($event)"></my-date-picker>
        <table>
          <tr>
            <td colspan="3">
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
            </td>
            <td>
              <span class="app-toolbar-filler"></span>
              <button md-icon-button *ngIf="modified" [disabled]="waiting || invalid" (click)="save()" i18n-mdTooltip mdTooltip="Save">
                <md-icon>done</md-icon>
              </button>
              <button md-icon-button *ngIf="modified" [disabled]="waiting" (click)="discard()" i18n-mdTooltip mdTooltip="Discard">
                <md-icon>close</md-icon>
              </button>
            </td>
          </tr>
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
    my-date-picker {
      float: left;
      margin: 1em;
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
  private messages: {[name: string]: string} = {};
  @ViewChildren(MessageComponent) set messageComponents(values: QueryList<MessageComponent>) {
    values.forEach(x => this.messages[x.name] = x.value);
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
  private myDatePickerOptions: IMyOptions = {
    firstDayOfWeek: 'su',
    inline: true
  };
  constructor(
    private service: MoneyBookService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MdSnackBar
  ) {
    this._date.setHours(0, 0, 0, 0);
    this.setMyDate();
  }
  ngOnInit() {
    const dates = this.route.params.map(params => params['date']);
    dates.filter(x => !x).subscribe(x => this.router.navigate(['/items', toYYYYMMDD(new Date())], {replaceUrl: true}));
    const subjects = this.service.getSubjects().then(x => {
      this.subjects = [];
      x.forEach(x => this.subjects[x.id] = x);
      this.sources = sortSubjects(x, 'source');
      this.destinations = sortSubjects(x, 'destination');
      this.setNewItem();
      this.source = this.sources[0].id;
    });
    dates.filter(x => x).switchMap(x => {
      this._date = new Date(x);
      this.setMyDate();
      this.waiting = true;
      return Observable.fromPromise(subjects.then(() => this.service.getItems(this._date)));
    }).subscribe(x => {
      this.items = x;
      this.original = JSON.stringify(this.items);
      this.waiting = false;
    });
    this.targetDates.debounceTime(500).distinctUntilChanged().subscribe(x => this.router.navigate(['/items', toYYYYMMDD(new Date(x))]));
    this.modifieds.debounceTime(3000).filter(x => x).subscribe(x => {
      if (!this.waiting && this.modified && !this.invalid) this.save();
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
    return !this.modified || confirm(this.messages['confirm']);
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
      this.snackBar.open(this.messages['saved'], null, {duration: 1000});
    }, x => {
      console.log(x);
      this.snackBar.open(`${this.messages['failed']}: ${x.message}`, this.messages['close']);
    }).then(() => this.waiting = false);
  }
  discard() {
    if (this.canDeactivate()) this.load();
  }
  private myDate: IMyDate = {year: 0, month: 0, day: 0};
  private setMyDate() {
    this.myDate.year = this.year;
    this.myDate.month = this.month;
    this.myDate.day = this.date;
  }
  onDateChanged(event: IMyDateModel) {
    this.myDate = event.date;
    this._date = event.jsdate;
    this.setMyDate();
    this.targetDates.next(this._date.getTime());
  }
  get year() {
    return this._date.getFullYear();
  }
  get month() {
    return this._date.getMonth() + 1;
  }
  get date() {
    return this._date.getDate();
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
