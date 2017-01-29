import {NgModule} from '@angular/core';
import {platformBrowserDynamic} from '@angular/platform-browser-dynamic';
import {getTranslationProviders} from './i18n-providers';
import {MoneyBookService, TestMoneyBookService} from './money-book.service';
import {AppComponent, AppModule} from './app';

@NgModule({
  imports: [AppModule],
  providers: [{provide: MoneyBookService, useClass: TestMoneyBookService}],
  bootstrap: [AppComponent]
})
class TestModule {}

getTranslationProviders().then(x => platformBrowserDynamic().bootstrapModule(TestModule, {providers: x}));
