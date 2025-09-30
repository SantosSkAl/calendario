import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { AppComponent } from './app/app.component';
import { CalendarPageComponent } from './app/calendar-page.component';
import { provideNativeDateAdapter } from '@angular/material/core';
// язык
import { LOCALE_ID } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { MAT_DATE_LOCALE }  from '@angular/material/core';
// смена стандартного стиля отображения даты
import { ES_PRETTY_FORMATS } from './app/event-utils';
import { MAT_DATE_FORMATS } from '@angular/material/core';

registerLocaleData(localeEs);


// bootstrapApplication(AppComponent).catch((err) => console.error(err));

bootstrapApplication(AppComponent, {
  providers: [
    provideAnimationsAsync(),
    provideNativeDateAdapter(),
    { provide: LOCALE_ID, useValue: 'es-ES' },
    { provide: MAT_DATE_LOCALE, useValue: 'es-ES' },
    { provide: MAT_DATE_FORMATS, useValue: ES_PRETTY_FORMATS } // смена стандартного стиля отображения даты
  ],
}).catch(err => console.error(err));

