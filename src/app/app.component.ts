import { Component , signal, ChangeDetectorRef, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FullCalendarComponent, FullCalendarModule } from '@fullcalendar/angular';
import { CalendarOptions, DateSelectArg, EventClickArg, EventApi, Calendar } from '@fullcalendar/core';
import interactionPlugin from '@fullcalendar/interaction';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import multiMonthPlugin from '@fullcalendar/multimonth';
import { INITIAL_EVENTS_ES, SLOT, SLOTS_PER_HOUR, createEventId } from './event-utils';
import { EventFormData, NewEventComponent } from './new-event/new-event.component';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import esLocale from '@fullcalendar/core/locales/es';

import { FormsModule } from '@angular/forms';  
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { ViewChild, TemplateRef, ViewContainerRef } from '@angular/core';

import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { CardModule } from 'primeng/card';
import { OverlayPanel, OverlayPanelModule } from 'primeng/overlaypanel';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, FullCalendarModule, MatDialogModule,
    MatCardModule, MatIconModule, MatButtonModule,
    MatTooltipModule, FormsModule,
    ButtonModule, TooltipModule, CardModule,
    OverlayPanelModule, NewEventComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  // private dialog = inject(MatDialog);
  // private isDialogOpen = signal(false);

  //p
  @ViewChild('fc') fc!: FullCalendarComponent;   // по шаблонной ссылке
  private calendarApi?: Calendar;
  @ViewChild('op') op!: OverlayPanel;
  selectedEvent: EventClickArg | null = null;
  showDialog = false;  // состояние окна
  dialogMode: 'create' | 'edit' = 'create';
  dialogData: any = null;
  private opening = false;

  slotTime = SLOT // '10:00'
  slot = SLOTS_PER_HOUR // 6
  slotOptions: number[] = [2, 3, 6, 12];

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
    businessHours: [
      { daysOfWeek: [1,2,3,4,5], startTime: '00:00', endTime: '24:00' }
    ],
    selectConstraint: 'businessHours',
    eventConstraint:  'businessHours',
    viewDidMount: (info) => {
      const viewType = info.view.type;
      
      let newBusinessHours;
      if (viewType === 'timeGridWeek' || viewType === 'timeGridDay') {
        // Для недели и дня - с временными интервалами
        newBusinessHours = [
          { daysOfWeek: [1, 2, 3, 4, 5], startTime: '08:00', endTime: '12:00' },
          { daysOfWeek: [1, 2, 3, 4, 5], startTime: '14:00', endTime: '18:00' },
        ];
      } else {
        // Для месяца и года - только рабочие дни
        newBusinessHours = {
          daysOfWeek: [1, 2, 3, 4, 5], startTime: '00:00', endTime: '24:00'
        };
      }
      
      this.calendarOptions.update((options) => ({
        ...options,
        businessHours: newBusinessHours,
      }));
    },
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek,multiMonthYear'
    },
    initialView: 'dayGridMonth',
    slotDuration: this.slotTime,          // кол-во строк в час
    snapDuration: this.slotTime,          // шаг выделения/перетаскивания
    slotLabelFormat: { hour: 'numeric', minute: '2-digit', hour12: false }, 
    slotLabelInterval: '00:10',  // подписи каждый час (можно '00:30' и т.п.)
    // опционально ограничить видимые часы
    slotMinTime: '06:00:00',
    slotMaxTime: '20:00:00',
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
  // private overlayRef?: OverlayRef;
  // private overlay = inject(Overlay);
  // private vcr = inject(ViewContainerRef);

  constructor(
    private changeDetector: ChangeDetectorRef,
  ) {}

  ngAfterViewInit() {
    // будет доступен после инициализации вью
    this.calendarApi = this.fc.getApi();
  }

  // вспомогательно, чтобы безопасно брать API
  private getApi(): Calendar | undefined {
    return this.calendarApi ?? this.fc?.getApi();
  }

  handleCalendarToggle() {
    this.calendarVisible.update((bool) => !bool);
  }

  handleWeekendsToggle() {
    this.calendarOptions.update((options) => ({
      ...options,
      weekends: !options.weekends,
    }));
  }

  setSlot(value: number) {
    this.slotTime = `00:${String(Math.floor(60 / value)).padStart(2, '0')}`
    this.calendarOptions.update((options) => ({
      ...options,
      slotDuration: this.slotTime,          
      snapDuration: this.slotTime, 
    }));
  }

  

  handleEventClick(arg: EventClickArg) {
    arg.jsEvent.preventDefault();
    this.selectedEvent = arg;
    console.log('eventClick')
    this.op.toggle(arg.jsEvent as MouseEvent, arg.el as HTMLElement); // открыть/закрыть панель в точке клика
  }

  handleDateSelect(selectInfo: DateSelectArg) {
    this.getApi()?.unselect();
    const { start, end, allDay } = selectInfo;
    console.log('dateClick')
    // this.dialogMode = 'create';
    // this.dialogData = { mode: 'create', start, end, allDay };
    // this.showDialog = true;
    this.openDialog('create', { mode: 'create', start, end, allDay });
  }

  onEditEvent(clickInfo: EventClickArg) {
    this.op.hide();
    console.log('editClick')
    this.selectedEvent = null; // закроем превью
    // this.dialogMode = 'edit';
    const e = clickInfo.event;
    // this.dialogData = {
    //   mode: 'edit',
    //   id: e.id,
    //   title: e.title,
    //   start: e.start,
    //   end: e.end,
    //   allDay: e.allDay,
    //   location: e.extendedProps['location'] || '',
    //   description: e.extendedProps['description'] || ''
    // };
    // this.showDialog = true;  // откроется форма с заполненными данными
    this.openDialog('edit', {
      mode: 'edit',
      id: e.id,
      title: e.title,
      start: e.start,
      end: e.end,
      allDay: e.allDay,
      location: e.extendedProps['location'] || '',
      description: e.extendedProps['description'] || ''
    });
  }

  onEventSaved(v: any) {
    const calendarApi = this.getApi();
    if (this.dialogMode === 'create') {
      calendarApi!.addEvent({
        id: createEventId(),
        title: v.title,
        start: v.start,
        end:   v.end ?? undefined,
        allDay: v.allDay,
        extendedProps: { location: v.location, description: v.description }
      });
    } else {
      const e = calendarApi!.getEventById(v.id);
      e?.remove();
      calendarApi!.addEvent({
        id: v.id,
        title: v.title,
        start: v.start,
        end:   v.end ?? undefined,
        allDay: v.allDay,
        extendedProps: { location: v.location, description: v.description }
      });
    }
    this.showDialog = false;
  }

  onEventDeleted(id?: string) {
    if (!id) return;
    const calendarApi = this.getApi();
    calendarApi!.getEventById(id)?.remove();
    this.showDialog = false;
  }

  onDialogClose() { this.showDialog = false; }

  // closeOverlay() { this.overlayRef?.dispose(); this.overlayRef = undefined; }

  handleEvents(events: EventApi[]) {
    this.currentEvents.set(events);
    this.changeDetector.detectChanges(); // workaround for pressionChangedAfterItHasBeenCheckedError
  }

  private openDialog(mode: 'create' | 'edit', data: any) {
    // не открываем второй раз поверх текущего открытия/диалога
    if (this.opening || this.showDialog) return;

    this.opening = true;
    this.dialogMode = mode;
    this.dialogData = data;

    // Чуть отложим, чтобы:
    // - FullCalendar успел сделать unselect/отрисоваться
    // - OverlayPanel успел закрыться
    queueMicrotask(() => {
      this.showDialog = true;
      this.opening = false;
    });
  }

  // Поток «Создание события»
  // handleDateSelect(selectInfo: DateSelectArg) {
  //   this.op.hide();
  //   const calendarApi = selectInfo.view.calendar;
  //   calendarApi.unselect();

  //   // защита от повторных открытий диалога
  //   if (this.isDialogOpen() || this.dialog.openDialogs.length) return;
  //   this.isDialogOpen.set(true);

  //   // Передаём в форму исходный диапазон из select()
  //   const data: EventFormData = {
  //     mode: 'create',
  //     start: selectInfo.start,
  //     end: selectInfo.end,
  //     allDay: selectInfo.allDay
  //   };

  //   this.dialog.open(NewEventComponent, {
  //     data,
  //     width: '560px',
  //     maxWidth: '95vw',
  //     autoFocus: true,
  //     restoreFocus: true
  //   })
  //     .afterClosed()
  //     .subscribe((res?: { action: 'save'; value: any }) => {
  //       this.isDialogOpen.set(false);
  //       if (!res || res.action !== 'save') return;

  //       const v = res.value; // нормализованные поля из формы
  //       calendarApi.addEvent({ // Добавляем событие в календарь
  //         id: createEventId(),
  //         title: v.title,
  //         start: v.start, // 'YYYY-MM-DD' или 'YYYY-MM-DDTHH:mm'
  //         end: v.end || undefined, // null/undefined = без конца
  //         allDay: v.allDay,
  //         // любые ваши поля — в extendedProps
  //         extendedProps: {
  //           location: v.location,
  //           description: v.description
  //         }
  //       });
  //     });
  // }

  // onEditEvent(clickInfo: EventClickArg) {
  //   this.op.hide();
  //   if (this.isDialogOpen() || this.dialog.openDialogs.length) return;
  //   this.isDialogOpen.set(true);

  //   const calendarApi = clickInfo.view.calendar;
  //   const e = clickInfo.event;
  //   // Предзаполняем форму данными выбранного события
  //   const data: EventFormData = {
  //     mode: 'edit',
  //     id: e.id,
  //     title: e.title,
  //     start: e.start ?? undefined,
  //     end: e.end ?? undefined,
  //     allDay: e.allDay,
  //     location: e.extendedProps['location'] ?? '',
  //     description: e.extendedProps['description'] ?? ''
  //   };

  //   this.dialog.open(NewEventComponent, {
  //     data,
  //     width: '560px',
  //     maxWidth: '95vw',
  //     autoFocus: true,
  //     restoreFocus: true
  //   })
  //     .afterClosed()
  //     .subscribe((res?: { action: 'save' | 'delete'; value?: any }) => {
  //       this.isDialogOpen.set(false);
  //       if (!res) return;
  //       if (res.action === 'delete') {
  //         e.remove();
  //         return;
  //       }
  //       if (res.action === 'save' && res.value) {
  //         const v = res.value;
  //         const common = {
  //           id: e.id,                         // сохраняем тот же id
  //           title: v.title,
  //           start: v.start,                   // 'YYYY-MM-DD' или 'YYYY-MM-DDTHH:mm'
  //           end: v.end ?? null,
  //           allDay: !!v.allDay,
  //           extendedProps: {
  //             location: v.location,
  //             description: v.description
  //           }
  //         };

  //         e.remove();                    // полностью убираем старые сегменты
  //         calendarApi.addEvent(common);  // рисуем заново с нужным типом
  //       }
  //     });
  // }

  // handleEventClick(arg: EventClickArg) {
  //   arg.jsEvent.preventDefault();
  //   this.closeOverlay();

  //   const positionStrategy = this.overlay.position()
  //     .flexibleConnectedTo(arg.el)
  //     .withViewportMargin(8)
  //     .withPositions([
  //       { originX: 'center', originY: 'top',    overlayX: 'center', overlayY: 'bottom', offsetY: -8 },
  //       { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top',    offsetY:  8 },
  //       { originX: 'end',    originY: 'center', overlayX: 'start',  overlayY: 'center', offsetX:  8 },
  //       { originX: 'start',  originY: 'center', overlayX: 'end',    overlayY: 'center', offsetX: -8 },
  //     ]);

  //   this.overlayRef = this.overlay.create({
  //     positionStrategy,
  //     hasBackdrop: true,
  //     backdropClass: 'cdk-overlay-transparent-backdrop',
  //     scrollStrategy: this.overlay.scrollStrategies.close(),
  //   });
  //   const portal = new TemplatePortal(this.eventPopoverTpl, this.vcr, { $implicit: arg });
  //   this.overlayRef.attach(portal);
  //   this.overlayRef.backdropClick().subscribe(() => this.closeOverlay());
  // }
}
