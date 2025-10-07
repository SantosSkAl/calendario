import { Component, computed, inject, AfterViewInit, Input, Output, EventEmitter, Signal, OnInit  } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors, FormGroup } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { map, startWith } from 'rxjs';
// опционально, чтобы не думать про отписку:
import { toSignal } from '@angular/core/rxjs-interop';
import { ES, STEP_MIN_FORM } from '../event-utils';
// primeng
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { CalendarModule } from 'primeng/calendar';
import { InputSwitchModule } from 'primeng/inputswitch';
import { DropdownModule } from 'primeng/dropdown';
// import type { LocaleSettings } from 'primeng/calendar';
import { MAT_DATE_LOCALE } from '@angular/material/core';

/** Валидатор диапазона: для all-day — dateEnd >= dateStart; для timed — end > start */
function rangeValidator(group: AbstractControl): ValidationErrors | null {
  const get = (name: string) => group.get(name)?.value;
  const allDay = !!get('allDay');

  const ds: Date | null = get('dateStart') || null;
  let de: Date | null = get('dateEnd')   || null;

  if (!ds) return null;
  // один клик → считаем однодневным
  de = de ?? ds;

  if (allDay) {
    return de >= ds ? null : { range: true };
  }

  const ts: string | null = get('timeStart') || null; // 'HH:mm'
  const te: string | null = get('timeEnd')   || null;

  if (!ts || !te) return null;

  // сравниваем реальные Date
  const start = new Date(ds.getFullYear(), ds.getMonth(), ds.getDate(),
                         +ts.slice(0,2), +ts.slice(3,5));
  const end   = new Date(de.getFullYear(), de.getMonth(), de.getDate(),
                         +te.slice(0,2), +te.slice(3,5));

  return end.getTime() > start.getTime() ? null : { range: true };
}

export interface EventFormData {
  mode: 'create' | 'edit';
  // старт/конец для создания, или данные события для редактирования:
  start?: string | Date;
  end?: string | Date | null;
  allDay?: boolean;
  // для редактирования
  id?: string;
  title?: string;
  location?: string;
  description?: string;
}

@Component({
  selector: 'app-new-event',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    DialogModule, ButtonModule, InputTextModule, CalendarModule,
    InputSwitchModule, DropdownModule, InputTextareaModule
  ],
  templateUrl: './new-event.component.html',
  styleUrl: './new-event.component.css',
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'es-ES' }
  ],
})
export class NewEventComponent implements OnInit, AfterViewInit {
  // prime staff
  // ⬇⬇⬇ НОВОЕ: входы/выходы для работы с p-dialog
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();

  @Input() mode: 'create' | 'edit' = 'create';
  @Input() data: EventFormData = { mode: 'create' };

  @Output() saved   = new EventEmitter<any>();
  @Output() deleted = new EventEmitter<string>();
  @Output() closed  = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  // вспомогательный флаг: «авто-конец равен началу» для allDay
  autoEnd = true;
  get isAllDay() { return !!this.form.value.allDay; }
  protected TITLE_MAX = 100;
  // es: LocaleSettings = ES

  form: FormGroup;

  // form = this.fb.group({
  //   // ⚠️ Значения инициализируются в ngOnInit, когда @Input() data уже доступен
  //   title:       ['', [Validators.required, Validators.maxLength(this.TITLE_MAX)]],
  //   location:    this.fb.control('', { updateOn: 'blur' }),
  //   description: this.fb.control('', { updateOn: 'blur' }),
  //   dateStart:   [null as Date | null, Validators.required],
  //   dateEnd:     [null as Date | null],
  //   timeStart:   [''  as string | null],
  //   timeEnd:     [''  as string | null],
  //   allDay:      [false],
  // }, { validators: [rangeValidator] });

  protected STEP_MIN = STEP_MIN_FORM;
  allTimes: string[] = Array.from(
    { length: (24 * 60) / this.STEP_MIN },
    (_, i) => this.minToHHMM(i * this.STEP_MIN)
  );

  // сигналы для endTimes
  dsSig!: Signal<Date | null>;
  deSig!: Signal<Date | null>;
  tsSig!: Signal<string | null>;
  endTimes!: Signal<Array<{ value: string; label: string }>>;

  constructor() {
    // создаём «пустую» форму (с безопасными дефолтами)
    this.form = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(this.TITLE_MAX)]],
      location: this.fb.control('', { updateOn: 'blur' }),
      description: this.fb.control('', { updateOn: 'blur' }),
      dateStart: [null, Validators.required],
      dateEnd:   [null],
      timeStart: [''],
      timeEnd:   [''],
      allDay:    [false],
    }, { validators: [rangeValidator] });

    this.dsSig = toSignal(
      this.form.get('dateStart')!.valueChanges.pipe(
        startWith(this.form.value.dateStart ?? null),
        map(v => v ?? null)
      ),
      { initialValue: this.form.value.dateStart ?? null }
    );

    this.deSig = toSignal(
      this.form.get('dateEnd')!.valueChanges.pipe(
        startWith(this.form.value.dateEnd ?? null),
        map(v => v ?? null)
      ),
      { initialValue: this.form.value.dateEnd ?? null }
    );

    this.tsSig = toSignal(
      this.form.get('timeStart')!.valueChanges.pipe(
        startWith(this.form.value.timeStart ?? null),
        map(v => v ?? null)
      ),
      { initialValue: this.form.value.timeStart ?? null }
    );

    this.endTimes = computed(() =>
      this.makeEndTimes(
        this.dsSig() as Date | null,
        this.deSig() as Date | null,
        this.tsSig() as string | null
      )
    );
  }

  ngOnInit() {
    // console.log('NewEventComponent init - mode:', this.mode, 'data:', this.data);
    // ✅ Заполняем форму из входных данных (как раньше делал конструктор через inject(MAT_DIALOG_DATA))
    this.form.patchValue({
      title:       this.data.title ?? '',
      location:    this.data.location ?? '',
      description: this.data.description ?? '',
      dateStart:   this.initDateStart(),
      dateEnd:     this.initDateEnd(),
      timeStart:   this.initTimeStart(),
      timeEnd:     this.initTimeEnd(),
      allDay:      !!this.data.allDay,
    }, { emitEvent: false });

    this.normalizeRange();
    this.form.updateValueAndValidity({ emitEvent: false });
  }

  ngAfterViewInit() {
  }

  // ---- Нормализация диапазона (заменяет normalizeRangeOnClose) ----
  private normalizeRange() {
    const ds: Date | null = this.form.value.dateStart ?? null;
    const de: Date | null = this.form.value.dateEnd   ?? null;

    if (ds && !de) { // один клик → однодневное
      this.form.patchValue({ dateEnd: ds }, { emitEvent: false });
    }
    const start = this.form.value.dateStart as Date | null;
    const end   = this.form.value.dateEnd   as Date | null;
    if (start && end && end < start) {
      this.form.patchValue({ dateStart: end, dateEnd: start }, { emitEvent: false });
    }
    this.form.updateValueAndValidity({ emitEvent: false });
  }

  private startDateOnly(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  private addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  private pad(n: number) { return String(n).padStart(2, '0'); }
  private toHHMM(d: Date) { return `${this.pad(d.getHours())}:${this.pad(d.getMinutes())}`; }
  private fmtDay(d: Date) { return `${d.getFullYear()}-${this.pad(d.getMonth()+1)}-${this.pad(d.getDate())}`; }

  private initDateStart(): Date {
    const s = this.asDate(this.data.start) ?? new Date();
    return this.startDateOnly(s);
  }

  private initDateEnd(): Date {
    const s = this.asDate(this.data.start);
    const e = this.asDate(this.data.end);
    if (this.data.allDay) {
      // у all-day end эксклюзивный → для показа вычтем 1 день
      const shownEnd = e ? this.addDays(e, -1) : (s ?? new Date());
      return this.startDateOnly(shownEnd);
    }
    if (e) return this.startDateOnly(e);
    // если конца нет — по умолчанию тот же день
    return this.startDateOnly(s ?? new Date());
  }

  private initTimeStart(): string {
    const start = this.asDate(this.data.start);
    // если клик был по ячейке без времени → 12:00
    if (!start || this.data.allDay) return '12:00';
    return this.toHHMM(start);
  }

  private asDate(v?: string | Date | null): Date | null {
    if (!v) return null;
    return (typeof v === 'string') ? new Date(v) : v;
  }

  private initTimeEnd(): string {
    const end = this.asDate(this.data.end);
    const start = this.asDate(this.data.start);
    // 1) all-day: времени нет → показываем в форме умолчание (например 13:00)
    if (this.data.allDay) return '13:00';
    // 2) timed: если есть реальный конец — берём его
    if (end) return this.toHHMM(end);
    // 3) timed: конца нет, но есть старт → +1 час от старта 
    if (start) {
      const e = new Date(start.getTime() + 60 * 60 * 1000);
      return this.toHHMM(e);
    }
    // 4) если ничего из раннего не выполнено 13:00
    return '13:00';
  }

  private toLocalDatetime(value?: string | Date | null) {
    if (!value) return '';
    const d = typeof value === 'string' ? new Date(value) : value;
    const pad = (n: number) => String(n).padStart(2, '0');
    // YYYY-MM-DDTHH:mm для input[type=datetime-local]
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate()
    )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  onAllDayToggle() {
    const isAllDay = this.form.value.allDay;
    if (isAllDay) {
    }
  }

  // ---- ВМЕСТО dialogRef.close(): эмитим результат наружу ----
  onSubmit() {
    if (this.form.invalid) return;

    const v = this.form.value;
    const dateStart: Date = v.dateStart as Date;
    const dateEnd: Date | null = (v.dateEnd as Date || null) ?? dateStart;

    let start: string;
    let end: string | null = null;

    if (v.allDay) {
      start = this.fmtDay(dateStart);
      if (!dateEnd || dateEnd.getTime() === dateStart.getTime()) {
        end = null; // однодневное all-day без end
      } else {
        end = this.fmtDay(this.addDays(dateEnd, 1)); // all-day: эксклюзивный end
      }
    } else {
      const ts = (v.timeStart || '12:00') as string;
      const te = (v.timeEnd   || '13:00') as string;
      start = `${this.fmtDay(dateStart)}T${ts}`;
      end   = `${this.fmtDay(dateEnd)}T${te}`;
    }

    // 🔁 отдаём наружу всё, что раньше возвращали через afterClosed()
    this.saved.emit({
      id: this.data.id, // важно для edit
      title: v.title,
      location: v.location,
      description: v.description,
      allDay: !!v.allDay,
      start,
      end
    });

    this.close(); // закрыть диалог
  }

  // remove() {
  //   this.dialogRef.close({ action: 'delete' });
  // }

  remove() {
    // для delete достаточно id
    this.deleted.emit(this.data?.id);
    this.close();
  }

  // close() {
  //   this.dialogRef.close();
  // }

  onInternalVisibleChange(v: boolean) {
    this.visible = v;
    this.visibleChange.emit(v);

    // 2) если нас закрыли крестиком/ESC/кликом по маске — сообщим родителю
    if (!v) this.closed.emit();
  }

  onInternalHide() {
    // fires после анимации скрытия — страховка порядка событий
    if (this.visible) {
      this.visible = false;
      this.visibleChange.emit(false);
    }
    this.closed.emit();
  }

  close() {
    this.visible = false;
    this.visibleChange.emit(false);
    this.closed.emit();
  }

  private makeEndTimes(ds: Date|null, de: Date|null, ts: string|null/*, allDay?: boolean*/) {
    const effDe = de ?? ds // обрабатываем null в dateEnd, т.е. если конец не выбран — считаем однодневным

    const sameDay = !!ds && !!effDe &&
      ds.getFullYear()===effDe.getFullYear() &&
      ds.getMonth()===effDe.getMonth() &&
      ds.getDate()===effDe.getDate();

    if (sameDay && ts) {
      const startMin = this.hhmmToMin(ts);
      return this.allTimes
        .map(v => ({ value: v, m: this.hhmmToMin(v), label: v }))
        .filter(x => x.m > startMin)
        .map(x => ({ value: x.value, label: `${x.value} (${this.humanDuration(x.m - startMin)})` }));
    }
    return this.allTimes.map(v => ({ value: v, label: v }));
  }

  // helpers
  private hhmmToMin(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }
  private minToHHMM(min: number): string {
    const h = Math.floor(min / 60);
    const m = min % 60;
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(h)}:${p(m)}`;
  }

  private humanDuration(minutes: number): string { // esp
    // 30 → "30 min", 60 → "1 h", 90 → "1,5 h"
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h} h`;
    // показываем половинки как 1,5 ч.
    const frac = m === 30 ? ',5' : ` h ${m} min`;
    return m === 30 ? `${h}${frac} h` : `${h}${frac}`;
  }

}

