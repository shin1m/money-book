import { Component, Injectable, NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
import { Subscription, filter, first, map, tap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { DateAdapter, MatNativeDateModule, NativeDateAdapter } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HighchartsChartModule } from 'highcharts-angular';
import { MoneyBookService, GoogleDriveMoneyBookService } from './money-book.service';
import { CanDeactivateGuard } from './can-deactivate-guard.service';
import { SubjectsComponent } from './subjects.component';
import { SelectSubjectComponent, ItemsComponent } from './items.component';
import { SelectSubjectsDialog, DashboardComponent } from './dashboard.component';
import { ImportCSVComponent } from './importcsv.component';
import { ExportCSVComponent } from './exportcsv.component';

class CustomDateAdapter extends NativeDateAdapter {
  override getDateNames() {
    return Array.from(Array(31).keys(), i => `${i + 1}`);
  }
}

@Injectable()
export class AuthGuard implements CanActivate {
  private onSignedIn?: Subscription;
  private navigateOnSignedIn(url: string) {
    this.onSignedIn = this.service.isSignedIn.pipe(first(x => x === true)).subscribe(x => {
      this.onSignedIn = undefined;
      this.router.navigate([url]);
    });
  }
  constructor(private service: MoneyBookService, private router: Router) {
    this.service.isSignedIn.pipe(filter(x => x === false)).subscribe(x => {
      if (!this.onSignedIn) this.navigateOnSignedIn('');
    });
  }
  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    return this.service.isSignedIn.pipe(filter(x => x !== null), map(x => <boolean>x), tap(x => {
      if (!x) {
        if (this.onSignedIn) this.onSignedIn.unsubscribe();
        this.navigateOnSignedIn(state.url);
        this.router.navigate(['/signin']);
      }
    }));
  }
}

@Component({
  template: `
    <div class="centerable">
      <mat-spinner *ngIf="(service.isSignedIn | async) === null" class="center"></mat-spinner>
    </div>
  `
})
export class SignInComponent {
  constructor(public service: MoneyBookService, private guard: AuthGuard) {}
}

@Component({
  selector: 'mb-app',
  template: `
    <mat-sidenav-container>
      <mat-sidenav #sidenav class="app-sidenav">
        <mat-nav-list (click)="sidenav.close()">
          <a *ngFor="let item of menu" mat-list-item [routerLink]="'/' + item[0]" routerLinkActive="active">
            {{item[1]}}
          </a>
        </mat-nav-list>
      </mat-sidenav>
      <mat-sidenav-content>
        <mat-toolbar *ngIf="service.isSignedIn | async" color="primary">
          <button mat-icon-button class="app-icon-button" (click)="sidenav.open()">
            <i class="material-icons app-toolbar-menu">menu</i>
          </button>
          {{title}}
          <span class="app-toolbar-filler"></span>
          <a mat-button (click)="signOut()" i18n>Sign Out</a>
        </mat-toolbar>
        <div class="app-content">
          <div class="mb-signin2" [hidden]="(service.isSignedIn | async) !== false">
            <div id="mb-signin2">
              <button mat-raised-button (click)="service.signIn()" i18n>Sign In</button>
            </div>
          </div>
          <router-outlet></router-outlet>
        </div>
      </mat-sidenav-content>
    </mat-sidenav-container>
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
export class AppComponent {
  readonly menu = [
    ['dashboard', $localize `Dashboard`],
    ['items', $localize `Items`],
    ['subjects', $localize `Subjects`],
    ['importcsv', $localize `Import CSV`],
    ['exportcsv', $localize `Export CSV`]
  ];
  title?: string;
  constructor(public service: MoneyBookService, private router: Router, route: ActivatedRoute) {
    this.router.events.pipe(filter(x => x instanceof NavigationEnd)).subscribe(x => {
      const path = route.firstChild?.snapshot.url[0].path;
      this.title = this.menu.find(x => x[0] === path)?.[1];
    });
  }
  signOut() {
    this.router.navigate(['/signin']).then(x => {
      if (x) this.service.signOut();
    });
  }
}

@NgModule({
  imports: [
    FormsModule,
    BrowserModule,
    BrowserAnimationsModule,
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
    MatButtonModule,
    MatCheckboxModule,
    MatChipsModule,
    MatDatepickerModule,
    MatDialogModule,
    MatIconModule,
    MatInputModule,
    MatListModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSidenavModule,
    MatSnackBarModule,
    MatToolbarModule,
    MatTooltipModule,
    HighchartsChartModule
  ],
  declarations: [
    SubjectsComponent,
    SelectSubjectComponent,
    ItemsComponent,
    SelectSubjectsDialog,
    DashboardComponent,
    ImportCSVComponent,
    ExportCSVComponent,
    SignInComponent,
    AppComponent
  ],
  providers: [
    {provide: DateAdapter, useClass: CustomDateAdapter},
    {provide: MoneyBookService, useClass: GoogleDriveMoneyBookService},
    AuthGuard,
    CanDeactivateGuard
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
