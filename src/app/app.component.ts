import { Component , signal, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FullCalendarModule } from '@fullcalendar/angular';
import { CalendarOptions, DateSelectArg, EventClickArg, EventApi } from '@fullcalendar/core';
import interactionPlugin from '@fullcalendar/interaction';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import multiMonthPlugin from '@fullcalendar/multimonth';
import { INITIAL_EVENTS, INITIAL_EVENTS_ES, createEventId } from './event-utils';
import { NewTaskComponent } from "./new-task/new-task.component";
import { EventFormData, NewEventComponent } from './new-event/new-event.component';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import esLocale from '@fullcalendar/core/locales/es';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { ViewChild, TemplateRef, ViewContainerRef } from '@angular/core';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, FullCalendarModule, MatDialogModule,
    MatCardModule, MatIconModule, MatButtonModule, MatTooltipModule
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  private dialog = inject(MatDialog);
  private isDialogOpen = signal(false);
  calendarVisible = signal(true);
  calendarOptions = signal<CalendarOptions>({
    locales: [esLocale],
    locale: 'es',
    plugins: [
      interactionPlugin,
      dayGridPlugin,
      timeGridPlugin,
      listPlugin,
      multiMonthPlugin,
    ],
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek,multiMonthYear'
    },
    initialView: 'dayGridMonth',
    initialEvents: INITIAL_EVENTS_ES, // alternatively, use the `events` setting to fetch from a feed
    weekends: true,
    editable: true,
    selectable: true,
    selectMirror: true,
    dayMaxEvents: true,
    select: this.handleDateSelect.bind(this),
    eventClick: this.handleEventClick.bind(this),
    eventsSet: this.handleEvents.bind(this),
    /* you can update a remote database when these fire:
    eventAdd:
    eventChange:
    eventRemove:
    */
    eventContent: (arg) => {
      const title = document.createElement('div');
      title.textContent = arg.event.title;
      title.className = 'truncate-1';
      return { domNodes: [title] };
    }
  });
  currentEvents = signal<EventApi[]>([]);
  // isAddingTask = false
  @ViewChild('eventPopoverTpl') eventPopoverTpl!: TemplateRef<any>;
  private overlayRef?: OverlayRef;
  private overlay = inject(Overlay);
  private vcr = inject(ViewContainerRef);

  constructor(
    private changeDetector: ChangeDetectorRef,
    // private overlay: Overlay,
    // private vcr: ViewContainerRef
  ) {}

  handleCalendarToggle() {
    this.calendarVisible.update((bool) => !bool);
  }

  handleWeekendsToggle() {
    this.calendarOptions.update((options) => ({
      ...options,
      weekends: !options.weekends,
    }));
  }


  // оригинальное из доки
  // handleDateSelect(selectInfo: DateSelectArg) {
  //   const title = prompt('Please enter a new title for your event');
  //   const calendarApi = selectInfo.view.calendar;

  //   calendarApi.unselect(); // clear date selection

  //   if (title) {
  //     calendarApi.addEvent({
  //       id: createEventId(),
  //       title,
  //       start: selectInfo.startStr,
  //       end: selectInfo.endStr,
  //       allDay: selectInfo.allDay
  //     });
  //   }
  //   // this.isAddingTask = true
  // }

  // Поток «Создание события»
  handleDateSelect(selectInfo: DateSelectArg) {
    const calendarApi = selectInfo.view.calendar;
    calendarApi.unselect();

    // защита от повторных открытий диалога
    if (this.isDialogOpen() || this.dialog.openDialogs.length) return;
    this.isDialogOpen.set(true);

    // Передаём в форму исходный диапазон из select()
    const data: EventFormData = {
      mode: 'create',
      start: selectInfo.start,
      end: selectInfo.end,
      allDay: selectInfo.allDay
    };

    this.dialog.open(NewEventComponent, {
      data,
      width: '560px',
      maxWidth: '95vw',
      autoFocus: true,
      restoreFocus: true
    })
      .afterClosed()
      .subscribe((res?: { action: 'save'; value: any }) => {
        this.isDialogOpen.set(false);
        if (!res || res.action !== 'save') return;

        const v = res.value; // нормализованные поля из формы
        calendarApi.addEvent({ // Добавляем событие в календарь
          id: createEventId(),
          title: v.title,
          start: v.start, // 'YYYY-MM-DD' или 'YYYY-MM-DDTHH:mm'
          end: v.end || undefined, // null/undefined = без конца
          allDay: v.allDay,
          // любые ваши поля — в extendedProps
          extendedProps: {
            location: v.location,
            description: v.description
          }
        });
      });
  }

  // onCloseAddTask() {
  //   this.isAddingTask = false
  // }

  // оригинальное из доки
  // handleEventClick(clickInfo: EventClickArg) {
  //   if (confirm(`Are you sure you want to delete the event '${clickInfo.event.title}'`)) {
  //     clickInfo.event.remove();
  //   }
  // }
 
  // Поток «Редактирование события»
  // handleEventClick(clickInfo: EventClickArg) {
  onEditEvent(clickInfo: EventClickArg) {
    if (this.isDialogOpen() || this.dialog.openDialogs.length) return;
    this.isDialogOpen.set(true);

    const calendarApi = clickInfo.view.calendar;
    const e = clickInfo.event;
    // Предзаполняем форму данными выбранного события
    const data: EventFormData = {
      mode: 'edit',
      id: e.id,
      title: e.title,
      start: e.start ?? undefined,
      end: e.end ?? undefined,
      allDay: e.allDay,
      location: e.extendedProps['location'] ?? '',
      description: e.extendedProps['description'] ?? ''
    };

    this.dialog.open(NewEventComponent, {
      data,
      width: '560px',
      maxWidth: '95vw',
      autoFocus: true,
      restoreFocus: true
    })
      .afterClosed()
      .subscribe((res?: { action: 'save' | 'delete'; value?: any }) => {
        this.isDialogOpen.set(false);
        if (!res) return;
        if (res.action === 'delete') {
          e.remove();
          return;
        }
        if (res.action === 'save' && res.value) {
          const v = res.value;
          // из оригинальной доки, установка дат поочереди в существующее событие можеты вызывать глитчи/дубликаты
          // e.setProp('title', v.title);
          // e.setStart(v.start);
          // e.setEnd(v.end || null);
          // e.setAllDay(!!v.allDay);
          // e.setExtendedProp('location', v.location);
          // e.setExtendedProp('description', v.description);

          // // Метаданные отдельно:
          // e.setProp('title', v.title);
          // e.setExtendedProp('location', v.location);
          // e.setExtendedProp('description', v.description);
          // // Даты и allDay — АТОМАРНО, одним вызовом: (во избежание "дубликатов"/глитчей рендера)
          // e.setDates(v.start, v.end ?? null, { allDay: !!v.allDay });

          // обновление существующей заиси вызывает лгитч отрисовки на месячном фрейме при переходе timed -> all-day
          // поэтому тупо пересозадаем событие, не забыв подхватить оригинальны id
          const common = {
            id: e.id,                         // сохраняем тот же id
            title: v.title,
            start: v.start,                   // 'YYYY-MM-DD' или 'YYYY-MM-DDTHH:mm'
            end: v.end ?? null,
            allDay: !!v.allDay,
            extendedProps: {
              location: v.location,
              description: v.description
            }
          };

          e.remove();                    // полностью убираем старые сегменты
          calendarApi.addEvent(common);  // рисуем заново с нужным типом
        }
      });
  }

  handleEventClick(arg: EventClickArg) {
    arg.jsEvent.preventDefault();
    this.closeOverlay();

    const positionStrategy = this.overlay.position()
      .flexibleConnectedTo(arg.el)
      .withViewportMargin(8)
      .withPositions([
        // { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 8 },
        // { originX: 'end', originY: 'center', overlayX: 'start', overlayY: 'center', offsetX: 8 },
        // 1) Сверху (основной)
        { originX: 'center', originY: 'top',    overlayX: 'center', overlayY: 'bottom', offsetY: -8 },
        // 2) Снизу (fallback)
        { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top',    offsetY:  8 },
        // 3–4) Смещения по сторонам — на всякий
        { originX: 'end',    originY: 'center', overlayX: 'start',  overlayY: 'center', offsetX:  8 },
        { originX: 'start',  originY: 'center', overlayX: 'end',    overlayY: 'center', offsetX: -8 },
      ]);

    this.overlayRef = this.overlay.create({
      positionStrategy,
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-transparent-backdrop',
      scrollStrategy: this.overlay.scrollStrategies.close(),
    });

    // const data = arg.event.toPlainObject?.() ?? this.toPojo(arg.event);
    // const data = arg
    const portal = new TemplatePortal(this.eventPopoverTpl, this.vcr, { $implicit: arg });
    this.overlayRef.attach(portal);
    this.overlayRef.backdropClick().subscribe(() => this.closeOverlay());
  }

  // private toPojo(event: any) {
  //   return {
  //     id: event.id,
  //     title: event.title,
  //     start: event.start,
  //     end: event.end,
  //     allDay: event.allDay,
  //     extendedProps: event.extendedProps ?? {}
  //   };
  // }

  closeOverlay() { this.overlayRef?.dispose(); this.overlayRef = undefined; }

  handleEvents(events: EventApi[]) {
    this.currentEvents.set(events);
    this.changeDetector.detectChanges(); // workaround for pressionChangedAfterItHasBeenCheckedError
  }
}
