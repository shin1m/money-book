import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, MoneyBookService } from './money-book.service';
import { CanComponentDeactivate } from './can-deactivate-guard.service';

@Component({
  template: `
    <div class="centerable">
      <ng-container *ngIf="subjects">
        <table>
          <tr>
            <td class="include-revoked" colspan="3">
              <mat-checkbox [(ngModel)]="includeRevoked" i18n>Include Revoked</mat-checkbox>
            </td>
            <td *ngIf="includeRevoked"></td>
            <td>
              <button mat-icon-button *ngIf="modified" [disabled]="waiting || invalid" (click)="save()" i18n-matTooltip matTooltip="Save">
                <mat-icon>done</mat-icon>
              </button>
              <button mat-icon-button *ngIf="modified" [disabled]="waiting" (click)="discard()" i18n-matTooltip matTooltip="Discard">
                <mat-icon>close</mat-icon>
              </button>
            </td>
          </tr>
          <tr>
            <!-- <th rowspan="2">ID</th> -->
            <th rowspan="2" i18n>Name</th>
            <th colspan="2" i18n>Mnemonic</th>
            <th *ngIf="includeRevoked" rowspan="2" i18n>Revoked</th>
            <th rowspan="2"></th>
          </tr>
          <tr>
            <th i18n>Src</th>
            <th i18n>Dst</th>
          </tr>
          <tr *ngFor="let subject of getSubjects(); let index = index; let first = first; let last = last">
            <!-- <td>{{subject.id}}</td> -->
            <td>
              <mat-form-field>
                <input matInput [(ngModel)]="subject.name" required #name="ngModel">
                <mat-error *ngIf="name.invalid" i18n>Required</mat-error>
              </mat-form-field>
            </td>
            <td>
              <mat-form-field class="mnemonic">
                <input matInput [(ngModel)]="subject.source">
              </mat-form-field>
            </td>
            <td>
              <mat-form-field class="mnemonic">
                <input matInput [(ngModel)]="subject.destination">
              </mat-form-field>
            </td>
            <td *ngIf="includeRevoked">
              <mat-checkbox [(ngModel)]="subject.revoked"></mat-checkbox>
            </td>
            <td>
              <button mat-icon-button [disabled]="first" (click)="moveUp(subject)" i18n-matTooltip matTooltip="Move upward">
                <mat-icon>arrow_upward</mat-icon>
              </button>
              <button mat-icon-button [disabled]="last" (click)="moveDown(subject)" i18n-matTooltip matTooltip="Move downward">
                <mat-icon>arrow_downward</mat-icon>
              </button>
            </td>
          </tr>
          <tr>
            <!-- <td>New</td> -->
            <td>
              <mat-form-field>
                <mat-label i18n>New</mat-label>
                <input matInput [(ngModel)]="newSubject.name" required #name="ngModel">
                <mat-error *ngIf="name.invalid" i18n>Required</mat-error>
              </mat-form-field>
            </td>
            <td>
              <mat-form-field class="mnemonic">
                <input matInput [(ngModel)]="newSubject.source">
              </mat-form-field>
            </td>
            <td>
              <mat-form-field class="mnemonic">
                <input matInput [(ngModel)]="newSubject.destination">
              </mat-form-field>
            </td>
            <td *ngIf="includeRevoked"></td>
            <td>
              <button mat-icon-button [disabled]="name.invalid" (click)="add()" i18n-matTooltip matTooltip="Add new subject">
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
    .include-revoked {
      height: 3em;
    }
    .mnemonic {
      width: 3em;
    }
  `]
})
export class SubjectsComponent implements OnInit, CanComponentDeactivate {
  waiting = false;
  subjects!: Subject[];
  private original!: string;
  includeRevoked = false;
  newSubject = new Subject();
  constructor(private service: MoneyBookService, private snackBar: MatSnackBar) {}
  ngOnInit() {
    this.load();
  }
  canDeactivate() {
    return !this.modified || confirm($localize `Are you sure you want to discard changes?`);
  }
  get modified() {
    return JSON.stringify(this.subjects) !== this.original;
  }
  get invalid() {
    return this.subjects.some(x => !x.name);
  }
  private load() {
    this.waiting = true;
    this.service.getSubjects().then(x => {
      this.subjects = x;
      this.original = JSON.stringify(x);
    }).finally(() => this.waiting = false);
  }
  save() {
    this.waiting = true;
    const original = JSON.stringify(this.subjects);
    this.service.putSubjects(this.subjects).then(() => {
      this.original = original;
      this.snackBar.open($localize `Saved`, undefined, {duration: 1000});
    }, x => {
      console.log(x);
      this.snackBar.open(`${$localize `Failed`}: ${x.message}`, $localize `Close`);
    }).finally(() => this.waiting = false);
  }
  discard() {
    if (this.canDeactivate()) this.load();
  }
  getSubjects() {
    return this.includeRevoked ? this.subjects : this.subjects.filter(x => !x.revoked);
  }
  add() {
    this.newSubject.id = this.subjects.reduce((value, x) => Math.max(value, x.id), 0) + 1;
    this.subjects.push(this.newSubject);
    this.newSubject = new Subject();
  }
  private moveOne(subject: Subject, sign: number) {
    var from = this.subjects.indexOf(subject);
    var to = from + sign;
    if (!this.includeRevoked) while (this.subjects[to].revoked) to += sign;
    this.subjects.splice(from, 1);
    this.subjects.splice(to, 0, subject);
  }
  moveUp(subject: Subject) {
    this.moveOne(subject, -1);
  }
  moveDown(subject: Subject) {
    this.moveOne(subject, 1);
  }
}
