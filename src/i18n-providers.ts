import {TRANSLATIONS, TRANSLATIONS_FORMAT, LOCALE_ID} from '@angular/core';

export function getTranslationProviders(): Promise<any[]> {
  const locale = document['locale'] as string;
  if (!locale || locale === 'en-US') return Promise.resolve([]);
  return new Promise(resolve => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', `locale/messages.${locale}.xlf`);
    xhr.addEventListener('load', (event: any) => resolve([
      {provide: TRANSLATIONS, useValue: xhr.response},
      {provide: TRANSLATIONS_FORMAT, useValue: 'xlf'},
      {provide: LOCALE_ID, useValue: locale}
    ]));
    xhr.send();
  });
}
