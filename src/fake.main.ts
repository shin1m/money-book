import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { getTranslationProviders } from './i18n-providers';
import { FakeModule } from './fake.module';
import { environment } from './environments/environment';

if (environment.production) enableProdMode();

getTranslationProviders().then(x => platformBrowserDynamic().bootstrapModule(FakeModule, {providers: x}));
