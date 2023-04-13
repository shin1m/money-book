import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Subject as RxSubject,
  from,
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  switchMap
} from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import * as Highcharts from 'highcharts';
import HCDrilldown from 'highcharts/modules/drilldown';
HCDrilldown(Highcharts);
import { Subject, sortSubjects, Item, MoneyBookService } from './money-book.service';

@Component({
  selector: 'mb-select-subjects-dialog',
  template: `
    <h1 mat-dialog-title i18n>Select Subjects</h1>
    <mat-dialog-content>
      <div>
        <ng-container i18n>From</ng-container>
        <button mat-button (click)="allSources(false)" i18n>None</button>
        <button mat-button (click)="allSources(true)" i18n>All</button>
        <mat-checkbox *ngFor="let subject of sources" [(ngModel)]="selectedSources[subject.id]">
          {{subject.source}} {{subject.name}}
        </mat-checkbox>
      </div>
      <div>
        <ng-container i18n>To</ng-container>
        <button mat-button (click)="allDestinations(false)" i18n>None</button>
        <button mat-button (click)="allDestinations(true)" i18n>All</button>
        <mat-checkbox *ngFor="let subject of destinations" [(ngModel)]="selectedDestinations[subject.id]">
          {{subject.destination}} {{subject.name}}
        </mat-checkbox>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions>
      <button mat-icon-button mat-dialog-close i18n-matTootip matTooltip="Close">
        <mat-icon>close</mat-icon>
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content > div {
      display: inline-block;
    }
    mat-checkbox {
      display: block;
    }
    mat-dialog-actions {
      text-align: right;
    }
  `]
})
export class SelectSubjectsDialog {
  sources!: Subject[];
  selectedSources!: {[id: number]: boolean};
  destinations!: Subject[];
  selectedDestinations!: {[id: number]: boolean};
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
    return this.subjects.map(x => (<Highcharts.SeriesColumnOptions><unknown>{
      type: 'column',
      name: `${this.prefix} ${x.name}`,
      stack: this.stack,
      data: series[x.id].map((y, i) => ({
        name: name(i),
        y,
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

function toYYYYMM(x: Date) {
  const pad = (x: number) => `${x < 10 ? '0' : ''}${x}`;
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}`;
}

function toYYYYMMDD(x: Date) {
  const pad = (x: number) => `${x < 10 ? '0' : ''}${x}`;
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

@Component({
  template: `
    <div class="centerable">
      <div *ngIf="sources">
        <mat-toolbar>
          <button mat-icon-button (click)="month = month - 1" i18n-matTooltip matTooltip="Previous month">
            <mat-icon>chevron_left</mat-icon>
          </button>
          <mat-form-field class="year">
            <input matInput [(ngModel)]="year" type="number" required>
          </mat-form-field>
          <mat-form-field class="month">
            <input matInput [(ngModel)]="month" type="number" required>
          </mat-form-field>
          <button mat-icon-button (click)="month = month + 1" i18n-matTooltip matTooltip="Next month">
            <mat-icon>chevron_right</mat-icon>
          </button>
          <span *ngIf="!drilldown" class="app-toolbar-filler" i18n>Monthly Totals</span>
          <span *ngIf="drilldown" class="app-toolbar-filler">
            <ng-container i18n>Daily Totals in</ng-container> {{categories[drilldown]}}
          </span>
          <button mat-icon-button (click)="settings()" i18n-matTooltip matTooltip="Settings">
            <mat-icon>settings</mat-icon>
          </button>
        </mat-toolbar>
        <highcharts-chart [Highcharts]="Highcharts" [options]="options" (chartInstance)="chartInstance($event)" #chart></highcharts-chart>
      </div>
      <mat-spinner *ngIf="waiting" class="center"></mat-spinner>
    </div>
  `,
  styles: [`
    highcharts-chart {
      display: block;
      height: 75vh;
    }
    .year {
      width: 6em;
    }
    .year input {
      text-align: right;
    }
    .month {
      width: 5em;
    }
    .month input {
      text-align: right;
    }
    .app-toolbar-filler {
      text-align: center;
    }
  `]
})
export class DashboardComponent implements OnInit {
  waiting = true;
  private _month = new Date();
  private targetMonths = new RxSubject<number>();
  sources?: Subject[];
  selectedSources: {[id: number]: boolean} = {};
  destinations!: Subject[];
  selectedDestinations: {[id: number]: boolean} = {};
  private months!: Date[];
  private items!: Item[][][];
  categories!: string[];
  private sourceTotals!: MonthlyTotals;
  private destinationTotals!: MonthlyTotals;
  Highcharts: typeof Highcharts = Highcharts;
  options: Highcharts.Options = {
    chart: {
      animation: false,
      type: 'column',
      zooming: {
        type: 'xy'
      },
      events: {}
    },
    credits: {
      enabled: false
    },
    title: {
      text: undefined
    },
    legend: {
      enabled: false
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
      formatter(): string {
        const list = (points: Highcharts.TooltipFormatterContextObject[]) => {
          points = points.filter(x => x.y !== null);
          return `
            <td>
              ${points.map(x => `
                <div>
                  <span style="color: ${x.color};">\u25CF</span>
                  ${x.series.name}:
                </div>
              `).join('')}
            </td>
            <td style="text-align: right;">
              ${points.map(x => `<div><b>${x.y}</b></div>`).join('')}
            </td>
          `;
        };
        const points = this.points!;
        const left = points.filter(x => x.series.userOptions.stack === 'source');
        const right = points.filter(x => x.series.userOptions.stack === 'destination');
        return `
          <div><b>${points[0].key}</b></div>
          <table>
            <tr>
              ${list(left)}
              <td><span style="margin: 0.5em;">&rarr;</span></td>
              ${list(right)}
            </tr>
            <tr>
              <td></td><td></td><td></td><td></td>
              <td style="text-align: right;">
                <b>${left.reduce((value, x) => value + x.y!, 0)}</b>
              </td>
            </tr>
          </table>
        `;
      },
      shared: true,
      useHTML: true
    },
    drilldown: {
      allowPointDrilldown: false,
      animation: false,
      breadcrumbs: {
        showFullPath: false,
        format: $localize `Back to Monthly Totals`
      }
    }
  };
  drilldown?: number;
  constructor(
    private service: MoneyBookService,
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog
  ) {
    this.options.chart!.events!.drilldown = e => this.chartDrilldown(e);
    this.options.chart!.events!.drillup = e => {
      this.drilldown = undefined;
      this.router.navigate(['/dashboard', toYYYYMM(this._month)]);
    };
  }
  ngOnInit() {
    const months = this.route.params.pipe(map(params => params['month']));
    months.pipe(filter(x => !x)).subscribe(x => this.router.navigate(['/dashboard', toYYYYMM(new Date())], {replaceUrl: true}));
    const subjects = this.service.getSubjects().then(x => {
      this.sources = sortSubjects(x, 'source');
      this.sources.forEach(x => this.selectedSources[x.id] = x.source !== '');
      this.destinations = sortSubjects(x, 'destination');
      this.destinations.forEach(x => this.selectedDestinations[x.id] = x.destination !== '');
    });
    months.pipe(filter(x => x), switchMap(x => {
      const xs = decodeURIComponent(x).split(',');
      this._month = new Date(xs[0]);
      this._month.setHours(0, 0, 0, 0);
      if (this.months && this._month.getTime() === this.months[11].getTime()) return [{
        drilldown: xs[1]
      }];
      this.waiting = true;
      return from(subjects.then(() => {
        const months: Date[] = [];
        for (let i = 0; i < 12; ++i) months.push(new Date(this.year, this.month - 12 + i));
        return this.service.getAllItemsPerMonth(months).then(x => ({
          months: months,
          items: x,
          drilldown: xs[1]
        }));
      }));
    })).subscribe((x: {
      months?: Date[],
      items?: Item[][][],
      drilldown: string
    }) => {
      if (x.months) {
        this.months = x.months;
        this.categories = this.months.map(toYYYYMM);
        this.items = x.items!;
        this.draw();
        this.waiting = false;
      }
      if (x.drilldown) {
        const drilldown = +x.drilldown;
        if (drilldown !== this.drilldown) setTimeout(() => this.chart.xAxis[0].drilldownCategory(drilldown));
      } else {
        if (this.drilldown) this.chart.drillUp();
      }
    });
    this.targetMonths.pipe(debounceTime(500), distinctUntilChanged()).subscribe(x => this.router.navigate(['/dashboard', toYYYYMM(new Date(x))]));
  }
  private chart!: Highcharts.Chart;
  chartInstance(value: Highcharts.Chart) {
    this.chart = value;
  }
  private navigated = false;
  chartDrilldown(e: Highcharts.DrilldownEventObject) {
    const index = e.category!;
    if (!this.drilldown) {
      this.drilldown = index;
      this.sourceTotals.drawDaily(index)
      .concat(this.destinationTotals.drawDaily(index))
      .forEach((x, i) => (<any>this.chart).addSingleSeriesAsDrilldown((<Highcharts.Point[]>e.points)[i], x));
      (<any>this.chart).applyDrilldown();
      this.router.navigate(['/dashboard', `${toYYYYMM(this._month)},${index}`]);
    } else if (!this.navigated) {
      this.navigated = true;
      this.router.navigate(['/items', toYYYYMMDD(new Date(this.year, this.month - 12 + this.drilldown, index + 1))]);
    }
  }
  private draw() {
    if (this.drilldown) this.chart.drillUp();
    const totals0 = new MonthlyTotals($localize `From`, 'source', this.sources!.filter(x => this.selectedSources[x.id]), this.months);
    const totals1 = new MonthlyTotals($localize `To`, 'destination', this.destinations.filter(x => this.selectedDestinations[x.id]), this.months);
    this.items.forEach((x, i) => x.forEach((x, j) => {
      x.filter(x => this.selectedSources[x.source] && this.selectedDestinations[x.destination]).forEach(x => {
        totals0.add(i, j, x.source, x.amount);
        totals1.add(i, j, x.destination, x.amount);
      })
    }));
    this.sourceTotals = totals0;
    this.destinationTotals = totals1;
    [...this.chart.series].forEach(x => x.remove(false));
    this.sourceTotals.drawMonthly(this.categories).concat(this.destinationTotals.drawMonthly(this.categories)).forEach(x => this.chart.addSeries(x, false));
    this.chart.redraw();
  }
  private setMonth(value: Date) {
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
    select.sources = this.sources!;
    select.selectedSources = this.selectedSources;
    select.destinations = this.destinations;
    select.selectedDestinations = this.selectedDestinations;
    dialogRef.afterClosed().subscribe(result => this.draw());
  }
}
