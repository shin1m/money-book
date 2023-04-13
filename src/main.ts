/// <reference types="@angular/localize" />

import { NgModule } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { MoneyBookService, TestMoneyBookService } from './money-book.service';
import { AppComponent, AppModule } from './app';

@NgModule({
  imports: [AppModule],
  providers: [{provide: MoneyBookService, useClass: TestMoneyBookService}],
  bootstrap: [AppComponent]
})
class TestModule {}

//platformBrowserDynamic().bootstrapModule(TestModule)
platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err));
