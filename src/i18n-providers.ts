import {TRANSLATIONS, TRANSLATIONS_FORMAT, LOCALE_ID} from '@angular/core';

declare var System: any;

export function getTranslationProviders(): Promise<any[]> {
  const locale = document['locale'] as string;
  if (!locale || locale === 'en-US') return Promise.resolve([]);
  return System.import(`./locale/messages.${locale}.xlf!text`).then((x: any) => [
    {provide: TRANSLATIONS, useValue: x},
    {provide: TRANSLATIONS_FORMAT, useValue: 'xlf'},
    {provide: LOCALE_ID, useValue: locale}
  ]).catch((x: any): any[] => {
    console.log(x);
    return [];
  });
}
