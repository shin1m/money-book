import {Component, OnInit, QueryList, ViewChildren} from '@angular/core';
import {MdSnackBar} from '@angular/material';
import {Subject, MoneyBookService} from './money-book.service';
import {CanComponentDeactivate} from './can-deactivate-guard.service';
import {MessageComponent} from './message.component';

@Component({
  template: `
    <mb-message name="confirm" i18n>Are you sure you want to discard changes?</mb-message>
    <mb-message name="saved" i18n>Saved</mb-message>
    <mb-message name="failed" i18n>Failed</mb-message>
    <mb-message name="close" i18n>Close</mb-message>
    <div class="centerable">
      <ng-container *ngIf="subjects">
        <md-toolbar>
          <md-checkbox [(ngModel)]="includeRevoked" i18n>Include Revoked</md-checkbox>
          <span class="app-toolbar-filler"></span>
          <button md-icon-button *ngIf="modified" [disabled]="waiting || invalid" (click)="save()" i18n-mdTooltip mdTooltip="Save">
            <md-icon>done</md-icon>
          </button>
          <button md-icon-button *ngIf="modified" [disabled]="waiting" (click)="discard()" i18n-mdTooltip mdTooltip="Discard">
            <md-icon>close</md-icon>
          </button>
        </md-toolbar>
        <table>
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
              <md-input-container>
                <input md-input [(ngModel)]="subject.name" required #name="ngModel">
                <div [hidden]="!name.invalid" class="error" i18n>Required</div>
              </md-input-container>
            </td>
            <td>
              <md-input-container>
                <input md-input [(ngModel)]="subject.source" class="mnemonic">
              </md-input-container>
            </td>
            <td>
              <md-input-container>
                <input md-input [(ngModel)]="subject.destination" class="mnemonic">
              </md-input-container>
            </td>
            <td *ngIf="includeRevoked">
              <md-checkbox [(ngModel)]="subject.revoked"></md-checkbox>
            </td>
            <td>
              <button md-icon-button [disabled]="first" (click)="moveUp(subject)" i18n-mdTooltip mdTooltip="Move upward">
                <md-icon>arrow_upward</md-icon>
              </button>
              <button md-icon-button [disabled]="last" (click)="moveDown(subject)" i18n-mdTooltip mdTooltip="Move downward">
                <md-icon>arrow_downward</md-icon>
              </button>
            </td>
          </tr>
          <tr>
            <!-- <td>New</td> -->
            <td>
              <md-input-container>
                <input md-input [(ngModel)]="newSubject.name" required i18n-placeholder placeholder="New" #name="ngModel">
              </md-input-container>
            </td>
            <td>
              <md-input-container>
                <input md-input [(ngModel)]="newSubject.source" class="mnemonic">
              </md-input-container>
            </td>
            <td>
              <md-input-container>
                <input md-input [(ngModel)]="newSubject.destination" class="mnemonic">
              </md-input-container>
            </td>
            <td *ngIf="includeRevoked"></td>
            <td>
              <button md-icon-button [disabled]="name.invalid" (click)="add()" i18n-mdTooltip mdTooltip="Add new subject">
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
    input.mnemonic {
      width: 2em;
    }
  `]
})
export class SubjectsComponent implements OnInit, CanComponentDeactivate {
  private name2message: {[name: string]: string} = {};
  @ViewChildren(MessageComponent) set messages(values: QueryList<MessageComponent>) {
    values.forEach(x => this.name2message[x.name] = x.value);
  }
  waiting: boolean;
  subjects: Subject[];
  private original: string;
  includeRevoked = false;
  newSubject = new Subject();
  constructor(private service: MoneyBookService, private snackBar: MdSnackBar) {}
  ngOnInit() {
    this.load();
  }
  canDeactivate() {
    return !this.modified || confirm(this.name2message['confirm']);
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
      this.waiting = false;
    });
  }
  save() {
    this.waiting = true;
    const original = JSON.stringify(this.subjects);
    this.service.putSubjects(this.subjects).then(() => {
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
