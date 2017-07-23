import {
  AfterViewInit,
  Component,
  Directive,
  ElementRef,
  HostListener,
  Injectable,
  NgModule,
  QueryList,
  ViewChildren
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import {
  ActivatedRoute,
  ActivatedRouteSnapshot,
  CanActivate,
  NavigationEnd,
  Router,
  RouterModule,
  RouterStateSnapshot
} from '@angular/router';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { Subscription } from 'rxjs/Subscription';
import 'rxjs/add/operator/do';
import 'rxjs/add/operator/filter';
import 'rxjs/add/operator/first';
import { MaterialModule } from '@angular/material';
import { HighchartsStatic } from 'angular2-highcharts/dist/HighchartsService';
import { ChartModule } from 'angular2-highcharts';
import { MyDatePickerModule } from 'mydatepicker';
import { MoneyBookService, GoogleDriveMoneyBookService } from './money-book.service';
import { CanDeactivateGuard } from './can-deactivate-guard.service';
import { MessageComponent } from './message.component';
import { SubjectsComponent } from './subjects.component';
import { SelectSubjectComponent, ItemsComponent } from './items.component';
import { SelectSubjectsDialog, DashboardComponent } from './dashboard.component';
import { ImportCSVComponent } from './importcsv.component';
import { ExportCSVComponent } from './exportcsv.component';

@Injectable()
export class AuthGuard implements CanActivate {
  private onSignedIn: Subscription;
  private navigateOnSignedIn(url: string) {
    this.onSignedIn = this.service.isSignedIn.first(x => x).subscribe(x => {
      this.onSignedIn = null;
      this.router.navigate([url]);
    });
  }
  constructor(private service: MoneyBookService, private router: Router) {
    this.service.isSignedIn.filter(x => x === false).subscribe(x => {
      if (!this.onSignedIn) this.navigateOnSignedIn('');
    });
  }
  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    return this.service.isSignedIn.filter(x => x !== null).do(x => {
      if (!x) {
        if (this.onSignedIn) this.onSignedIn.unsubscribe();
        this.navigateOnSignedIn(state.url);
        this.router.navigate(['/signin']);
      }
    });
  }
}

@Component({
  template: `
    <div class="centerable">
      <md-spinner *ngIf="(service.isSignedIn | async) === null" class="center"></md-spinner>
    </div>
  `
})
export class SignInComponent {
  constructor(public service: MoneyBookService, private guard: AuthGuard) {}
}

declare var gapi: any;

@Component({
  selector: 'mb-app',
  template: `
    <mb-message name="dashboard" i18n>Dashboard</mb-message>
    <mb-message name="items" i18n>Items</mb-message>
    <mb-message name="subjects" i18n>Subjects</mb-message>
    <mb-message name="importcsv" i18n>Import CSV</mb-message>
    <mb-message name="exportcsv" i18n>Export CSV</mb-message>
    <md-sidenav-container>
      <md-sidenav #sidenav class="app-sidenav">
        <md-nav-list (click)="sidenav.close()">
          <a *ngFor="let item of menu" md-list-item [routerLink]="'/' + item.name" routerLinkActive="active">
            {{item.value}}
          </a>
        </md-nav-list>
      </md-sidenav>
      <md-toolbar *ngIf="service.isSignedIn | async" color="primary">
        <button class="app-icon-button" (click)="sidenav.open()">
          <i class="material-icons app-toolbar-menu">menu</i>
        </button>
        {{title}}
        <span class="app-toolbar-filler"></span>
        <a md-button (click)="signOut()" i18n>Sign Out</a>
      </md-toolbar>
      <div class="app-content">
        <div class="mb-signin2" [hidden]="(service.isSignedIn | async) !== false">
          <div id="mb-signin2">
            <button md-raised-button (click)="service.sign('In')" i18n>Sign In</button>
          </div>
        </div>
        <router-outlet></router-outlet>
      </div>
    </md-sidenav-container>
  `,
  styles: [`
    div.mb-signin2 {
      text-align: center;
    }
    #mb-signin2 {
      display: inline-block;
      margin-top: 5em;
    }
  `]
})
export class AppComponent implements AfterViewInit {
  menu: QueryList<MessageComponent>;
  @ViewChildren(MessageComponent) set messages(values: QueryList<MessageComponent>) {
    setTimeout(() => this.menu = values, 0);
  }
  title: string;
  constructor(public service: MoneyBookService, private router: Router, private route: ActivatedRoute) {
    this.router.events.filter(x => x instanceof NavigationEnd).subscribe(x => {
      const path = this.route.firstChild.snapshot.url[0].path;
      const item = this.menu ? this.menu.find(x => x.name === path) : null;
      this.title = item ? item.value : null;
    });
  }
  ngAfterViewInit() {
    if (typeof gapi !== 'undefined') this.service.isSignedIn.first(x => x === false).subscribe(x => gapi.signin2.render('mb-signin2'));
  }
  signOut() {
    this.router.navigate(['/signin']).then(x => {
      if (x) this.service.sign('Out');
    });
  }
}

@Directive({
  selector: 'input[type=number]'
})
export class EdgeInputNumberDirective {
  constructor(private element: ElementRef) {}
  @HostListener('keydown', ['$event']) onKeyDown(event: KeyboardEvent) {
    if (navigator.userAgent.indexOf('Edge/') < 0) return;
    switch (event.which) {
    case 38:
    case 40:
      setTimeout(() => this.element.nativeElement.dispatchEvent(new Event('change')), 0)
      break;
    }
  }
}

declare var Highcharts: any;

export function highchartsFactory() {
  //const Highcharts = require('highcharts');
  //require('highcharts/modules/drilldown')(Highcharts);
  Highcharts.setOptions({
    lang: {
      drillUpText: '\u21B0'
    }
  });
  return Highcharts;
}

@NgModule({
  imports: [
    ReactiveFormsModule,
    BrowserModule,
    BrowserAnimationsModule,
    /*ChartModule.forRoot(
      require('highcharts'),
      require('highcharts/modules/drilldown')
    ),*/
    ChartModule,
    MyDatePickerModule,
    RouterModule.forRoot([
      {
        path: 'signin',
        component: SignInComponent
      },
      {
        path: 'dashboard',
        component: DashboardComponent,
        canActivate: [AuthGuard]
      },
      {
        path: 'dashboard/:month',
        component: DashboardComponent,
        canActivate: [AuthGuard]
      },
      {
        path: 'items',
        component: ItemsComponent,
        canActivate: [AuthGuard],
        canDeactivate: [CanDeactivateGuard]
      },
      {
        path: 'items/:date',
        component: ItemsComponent,
        canActivate: [AuthGuard],
        canDeactivate: [CanDeactivateGuard]
      },
      {
        path: 'subjects',
        component: SubjectsComponent,
        canActivate: [AuthGuard],
        canDeactivate: [CanDeactivateGuard]
      },
      {
        path: 'importcsv',
        component: ImportCSVComponent,
        canActivate: [AuthGuard]
      },
      {
        path: 'exportcsv',
        component: ExportCSVComponent,
        canActivate: [AuthGuard]
      },
      {
        path: '',
        redirectTo: '/dashboard',
        pathMatch: 'full'
      }
    ]),
    MaterialModule
  ],
  declarations: [
    MessageComponent,
    SubjectsComponent,
    SelectSubjectComponent,
    ItemsComponent,
    SelectSubjectsDialog,
    DashboardComponent,
    ImportCSVComponent,
    ExportCSVComponent,
    SignInComponent,
    EdgeInputNumberDirective,
    AppComponent
  ],
  entryComponents: [
    SelectSubjectsDialog
  ],
  providers: [
    {provide: HighchartsStatic, useFactory: highchartsFactory},
    {provide: MoneyBookService, useClass: GoogleDriveMoneyBookService},
    AuthGuard,
    CanDeactivateGuard
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
