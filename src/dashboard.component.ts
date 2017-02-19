import {Component, HostListener, OnInit, QueryList, ViewChild, ViewChildren} from '@angular/core';
import {Observable} from 'rxjs/Observable';
import {Subject as RxSubject} from 'rxjs/Subject';
import 'rxjs/add/observable/fromPromise';
import 'rxjs/add/operator/debounceTime';
import 'rxjs/add/operator/distinctUntilChanged';
import 'rxjs/add/operator/switchMap';
import {MdDialog} from '@angular/material';
import {Subject, sortSubjects, Item, MoneyBookService} from './money-book.service';
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

interface Series {
  [subject: number]: number[];
}

class MonthlyTotals {
  private monthly: Series = [];
  private daily: {[month: number]: Series};

  constructor(
    private prefix: string,
    private stack: string,
    private subjects: Subject[],
    months: Date[]
  ) {
    this.daily = months.map(x => []);
    this.subjects.forEach(x => {
      this.monthly[x.id] = Array<number>(months.length).fill(0);
      months.forEach((y, i) => {
        const n = new Date(y.getFullYear(), y.getMonth() + 1, 0).getDate();
        this.daily[i][x.id] = Array<number>(n).fill(0);
      });
    });
  }
  add(month: number, date: number, subject: number, amount: number) {
    this.monthly[subject][month] += amount;
    this.daily[month][subject][date - 1] += amount;
  }
  private draw(series: Series, name: (i: number) => string) {
    return this.subjects.map(x => ({
      name: `${this.prefix} ${x.name}`,
      stack: this.stack,
      data: series[x.id].map((y, i) => ({
        name: name(i),
        y: y,
        drilldown: true
      }))
    }));
  }
  drawMonthly(categories: string[]) {
    return this.draw(this.monthly, i => categories[i]);
  }
  drawDaily(index: number) {
    return this.draw(this.daily[index], i => `${i + 1}`);
  }
}

@Component({
  template: `
    <mb-message name="monthly" i18n>Monthly Totals</mb-message>
    <mb-message name="daily" i18n>Daily Totals in </mb-message>
    <mb-message name="from" i18n>From</mb-message>
    <mb-message name="to" i18n>To</mb-message>
    <div class="centerable">
      <div *ngIf="sources">
        <md-toolbar>
          <button md-icon-button [disabled]="modified" (click)="month = month - 1" i18n-mdTooltip mdTooltip="Previous month">
            <md-icon>chevron_left</md-icon>
          </button>
          <md-input-container>
            <input mdInput [(ngModel)]="year" type="number" class="year" required>
          </md-input-container>
          <md-input-container>
            <input mdInput [(ngModel)]="month" type="number" class="month" required>
          </md-input-container>
          <button md-icon-button [disabled]="modified" (click)="month = month + 1" i18n-mdTooltip mdTooltip="Next month">
            <md-icon>chevron_right</md-icon>
          </button>
          <span class="app-toolbar-filler"></span>
          <button md-icon-button (click)="settings()" i18n-mdTooltip mdTooltip="Settings">
            <md-icon>settings</md-icon>
          </button>
        </md-toolbar>
        <chart [options]="options" (drilldown)="chartDrilldown($event)" (drillup)="chartDrillup($event)" #chart></chart>
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
  private months: Date[];
  private items: Item[][][];
  private categories: string[];
  private sourceTotals: MonthlyTotals;
  private destinationTotals: MonthlyTotals;
  options: Object;
  private drilldown: boolean;
  constructor(private service: MoneyBookService, private dialog: MdDialog) {
    this._month.setDate(1);
    this._month.setHours(0, 0, 0, 0);
  }
  ngOnInit() {
    this.targetMonths.debounceTime(500).distinctUntilChanged().switchMap(x => {
      this.waiting = true;
      return Observable.fromPromise(this.load(new Date(x)));
    }).subscribe(() => {
      this.draw();
      this.waiting = false;
    });
    this.service.getSubjects().then(x => {
      this.sources = sortSubjects(x, 'source');
      this.sources.forEach(x => this.selectedSources[x.id] = x.source !== '');
      this.destinations = sortSubjects(x, 'destination');
      this.destinations.forEach(x => this.selectedDestinations[x.id] = x.destination !== '');
      this.waiting = true;
      return this.load(this._month).then(() => {
        this.draw();
        this.waiting = false;
      });
    });
  }
  @ViewChild('chart') chart: any;
  @HostListener('window:resize') resize() {
    if (this.chart.chart) this.chart.chart.reflow();
  }
  chartDrilldown(e: any) {
    if (this.drilldown) return;
    this.drilldown = true;
    const index = e.originalEvent.category;
    this.chart.chart.setTitle({
      text: this.name2message['daily'] + this.categories[index]
    });
    this.sourceTotals.drawDaily(index)
    .concat(this.destinationTotals.drawDaily(index))
    .forEach((x, i) => this.chart.chart.addSingleSeriesAsDrilldown(e.originalEvent.points[i], x));
    this.chart.chart.applyDrilldown();
  }
  chartDrillup(e: any) {
    this.chart.chart.setTitle({
      text: this.name2message['monthly']
    });
    this.drilldown = false;
  }
  private load(month: Date) {
    this.months = [];
    for (let i = 0; i < 12; ++i) this.months.push(new Date(month.getFullYear(), month.getMonth() - 11 + i));
    this.categories = this.months.map(x => `${x.getFullYear()}-${x.getMonth() + 1}`);
    return this.service.getAllItemsPerMonth(this.months).then(x => this.items = x);
  }
  private draw() {
    const totals0 = new MonthlyTotals(this.name2message['from'], 'source', this.sources.filter(x => this.selectedSources[x.id]), this.months);
    const totals1 = new MonthlyTotals(this.name2message['to'], 'destination', this.destinations.filter(x => this.selectedDestinations[x.id]), this.months);
    this.items.forEach((x, i) => x.forEach((x, j) => {
      x.filter(x => this.selectedSources[x.source] && this.selectedDestinations[x.destination]).forEach(x => {
        totals0.add(i, j, x.source, x.amount);
        totals1.add(i, j, x.destination, x.amount);
      })
    }));
    this.sourceTotals = totals0;
    this.destinationTotals = totals1;
    this.options = {
      chart: {
        type: 'column',
        zoomType: 'xy'
      },
      title: {
        text: this.name2message['monthly']
      },
      plotOptions: {
        column: {stacking: 'normal'}
      },
      xAxis: {
        type: 'category',
        crosshair: true
      },
      yAxis: {
        title: {text: null}
      },
      tooltip: {
        shared: true
      },
      series: this.sourceTotals.drawMonthly(this.categories).concat(this.destinationTotals.drawMonthly(this.categories)),
      drilldown: {
        allowPointDrilldown: false
      }
    };
    this.drilldown = false;
    setTimeout(() => this.resize());
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
    dialogRef.afterClosed().subscribe(result => this.draw());
  }
}
