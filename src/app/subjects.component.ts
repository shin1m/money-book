import { Component, OnInit, QueryList, ViewChildren } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { MdSnackBar } from '@angular/material';
import { Subject, MoneyBookService } from './money-book.service';
import { CanComponentDeactivate } from './can-deactivate-guard.service';
import { MessageComponent } from './message.component';

@Component({
  template: `
    <mb-message name="required" i18n>Required</mb-message>
    <mb-message name="confirm" i18n>Are you sure you want to discard changes?</mb-message>
    <mb-message name="saved" i18n>Saved</mb-message>
    <mb-message name="failed" i18n>Failed</mb-message>
    <mb-message name="close" i18n>Close</mb-message>
    <div class="centerable">
      <table *ngIf="subjects">
        <tr>
          <td class="include-revoked" colspan="3">
            <md-checkbox [formControl]="includeRevoked" i18n>Include Revoked</md-checkbox>
          </td>
          <td *ngIf="includeRevoked.value"></td>
          <td>
            <button type="button" md-icon-button *ngIf="modified" [disabled]="waiting || !subjects.valid" (click)="save()" i18n-mdTooltip mdTooltip="Save">
              <md-icon>done</md-icon>
            </button>
            <button type="button" md-icon-button *ngIf="modified" [disabled]="waiting" (click)="discard()" i18n-mdTooltip mdTooltip="Discard">
              <md-icon>close</md-icon>
            </button>
          </td>
        </tr>
        <tr>
          <!-- <th rowspan="2">ID</th> -->
          <th rowspan="2" i18n>Name</th>
          <th colspan="2" i18n>Mnemonic</th>
          <th *ngIf="includeRevoked.value" rowspan="2" i18n>Revoked</th>
          <th rowspan="2"></th>
        </tr>
        <tr>
          <th i18n>Src</th>
          <th i18n>Dst</th>
        </tr>
        <tr *ngFor="let subject of filteredSubjects; let first = first; let last = last" [formGroup]="subject">
          <!-- <td>{{subject.id}}</td> -->
          <td>
            <md-input-container>
              <input mdInput formControlName="name" [placeholder]="subject.get('name').invalid ? messages['required'] : ''" required>
            </md-input-container>
          </td>
          <td>
            <md-input-container>
              <input mdInput formControlName="source" class="mnemonic">
            </md-input-container>
          </td>
          <td>
            <md-input-container>
              <input mdInput formControlName="destination" class="mnemonic">
            </md-input-container>
          </td>
          <td *ngIf="includeRevoked.value">
            <md-checkbox formControlName="revoked"></md-checkbox>
          </td>
          <td>
            <button type="button" md-icon-button [disabled]="first" (click)="moveUp(subject)" i18n-mdTooltip mdTooltip="Move upward">
              <md-icon>arrow_upward</md-icon>
            </button>
            <button type="button" md-icon-button [disabled]="last" (click)="moveDown(subject)" i18n-mdTooltip mdTooltip="Move downward">
              <md-icon>arrow_downward</md-icon>
            </button>
          </td>
        </tr>
        <tr [formGroup]="newSubject">
          <!-- <td>New</td> -->
          <td>
            <md-input-container>
              <input mdInput formControlName="name" i18n-placeholder placeholder="New" required>
            </md-input-container>
          </td>
          <td>
            <md-input-container>
              <input mdInput formControlName="source" class="mnemonic">
            </md-input-container>
          </td>
          <td>
            <md-input-container>
              <input mdInput formControlName="destination" class="mnemonic">
            </md-input-container>
          </td>
          <td *ngIf="includeRevoked.value"></td>
          <td>
            <button type="button" md-icon-button [disabled]="!newSubject.valid" (click)="add()" i18n-mdTooltip mdTooltip="Add new subject">
              <md-icon>add</md-icon>
            </button>
          </td>
        </tr>
      </table>
      <md-spinner *ngIf="waiting" class="center"></md-spinner>
    </div>
  `,
  styles: [`
    .include-revoked {
      height: 3em;
    }
    input.mnemonic {
      width: 2em;
    }
  `]
})
export class SubjectsComponent implements OnInit, CanComponentDeactivate {
  private messages: {[name: string]: string} = {};
  @ViewChildren(MessageComponent) set messageComponents(values: QueryList<MessageComponent>) {
    values.forEach(x => this.messages[x.name] = x.value);
  }
  waiting: boolean;
  private original: string;
  private includeRevoked: FormControl;
  subjects: FormArray;
  private newSubject: FormGroup;
  constructor(
    private service: MoneyBookService,
    private fb: FormBuilder,
    private snackBar: MdSnackBar
  ) {
    this.includeRevoked = this.fb.control(false);
    this.newSubject = this.fb.group({
      name: ['', Validators.required],
      source: '',
      destination: ''
    });
  }
  ngOnInit() {
    this.load();
  }
  canDeactivate() {
    return !this.modified || confirm(this.messages['confirm']);
  }
  get modified() {
    return JSON.stringify(this.subjects.value) !== this.original;
  }
  private subjectForm(subject: Subject) {
    return this.fb.group({
      id: subject.id,
      name: [subject.name, Validators.required],
      source: subject.source,
      destination: subject.destination,
      revoked: subject.revoked
    });
  }
  private load() {
    this.waiting = true;
    this.service.getSubjects().then(x => {
      this.original = JSON.stringify(x);
      this.subjects = this.fb.array(x.map(x => this.subjectForm(x)));
      this.waiting = false;
    });
  }
  save() {
    this.waiting = true;
    const subjects = this.subjects.value;
    const original = JSON.stringify(subjects);
    this.service.putSubjects(subjects).then(() => {
      this.original = original;
      this.subjects.reset(subjects);
      this.snackBar.open(this.messages['saved'], null, {duration: 1000});
    }, x => {
      console.log(x);
      this.snackBar.open(`${this.messages['failed']}: ${x.message}`, this.messages['close']);
    }).then(() => this.waiting = false);
  }
  discard() {
    if (this.canDeactivate()) this.load();
  }
  get filteredSubjects() {
    const subjects = this.subjects.controls;
    return this.includeRevoked.value ? subjects : subjects.filter(x => !x.get('revoked').value);
  }
  add() {
    this.subjects.push(this.subjectForm(Object.assign({
      id: this.subjects.controls.reduce((value, x) => Math.max(value, x.get('id').value), 0) + 1,
      revoked: false
    }, this.newSubject.value)));
    this.newSubject.reset();
  }
  private moveOne(subject: FormGroup, sign: number) {
    const at = this.subjects.controls.indexOf(subject);
    var to = at + sign;
    if (!this.includeRevoked.value) while (this.subjects.at(to).get('revoked').value) to += sign;
    this.subjects.removeAt(at);
    this.subjects.insert(to, subject);
  }
  moveUp(subject: FormGroup) {
    this.moveOne(subject, -1);
  }
  moveDown(subject: FormGroup) {
    this.moveOne(subject, 1);
  }
}
