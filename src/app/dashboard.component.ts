import {
  Component,
  HostListener,
  Inject,
  QueryList,
  ViewChild,
  ViewChildren
} from '@angular/core';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs/Observable';
import { Subject as RxSubject } from 'rxjs/Subject';
import 'rxjs/add/observable/fromPromise';
import 'rxjs/add/operator/debounceTime';
import 'rxjs/add/operator/distinctUntilChanged';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/switchMap';
import { MdDialog, MD_DIALOG_DATA } from '@angular/material';
import { Subject, sortSubjects, Item, MoneyBookService } from './money-book.service';
import { MessageComponent } from './message.component';

@Component({
  selector: 'mb-select-subjects-dialog',
  template: `
    <h1 md-dialog-title i18n>Select Subjects</h1>
    <md-dialog-content>
      <div [formGroup]="sources">
        <ng-container i18n>From</ng-container>
        <button type="button" md-button (click)="allSources(false)" i18n>None</button>
        <button type="button" md-button (click)="allSources(true)" i18n>All</button>
        <md-checkbox *ngFor="let subject of data.sources" [formControlName]="subject.id">
          {{subject.source}} {{subject.name}}
        </md-checkbox>
      </div>
      <div [formGroup]="destinations">
        <ng-container i18n>To</ng-container>
        <button type="button" md-button (click)="allDestinations(false)" i18n>None</button>
        <button type="button" md-button (click)="allDestinations(true)" i18n>All</button>
        <md-checkbox *ngFor="let subject of data.destinations" [formControlName]="subject.id">
          {{subject.destination}} {{subject.name}}
        </md-checkbox>
      </div>
    </md-dialog-content>
    <md-dialog-actions>
      <button type="button" md-icon-button md-dialog-close i18n-mdTootip mdTooltip="Close">
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
  sources: FormGroup;
  destinations: FormGroup;
  constructor(
    private fb: FormBuilder,
    @Inject(MD_DIALOG_DATA) public data: any
  ) {
    const build = (subjects, selected) => this.fb.group(subjects.reduce((map, x) => {
      const control = this.fb.control(selected[x.id]);
      control.valueChanges.subscribe(y => selected[x.id] = y);
      map[x.id] = control;
      return map;
    }, {}));
    this.sources = build(this.data.sources, this.data.selectedSources);
    this.destinations = build(this.data.destinations, this.data.selectedDestinations);
  }
  allSources(value: boolean) {
    this.data.sources.forEach(x => this.sources.get(`${x.id}`).setValue(value));
  }
  allDestinations(value: boolean) {
    this.data.destinations.forEach(x => this.destinations.get(`${x.id}`).setValue(value));
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
      this.monthly[x.id] = Array<number>(months.length).fill(null);
      months.forEach((y, i) => {
        const n = new Date(y.getFullYear(), y.getMonth() + 1, 0).getDate();
        this.daily[i][x.id] = Array<number>(n).fill(null);
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
    <mb-message name="from" i18n>From</mb-message>
    <mb-message name="to" i18n>To</mb-message>
    <div class="centerable">
      <div *ngIf="sources">
        <md-toolbar>
          <button type="button" md-icon-button [disabled]="modified" (click)="targetMonth.setValue(targetMonth.value - 1)" i18n-mdTooltip mdTooltip="Previous month">
            <md-icon>chevron_left</md-icon>
          </button>
          <md-input-container>
            <input mdInput [formControl]="targetYear" type="number" class="year" required>
          </md-input-container>
          <md-input-container>
            <input mdInput [formControl]="targetMonth" type="number" class="month" required>
          </md-input-container>
          <button type="button" md-icon-button [disabled]="modified" (click)="targetMonth.setValue(targetMonth.value + 1)" i18n-mdTooltip mdTooltip="Next month">
            <md-icon>chevron_right</md-icon>
          </button>
          <span *ngIf="drilldown === null" class="app-toolbar-filler" i18n>Monthly Totals</span>
          <span *ngIf="drilldown !== null" class="app-toolbar-filler">
            <ng-container i18n>Daily Totals in</ng-container> {{categories[drilldown]}}
          </span>
          <button type="button" md-icon-button (click)="settings()" i18n-mdTooltip mdTooltip="Settings">
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
    .app-toolbar-filler {
      text-align: center;
    }
  `]
})
export class DashboardComponent {
  private messages: {[name: string]: string} = {};
  @ViewChildren(MessageComponent) set messageComponents(values: QueryList<MessageComponent>) {
    values.forEach(x => this.messages[x.name] = x.value);
  }
  waiting = true;
  private targetYear: FormControl;
  private targetMonth: FormControl;
  private targetAt(i: number, day = 1) {
    return new Date(this.targetYear.value, this.targetMonth.value - 12 + i, day);
  }
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
  private drilldown: null | number = null;
  constructor(
    private service: MoneyBookService,
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MdDialog
  ) {
    this.targetYear = this.fb.control(0);
    this.targetMonth = this.fb.control(0);
    const setTarget = x => {
      x.setDate(1);
      x.setHours(0, 0, 0, 0);
      this.targetYear.setValue(x.getFullYear(), {emitEvent: false});
      this.targetMonth.setValue(x.getMonth() + 1, {emitEvent: false});
    };
    setTarget(new Date());
    const setAndNotifyTarget = x => {
      setTarget(x);
      this.targetMonths.next(x.getTime());
    };
    this.targetYear.valueChanges.subscribe(x => setAndNotifyTarget(new Date(x, this.targetMonth.value - 1)));
    this.targetMonth.valueChanges.subscribe(x => setAndNotifyTarget(new Date(this.targetYear.value, x - 1)));
    const months = this.route.params.map(params => params['month']);
    months.filter(x => !x).subscribe(x => this.router.navigate(['/dashboard', toYYYYMM(new Date())], {replaceUrl: true}));
    const subjects = this.service.getSubjects().then(x => {
      this.sources = sortSubjects(x, 'source');
      this.sources.forEach(x => this.selectedSources[x.id] = x.source !== '');
      this.destinations = sortSubjects(x, 'destination');
      this.destinations.forEach(x => this.selectedDestinations[x.id] = x.destination !== '');
    });
    months.filter(x => x).switchMap(x => {
      const xs = decodeURIComponent(x).split(',');
      const month = new Date(xs[0]);
      setTarget(month);
      if (this.months && month.getTime() === this.months[11].getTime()) return [{
        drilldown: xs[1]
      }];
      this.waiting = true;
      return Observable.fromPromise(subjects.then(() => {
        const months: Date[] = [];
        for (let i = 0; i < 12; ++i) months.push(this.targetAt(i));
        return this.service.getAllItemsPerMonth(months).then(x => ({
          months: months,
          items: x,
          drilldown: xs[1]
        }));
      }));
    }).subscribe((x: {
      months: Date[],
      items: Item[][][],
      drilldown: string
    }) => {
      if (x.months) {
        this.months = x.months;
        this.categories = this.months.map(toYYYYMM);
        this.items = x.items;
        this.draw();
        this.waiting = false;
      }
      if (x.drilldown) {
        const drilldown = +x.drilldown;
        if (drilldown !== this.drilldown) setTimeout(() => this.chart.chart.series[0].data[drilldown].firePointEvent('click'));
      } else {
        if (this.drilldown !== null) this.chart.chart.drillUp();
      }
    });
    this.targetMonths.debounceTime(500).distinctUntilChanged().subscribe(x => this.router.navigate(['/dashboard', toYYYYMM(new Date(x))]));
  }
  @ViewChild('chart') chart: any;
  @HostListener('window:resize') resize() {
    if (this.chart && this.chart.chart) this.chart.chart.reflow();
  }
  private navigated = false;
  chartDrilldown(e: any) {
    const index = e.originalEvent.category;
    if (this.drilldown === null) {
      this.drilldown = index;
      this.sourceTotals.drawDaily(index)
      .concat(this.destinationTotals.drawDaily(index))
      .forEach((x, i) => this.chart.chart.addSingleSeriesAsDrilldown(e.originalEvent.points[i], x));
      this.chart.chart.applyDrilldown();
      this.router.navigate(['/dashboard', `${toYYYYMM(this.targetAt(11))},${index}`]);
    } else if (!this.navigated) {
      this.navigated = true;
      this.router.navigate(['/items', toYYYYMMDD(this.targetAt(this.drilldown, index + 1))]);
    }
  }
  chartDrillup(e: any) {
    this.drilldown = null;
    this.router.navigate(['/dashboard', toYYYYMM(this.targetAt(11))]);
  }
  private draw() {
    const totals0 = new MonthlyTotals(this.messages['from'], 'source', this.sources.filter(x => this.selectedSources[x.id]), this.months);
    const totals1 = new MonthlyTotals(this.messages['to'], 'destination', this.destinations.filter(x => this.selectedDestinations[x.id]), this.months);
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
        animation: false,
        type: 'column',
        zoomType: 'xy'
      },
      credits: {
        enabled: false
      },
      title: {
        text: null
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
        formatter: function() {
          const list = (points: any[]) => {
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
          const left = this.points.filter((x: any) => x.series.columnIndex === 0)
          const right = this.points.filter((x: any) => x.series.columnIndex !== 0)
          return `
            <div><b>${this.points[0].key}</b></div>
            <table>
              <tr>
                ${list(left)}
                <td><span style="margin: 0.5em;">&rarr;</span></td>
                ${list(right)}
              </tr>
              <tr>
                <td></td><td></td><td></td><td></td>
                <td style="text-align: right;">
                  <b>${left.reduce((value: number, x: any) => value + x.y, 0)}</b>
                </td>
              </tr>
            </table>
          `;
        },
        shared: true,
        useHTML: true
      },
      series: this.sourceTotals.drawMonthly(this.categories).concat(this.destinationTotals.drawMonthly(this.categories)),
      drilldown: {
        allowPointDrilldown: false,
        animation: false
      }
    };
    this.drilldown = null;
    setTimeout(() => this.resize());
  }
  settings() {
    this.dialog.open(SelectSubjectsDialog, {
      data: {
        sources: this.sources,
        selectedSources: this.selectedSources,
        destinations: this.destinations,
        selectedDestinations: this.selectedDestinations
      }
    }).afterClosed().subscribe(result => this.draw());
  }
}
