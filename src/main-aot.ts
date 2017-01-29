import {platformBrowser} from '@angular/platform-browser';
import {AppModuleNgFactory} from '../aot/src/app.ngfactory';

platformBrowser().bootstrapModuleFactory(AppModuleNgFactory);
