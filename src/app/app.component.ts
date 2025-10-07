import { Component , signal, ChangeDetectorRef, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';

import { FullCalendarComponent, FullCalendarModule } from '@fullcalendar/angular';
import { CalendarOptions, DateSelectArg, EventClickArg, EventApi, Calendar } from '@fullcalendar/core';
import interactionPlugin from '@fullcalendar/interaction';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import multiMonthPlugin from '@fullcalendar/multimonth';
import esLocale from '@fullcalendar/core/locales/es';

import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { CardModule } from 'primeng/card';
import { OverlayPanel, OverlayPanelModule } from 'primeng/overlaypanel';

import { INITIAL_EVENTS_ES, SLOT, SLOTS_PER_HOUR, createEventId } from './event-utils';
import { NewEventComponent } from './new-event/new-event.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, FullCalendarModule,
    ButtonModule, TooltipModule, CardModule,
    OverlayPanelModule, NewEventComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {

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
  @ViewChild('eventPopoverTpl') eventPopoverTpl!: TemplateRef<any>;

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
    this.op.toggle(arg.jsEvent as MouseEvent, arg.el as HTMLElement); // открыть/закрыть панель в точке клика
  }

  handleDateSelect(selectInfo: DateSelectArg) {
    this.getApi()?.unselect();
    const { start, end, allDay } = selectInfo;
    this.dialogMode = 'create';
    this.dialogData = { mode: 'create', start, end, allDay };
    // queueMicrotask(() => this.showDialog = true);
    this.showDialog = true;
  }

  onEditEvent(clickInfo: EventClickArg) {
    this.op.hide();

    this.selectedEvent = null; // закроем превью
    this.dialogMode = 'edit';
    const e = clickInfo.event;
    this.dialogData = {
      mode: 'edit',
      id: e.id,
      title: e.title,
      start: e.start,
      end: e.end,
      allDay: e.allDay,
      location: e.extendedProps['location'] || '',
      description: e.extendedProps['description'] || ''
    };
    // открыть на следующий микротакт, чтобы overlay успел скрыться до открытия формы
    // более правильно будет добавить еще один метод, гарантирующий скрытие оверлея, и после вызов формы
    queueMicrotask(() => this.showDialog = true);
    // (или setTimeout(() => this.showDialog = true, 0))
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

  handleEvents(events: EventApi[]) {
    this.currentEvents.set(events);
    this.changeDetector.detectChanges(); // workaround for pressionChangedAfterItHasBeenCheckedError
  }
}
