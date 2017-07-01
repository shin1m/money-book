import { NgModule } from '@angular/core';
import { MoneyBookService, FakeMoneyBookService } from './app/money-book.service';
import { AppComponent, AppModule } from './app/app.module';

@NgModule({
  imports: [AppModule],
  providers: [{provide: MoneyBookService, useClass: FakeMoneyBookService}],
  bootstrap: [AppComponent]
})
export class FakeModule {}
