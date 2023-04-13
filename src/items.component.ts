import {
  Component,
  DoCheck,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Subject as RxSubject,
  fromEvent,
  debounceTime,
  distinctUntilChanged,
  filter,
  map
} from 'rxjs';
import { MatOption } from '@angular/material/core';
import { MatSelect } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, sortSubjects, Item, MoneyBookService } from './money-book.service';
import { CanComponentDeactivate } from './can-deactivate-guard.service';

@Component({
  selector: 'mb-select-subject',
  template: `
    <mat-form-field>
      <mat-select [ngModel]="selected" (ngModelChange)="select($event)" (openedChange)="opened($event)">
        <mat-option *ngFor="let subject of subjects" [value]="subject.id">
          {{subject[mnemonic]}} {{subject.name}}
        </mat-option>
      </mat-select>
    </mat-form-field>
  `
})
export class SelectSubjectComponent implements OnInit {
  @ViewChild(MatSelect) matSelect!: MatSelect;
  @Input() subjects!: Subject[];
  @Input() mnemonic!: keyof Subject;
  @Input() selected!: number;
  @Output() selectedChange = new EventEmitter<number>();
  @Output() commit = new EventEmitter<void>();
  constructor(private element: ElementRef) {}
  ngOnInit() {
    fromEvent<KeyboardEvent>(this.element.nativeElement, 'keydown', {capture: true}).subscribe(x => {
      if (x.key === 'Enter' && !this.matSelect.panelOpen) {
        x.stopPropagation();
        this.commit.emit();
      } else {
        const key = x.key.toLowerCase();
        this.matSelect.options.find(x => x.viewValue.toLowerCase().startsWith(key))?.select();
      }
    });
  }
  opened(value: boolean) {
    if (!value) this.focus();
  }
  select(value: number) {
    this.selected = value;
    this.selectedChange.emit(value);
  }
  focus() {
    return this.matSelect.focus();
  }
}

function toYYYYMMDD(x: Date) {
  const pad = (x: number) => `${x < 10 ? '0' : ''}${x}`;
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

@Component({
  template: `
    <div class="centerable">
      <ng-container *ngIf="subjects">
        <mat-calendar [selected]="date" (selectedChange)="changeDate($event)" [startAt]="date"></mat-calendar>
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
                    <mat-chip-listbox>
                      <mat-chip-option *ngFor="let summary of summaries; trackBy: bySubject" [highlighted]="summary.subject.id === source" selectable="false">
                        {{summary.subject.name}} {{summary.count}}
                      </mat-chip-option>
                    </mat-chip-listbox>
                  </td>
                </tr>
              </table>
            </td>
            <td>
              <span class="app-toolbar-filler"></span>
              <button mat-icon-button *ngIf="modified" [disabled]="waiting || invalid" (click)="save()" i18n-matTooltip matTooltip="Save">
                <mat-icon>done</mat-icon>
              </button>
              <button mat-icon-button *ngIf="modified" [disabled]="waiting" (click)="discard()" i18n-matTooltip matTooltip="Discard">
                <mat-icon>close</mat-icon>
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
              <mat-form-field class="amount">
                <input matInput [(ngModel)]="item.amount" type="number" required #amount="ngModel">
                <mat-error *ngIf="amount.invalid" i18n>Required</mat-error>
              </mat-form-field>
            </td>
            <td>
              <mat-form-field>
                <input matInput [(ngModel)]="item.description">
              </mat-form-field>
            </td>
            <td>
              <button *ngIf="item.source" mat-icon-button (click)="remove(item)" i18n-matTooltip matTooltip="Delete this item">
                <mat-icon>delete</mat-icon>
              </button>
            </td>
          </tr>
          <tr>
            <td>
              <mb-select-subject [subjects]="destinations" mnemonic="destination" [(selected)]="newItem.destination" (commit)="newDestinationCommit()" #newDestination></mb-select-subject>
            </td>
            <td (keydown)="newAmountKeydown($event.key)">
              <mat-form-field class="amount">
                <mat-label i18n>New</mat-label>
                <input matInput [(ngModel)]="newItem.amount" type="number" required #amount="ngModel" #newAmount>
                <mat-error *ngIf="amount.invalid" i18n>Required</mat-error>
              </mat-form-field>
            </td>
            <td (keydown)="newDescriptionKeydown($event.key)">
              <mat-form-field>
                <input matInput [(ngModel)]="newItem.description" #newDescription>
              </mat-form-field>
            </td>
            <td>
              <button mat-icon-button [disabled]="amount.invalid" (click)="add()" i18n-matTooltip matTooltip="Add new item">
                <mat-icon>add</mat-icon>
              </button>
            </td>
          </tr>
        </table>
      </ng-container>
      <mat-spinner *ngIf="waiting" class="center"></mat-spinner>
    </div>
  `,
  styles: [`
    mat-calendar {
      float: left;
      margin: 1em;
      width: 14em;
    }
    table.source {
      padding-top: 2em;
      padding-bottom: 2em;
    }
    table.source td.select {
      padding-left: 1em;
      padding-right: 1em;
    }
    .amount {
      width: 8em;
    }
    .amount input {
      text-align: right;
    }
  `]
})
export class ItemsComponent implements OnInit, DoCheck, CanComponentDeactivate {
  @ViewChild('newDestination') newDestination!: SelectSubjectComponent;
  @ViewChild('newAmount') newAmount!: ElementRef;
  @ViewChild('newDescription') newDescription!: ElementRef;
  waiting = true;
  subjects?: {[id: number]: Subject};
  sources: Subject[] = [];
  destinations!: Subject[];
  date!: Date;
  items: Item[] = [];
  private original = '[]';
  newItem: {destination: number, amount?: number, description: string} = {destination: 0, description: ''};
  source!: number;
  itemsOfSource?: Item[];
  summaries?: {subject: Subject, count: number}[];
  modified = false;
  invalid = false;
  private jsons = new RxSubject<string>();
  constructor(
    private service: MoneyBookService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}
  ngOnInit() {
    const dates = this.route.params.pipe(map(params => params['date']));
    dates.pipe(filter(x => !x)).subscribe(x => this.router.navigate(['/items', toYYYYMMDD(new Date())], {replaceUrl: true}));
    const subjects = this.service.getSubjects().then(x => {
      this.subjects = [];
      x.forEach(x => this.subjects![x.id] = x);
      this.sources = sortSubjects(x, 'source');
      this.destinations = sortSubjects(x, 'destination');
      this.resetNewItem();
      this.source = this.sources[0].id;
    });
    dates.pipe(filter(x => x)).subscribe(x => {
      this.date = new Date(x);
      subjects.then(() => this.load());
    });
    this.jsons.pipe(distinctUntilChanged(), debounceTime(3000)).subscribe(x => {
      if (!this.waiting && this.modified && !this.invalid) this.save();
    });
  }
  ngDoCheck() {
    this.itemsOfSource = this.items.filter(x => x.source === this.source);
    this.summaries = this.sources.map(subject => ({
      subject,
      count: this.items.filter(x => x.source === subject.id).length
    })).filter(x => x.count > 0);
    const json = JSON.stringify(this.items);
    this.modified = json !== this.original;
    this.invalid = this.items.some(x => typeof x.amount !== 'number') || typeof this.newItem.amount === 'number' || !!this.newItem.description;
    this.jsons.next(json);
  }
  canDeactivate() {
    return !this.modified || confirm($localize `Are you sure you want to discard changes?`);
  }
  bySubject(i: number, x: {subject: Subject}) {
    return x.subject;
  }
  private resetNewItem() {
    this.newItem.destination = this.destinations[0].id;
    this.newItem.amount = undefined;
    this.newItem.description = '';
  }
  private load() {
    this.waiting = true;
    this.service.getItems(this.date).then(x => {
      this.items = x;
      this.original = JSON.stringify(this.items);
      this.jsons.next(this.original);
      this.waiting = false;
    });
  }
  save() {
    this.waiting = true;
    const original = JSON.stringify(this.items);
    this.service.putItems(this.date, this.items).then(() => {
      this.original = original;
      this.snackBar.open($localize `Saved`, undefined, {duration: 1000});
    }, x => {
      console.log(x);
      this.snackBar.open(`${$localize `Failed`}: ${x.message}`, $localize `Close`);
    }).then(() => this.waiting = false);
  }
  discard() {
    if (this.canDeactivate()) this.load();
  }
  changeDate(value: Date) {
    this.router.navigate(['/items', toYYYYMMDD(value)]);
  }
  add() {
    const {destination, amount, description} = this.newItem;
    this.items.push({source: this.source, destination, amount: amount!, description});
    this.resetNewItem();
    this.newDestination.focus();
  }
  remove(item: Item) {
    this.items.splice(this.items.indexOf(item), 1);
  }
  newDestinationCommit() {
    this.newAmount.nativeElement.focus();
  }
  newAmountKeydown(key: string) {
    if (typeof this.newItem.amount === 'number' && key === 'Enter') this.newDescription.nativeElement.focus();
  }
  newDescriptionKeydown(key: string) {
    if (typeof this.newItem.amount === 'number' && key === 'Enter') this.add();
  }
}
