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
  ViewChildren,
  forwardRef
} from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  NG_VALUE_ACCESSOR,
  Validators
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs/Observable';
import { Subscription } from 'rxjs/Subscription';
import { Subject as RxSubject } from 'rxjs/Subject';
import 'rxjs/add/observable/fromEvent';
import 'rxjs/add/observable/fromPromise';
import 'rxjs/add/operator/debounceTime';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/switchMap';
import { MdSelect, MdSnackBar } from '@angular/material';
import { IMyOptions, IMyDate, IMyDateModel } from 'mydatepicker';
import { Subject, Item, MoneyBookService, sortSubjects } from './money-book.service';
import { CanComponentDeactivate } from './can-deactivate-guard.service';
import { MessageComponent } from './message.component';

@Component({
  selector: 'mb-select-subject',
  template: `
    <md-select (onClose) ="commit.emit()">
      <md-option *ngFor="let subject of subjects" [value]="subject.id">
        {{subject[mnemonic]}} {{subject.name}}
      </md-option>
    </md-select>
  `,
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => SelectSubjectComponent),
    multi: true
  }]
})
export class SelectSubjectComponent implements OnInit, ControlValueAccessor {
  @ViewChild(MdSelect) mdSelect: MdSelect;
  @Input() subjects: Subject[];
  @Input() mnemonic: string;
  @Output() commit = new EventEmitter<void>();
  private keydowns: Subscription;
  private onChange = (value: any) => {};
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
        if (!option) return;
        this.writeValue(option.value);
        this.onChange(option.value);
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
  writeValue(value: any) {
    setTimeout(() => this.mdSelect.writeValue(value), 0);
  }
  registerOnChange(fn: (any) => void) {
    this.onChange = fn;
    this.mdSelect.registerOnChange(fn);
  }
  registerOnTouched(fn: () => {}) {
    this.mdSelect.registerOnTouched(fn);
  }
  setDisabledState(isDisabled: boolean) {
    this.mdSelect.setDisabledState(isDisabled);
  }
  focus() {
    this.mdSelect.focus();
  }
}

function toYYYYMMDD(x: Date) {
  const pad = (x: number) => `${x < 10 ? '0' : ''}${x}`;
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

@Component({
  template: `
    <mb-message name="required" i18n>Required</mb-message>
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
                    <mb-select-subject [subjects]="sources" mnemonic="source" [formControl]="source"></mb-select-subject>
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
              <button type="button" md-icon-button *ngIf="modified" [disabled]="waiting || !items.valid" (click)="save()" i18n-mdTooltip mdTooltip="Save">
                <md-icon>done</md-icon>
              </button>
              <button type="button" md-icon-button *ngIf="modified" [disabled]="waiting" (click)="discard()" i18n-mdTooltip mdTooltip="Discard">
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
          <tr *ngFor="let item of itemsOfSource" [formGroup]="item">
            <td>
              <mb-select-subject [subjects]="destinations" mnemonic="destination" formControlName="destination"></mb-select-subject>
            </td>
            <td>
              <md-input-container>
                <input mdInput formControlName="amount" type="number" [placeholder]="item.get('amount').invalid ? messages['required'] : ''" required class="amount">
              </md-input-container>
            </td>
            <td>
              <md-input-container>
                <input mdInput formControlName="description">
              </md-input-container>
            </td>
            <td>
              <button type="button" md-icon-button (click)="remove(item)" i18n-mdTooltip mdTooltip="Delete this item">
                <md-icon>delete</md-icon>
              </button>
            </td>
          </tr>
          <tr [formGroup]="newItem">
            <td>
              <mb-select-subject [subjects]="destinations" mnemonic="destination" formControlName="destination" (commit)="newDestinationCommit()" #newDestination></mb-select-subject>
            </td>
            <td (keydown)="newAmountKeydown($event.key)">
              <md-input-container>
                <input mdInput formControlName="amount" type="number" required i18n-placeholder placeholder="New" class="amount" #newAmount>
              </md-input-container>
            </td>
            <td (keydown)="newDescriptionKeydown($event.key)">
              <md-input-container>
                <input mdInput formControlName="description" #newDescription>
              </md-input-container>
            </td>
            <td>
              <button type="button" md-icon-button [disabled]="!newItem.valid" (click)="add()" i18n-mdTooltip mdTooltip="Add new item">
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
export class ItemsComponent implements DoCheck, CanComponentDeactivate {
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
  private original = '[]';
  private source: FormControl;
  private items: FormArray;
  private newItem: FormGroup;
  summaries: {subject: Subject, count: number}[];
  itemsOfSource: AbstractControl[];
  modified: boolean;
  private modifieds = new RxSubject<boolean>();
  private myDatePickerOptions: IMyOptions = {
    firstDayOfWeek: 'su',
    inline: true
  };
  constructor(
    private service: MoneyBookService,
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MdSnackBar
  ) {
    this._date.setHours(0, 0, 0, 0);
    this.setMyDate();
    this.source = this.fb.control(0);
    this.items = this.fb.array([]);
    this.newItem = this.fb.group({
      destination: null,
      amount: [null, Validators.required],
      description: ''
    });
    const dates = this.route.params.map(params => params['date']);
    dates.filter(x => !x).subscribe(x => this.router.navigate(['/items', toYYYYMMDD(new Date())], {replaceUrl: true}));
    const subjects = this.service.getSubjects().then(x => {
      this.subjects = [];
      x.forEach(x => this.subjects[x.id] = x);
      this.sources = sortSubjects(x, 'source');
      this.destinations = sortSubjects(x, 'destination');
      this.source.reset(this.sources[0].id);
      this.resetNewItem();
    });
    dates.filter(x => x).switchMap(x => {
      this._date = new Date(x);
      this.setMyDate();
      this.waiting = true;
      return Observable.fromPromise(subjects.then(() => this.service.getItems(this._date)));
    }).subscribe(x => {
      this.resetItems(x);
      this.waiting = false;
    });
    this.targetDates.subscribe(x => this.router.navigate(['/items', toYYYYMMDD(new Date(x))]));
    this.modifieds.debounceTime(3000).filter(x => x).subscribe(x => {
      if (!this.waiting && this.modified && this.items.valid) this.save();
    });
  }
  ngDoCheck() {
    const items = this.items.controls;
    this.summaries = this.sources.map(subject => ({
      subject: subject,
      count: items.filter(x => x.get('source').value === subject.id).length
    })).filter(x => x.count > 0);
    const source = this.source.value;
    this.itemsOfSource = items.filter(x => x.get('source').value === source);
    this.modified = JSON.stringify(this.items.value) !== this.original;
    this.modifieds.next(this.modified);
  }
  canDeactivate() {
    return !this.modified || confirm(this.messages['confirm']);
  }
  private itemForm(item: Item) {
    return this.fb.group({
      source: item.source,
      destination: item.destination,
      amount: [item.amount, Validators.required],
      description: item.description
    });
  }
  private resetItems(items: Item[]) {
    this.items = this.fb.array(items.map(x => this.itemForm(x)));
    this.original = JSON.stringify(items);
  }
  private resetNewItem() {
    this.newItem.reset({
      amount: null,
      destination: this.destinations[0].id,
      description: ''
    });
  }
  save() {
    this.waiting = true;
    const original = JSON.stringify(this.items.value);
    this.service.putItems(this._date, this.items.value).then(() => {
      this.original = original;
      this.snackBar.open(this.messages['saved'], null, {duration: 1000});
    }, x => {
      console.log(x);
      this.snackBar.open(`${this.messages['failed']}: ${x.message}`, this.messages['close']);
    }).then(() => this.waiting = false);
  }
  discard() {
    if (!this.canDeactivate()) return;
    this.waiting = true;
    this.service.getItems(this._date).then(x => {
      this.resetItems(x);
      this.waiting = false;
    });
  }
  private myDate: IMyDate = {year: 0, month: 0, day: 0};
  private setMyDate() {
    this.myDate.year = this._date.getFullYear();
    this.myDate.month = this._date.getMonth() + 1;
    this.myDate.day = this._date.getDate();
  }
  onDateChanged(event: IMyDateModel) {
    this.myDate = event.date;
    this._date = event.jsdate;
    this.setMyDate();
    this.targetDates.next(this._date.getTime());
  }
  add() {
    this.items.push(this.itemForm(Object.assign({
      source: this.source.value
    }, this.newItem.value)));
    this.resetNewItem();
  }
  remove(item: FormGroup) {
    this.items.removeAt(this.items.controls.indexOf(item));
  }
  newDestinationCommit() {
    setTimeout(() => this.newAmount.nativeElement.focus(), 0);
  }
  newAmountKeydown(key: string) {
    if (!this.newItem.get('amount').valid || key !== 'Enter') return;
    setTimeout(() => this.newDescription.nativeElement.focus(), 0);
  }
  newDescriptionKeydown(key: string) {
    if (!this.newItem.valid || key !== 'Enter') return;
    this.add();
    setTimeout(() => this.newDestination.focus(), 0);
  }
}
