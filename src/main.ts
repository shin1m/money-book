import {platformBrowserDynamic} from '@angular/platform-browser-dynamic';
import {getTranslationProviders} from './i18n-providers';
import {AppModule} from './app';

getTranslationProviders().then(x => platformBrowserDynamic().bootstrapModule(AppModule, {providers: x}));
