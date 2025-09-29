import { Component, signal } from '@angular/core';
import { CalendarOptions, EventClickArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin, { DateClickArg } from '@fullcalendar/interaction';
import multiMonthPlugin from '@fullcalendar/multimonth';
import ruLocale from '@fullcalendar/core/locales/ru';
import { FullCalendarModule } from '@fullcalendar/angular';

type Id = string;

interface DemoEvent {
  id: Id;
  title: string;
  start: string; // ISO
  end?: string;  // ISO
  allDay?: boolean;
}

@Component({
  selector: 'app-calendar-page',
  standalone: true,
  imports: [FullCalendarModule],
  templateUrl: './calendar-page.component.html'
})
export class CalendarPageComponent {
  // Демо-состояние на сигналах
  private eventsSig = signal<DemoEvent[]>([
    { id: crypto.randomUUID(), title: 'Демо: встреча', start: this.iso(new Date()) },
    { id: crypto.randomUUID(), title: 'Звонок', start: this.iso(this.addHours(new Date(), 2)), end: this.iso(this.addHours(new Date(), 3)) },
  ]);

  // Дергаем методы через ref — проще хранить текущий view в options
  private calendarApi?: any;

  calendarOptions = signal<CalendarOptions>({
    plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin, multiMonthPlugin],
    locales: [ruLocale],
    locale: 'ru',
    initialView: 'dayGridMonth',
    headerToolbar: false, // Свою панель сделали выше
    firstDay: 1,          // неделя с понедельника
    height: 'auto',
    navLinks: true,
    selectable: true,     // выделение диапазона мышью
    selectMirror: true,
    editable: true,       // drag & drop + resize
    droppable: false,
    dayMaxEvents: true,   // “+N” в месяце
    nowIndicator: true,
    slotMinTime: '07:00:00',
    slotMaxTime: '21:00:00',

    // источники данных
    events: (info, success) => success(this.eventsSig()),

    // захватываем calendarApi после инициализации
    datesSet: (arg) => this.calendarApi = (arg.view as any).calendar,

    // Быстрое создание событий:
    dateClick: (arg: DateClickArg) => this.quickAdd(arg.dateStr, arg.allDay ?? true),

    select: (sel) => {
      const title = prompt('Название события?', 'Новое событие');
      if (!title) return;
      this.addEvent({
        id: crypto.randomUUID(),
        title,
        start: sel.startStr,
        end: sel.endStr,
        allDay: sel.allDay ?? false,
      });
    },

    // Перетаскивание/изменение длины
    eventDrop: (drop) => {
      const e = drop.event;
      this.updEvent({
        id: e.id,
        title: e.title,
        start: e.start?.toISOString()!,
        end: e.end?.toISOString(),
        allDay: e.allDay,
      });
    },
    eventResize: (rsz) => {
      const e = rsz.event;
      this.updEvent({
        id: e.id,
        title: e.title,
        start: e.start?.toISOString()!,
        end: e.end?.toISOString(),
        allDay: e.allDay,
      });
    },

    // Клик по событию — удалить/переименовать
    eventClick: (arg: EventClickArg) => {
      const action = prompt(`Действие с "${arg.event.title}" (rename/delete/skip)`, 'rename');
      if (action === 'delete') {
        this.delEvent(arg.event.id);
      } else if (action === 'rename') {
        const next = prompt('Новое имя', arg.event.title);
        if (next && next !== arg.event.title) {
          this.updEvent({
            id: arg.event.id,
            title: next,
            start: arg.event.start?.toISOString()!,
            end: arg.event.end?.toISOString(),
            allDay: arg.event.allDay,
          });
        }
      }
    },
  });

  // --- CRUD ---
  addEvent(e: DemoEvent) {
    this.eventsSig.update(list => [...list, e]);
    this.refetch();
  }
  updEvent(e: DemoEvent) {
    this.eventsSig.update(list => list.map(x => x.id === e.id ? e : x));
    this.refetch();
  }
  delEvent(id: Id) {
    this.eventsSig.update(list => list.filter(x => x.id !== id));
    this.refetch();
  }
  quickAdd(dateStr: string, allDay = true) {
    const title = prompt('Название события?', 'Новое событие');
    if (!title) return;
    this.addEvent({ id: crypto.randomUUID(), title, start: dateStr, allDay });
  }

  // --- Навигация/Вид ---
  goToday() { this.calendarApi?.today(); }
  goPrev()  { this.calendarApi?.prev(); }
  goNext()  { this.calendarApi?.next(); }
  changeView(viewName: string) { this.calendarApi?.changeView(viewName); }

  // --- helpers ---
  refetch() { this.calendarApi?.refetchEvents(); }
  iso(d: Date) { return d.toISOString(); }
  addHours(d: Date, h: number) { const nd = new Date(d); nd.setHours(nd.getHours() + h); return nd; }
}

