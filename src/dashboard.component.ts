import {Component, HostListener, OnInit, QueryList, ViewChild, ViewChildren} from '@angular/core';
import {Observable} from 'rxjs/Observable';
import {Subject as RxSubject} from 'rxjs/Subject';
import 'rxjs/add/observable/fromPromise';
import 'rxjs/add/operator/debounceTime';
import 'rxjs/add/operator/distinctUntilChanged';
import 'rxjs/add/operator/switchMap';
import {MdDialog} from '@angular/material';
import {Subject, sortSubjects, Series, MoneyBookService} from './money-book.service';
import {MessageComponent} from './message.component';

@Component({
  selector: 'mb-select-subjects-dialog',
  template: `
    <h1 md-dialog-title i18n>Select Subjects</h1>
    <md-dialog-content>
      <div>
        <ng-container i18n>From</ng-container>
        <button md-button (click)="allSources(false)" i18n>None</button>
        <button md-button (click)="allSources(true)" i18n>All</button>
        <md-checkbox *ngFor="let subject of sources" [(ngModel)]="selectedSources[subject.id]">
          {{subject.source}} {{subject.name}}
        </md-checkbox>
      </div>
      <div>
        <ng-container i18n>To</ng-container>
        <button md-button (click)="allDestinations(false)" i18n>None</button>
        <button md-button (click)="allDestinations(true)" i18n>All</button>
        <md-checkbox *ngFor="let subject of destinations" [(ngModel)]="selectedDestinations[subject.id]">
          {{subject.destination}} {{subject.name}}
        </md-checkbox>
      </div>
    </md-dialog-content>
    <md-dialog-actions>
      <button md-icon-button md-dialog-close i18n-mdTootip mdTooltip="Close">
        <md-icon>close</md-icon>
      </button>
    </md-dialog-actions>
  `,
  styles: [`
    md-dialog-content > div {
      display: inline-block;
    }
    md-checkbox {
      display: block;
    }
    md-dialog-actions {
      text-align: right;
    }
  `]
})
export class SelectSubjectsDialog {
  sources: Subject[];
  selectedSources: {[id: number]: boolean};
  destinations: Subject[];
  selectedDestinations: {[id: number]: boolean};
  allSources(value: boolean) {
    this.sources.forEach(x => this.selectedSources[x.id] = value);
  }
  allDestinations(value: boolean) {
    this.destinations.forEach(x => this.selectedDestinations[x.id] = value);
  }
}

@Component({
  template: `
    <mb-message name="title" i18n>Monthly Totals</mb-message>
    <mb-message name="from" i18n>From</mb-message>
    <mb-message name="to" i18n>To</mb-message>
    <div class="centerable">
      <div *ngIf="sources">
        <md-toolbar>
          <button md-icon-button [disabled]="modified" (click)="month = month - 1" i18n-mdTooltip mdTooltip="Previous month">
            <md-icon>chevron_left</md-icon>
          </button>
          <md-input-container>
            <input md-input [(ngModel)]="year" type="number" class="year" required>
          </md-input-container>
          <md-input-container>
            <input md-input [(ngModel)]="month" type="number" class="month" required>
          </md-input-container>
          <button md-icon-button [disabled]="modified" (click)="month = month + 1" i18n-mdTooltip mdTooltip="Next month">
            <md-icon>chevron_right</md-icon>
          </button>
          <span class="app-toolbar-filler"></span>
          <button md-icon-button (click)="settings()" i18n-mdTooltip mdTooltip="Settings">
            <md-icon>settings</md-icon>
          </button>
        </md-toolbar>
	<chart [options]="options" #chart></chart>
      </div>
      <md-spinner *ngIf="waiting" class="center"></md-spinner>
    </div>
  `,
  styles: [`
    chart {
      display: block;
    }
    input.year {
      width: 3em;
      text-align: right;
    }
    input.month {
      width: 2em;
      text-align: right;
    }
  `]
})
export class DashboardComponent implements OnInit {
  private name2message: {[name: string]: string} = {};
  @ViewChildren(MessageComponent) set messages(values: QueryList<MessageComponent>) {
    values.forEach(x => this.name2message[x.name] = x.value);
  }
  waiting = true;
  private _month = new Date();
  private targetMonths = new RxSubject<number>();
  sources: Subject[];
  selectedSources: {[id: number]: boolean} = {};
  destinations: Subject[];
  selectedDestinations: {[id: number]: boolean} = {};
  options: Object;
  constructor(private service: MoneyBookService, private dialog: MdDialog) {
    this._month.setDate(1);
    this._month.setHours(0, 0, 0, 0);
  }
  ngOnInit() {
    this.targetMonths.debounceTime(500).distinctUntilChanged().switchMap(x => {
      this.waiting = true;
      return Observable.fromPromise(this.load(new Date(x)));
    }).subscribe(x => {
      this.draw(x);
      this.waiting = false;
    });
    this.service.getSubjects().then(x => {
      this.sources = sortSubjects(x, 'source');
      this.sources.forEach(x => this.selectedSources[x.id] = x.source !== '');
      this.destinations = sortSubjects(x, 'destination');
      this.destinations.forEach(x => this.selectedDestinations[x.id] = x.destination !== '');
      this.loadAndDraw();
    });
  }
  @ViewChild('chart') chart: any;
  @HostListener('window:resize') resize() {
    if (this.chart.chart) this.chart.chart.reflow();
  }
  private load(month: Date) {
    const months: Date[] = [];
    for (let i = 0; i < 12; ++i) months.push(new Date(month.getFullYear(), month.getMonth() - 11 + i));
    return this.service.getMonthlyTotals(months, this.selectedSources, this.selectedDestinations).then(x => {
      return {months: months, series: x};
    });
  }
  private draw({months, series: [series0, series1]}: {months: Date[], series: [Series, Series]}) {
    this.options = {
      chart: {type: 'column'},
      title: {text: this.name2message['title']},
      plotOptions: {
        column: {stacking: 'normal'}
      },
      xAxis: {
        categories: months.map(x => `${x.getFullYear()}-${x.getMonth() + 1}`)
      },
      yAxis: {
        title: {text: null}
      },
      series: this.sources.filter(x => this.selectedSources[x.id]).map(x => {
        return {
          name: `${this.name2message['from']} ${x.name}`,
          stack: 'source', data: series0[x.id]
        };
      }).concat(this.destinations.filter(x => this.selectedDestinations[x.id]).map(x => {
        return {
          name: `${this.name2message['to']} ${x.name}`,
          stack: 'destination', data: series1[x.id]
        };
      }))
    };
    setTimeout(() => this.resize());
  }
  private loadAndDraw() {
    this.waiting = true;
    return this.load(this._month).then(x => {
      this.draw(x);
      this.waiting = false;
    });
  }
  private setMonth(value: Date) {
    if (value === this._month) return;
    this._month = value;
    this.targetMonths.next(this._month.getTime());
  }
  get year() {
    return this._month.getFullYear();
  }
  set year(value: number) {
    this.setMonth(new Date(value, this.month - 1));
  }
  get month() {
    return this._month.getMonth() + 1;
  }
  set month(value: number) {
    this.setMonth(new Date(this.year, value - 1));
  }
  settings() {
    const dialogRef = this.dialog.open(SelectSubjectsDialog);
    const select = dialogRef.componentInstance;
    select.sources = this.sources;
    select.selectedSources = this.selectedSources;
    select.destinations = this.destinations;
    select.selectedDestinations = this.selectedDestinations;
    dialogRef.afterClosed().subscribe(result => this.loadAndDraw());
  }
}
