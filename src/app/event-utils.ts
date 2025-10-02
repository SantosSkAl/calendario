import { EventInput } from '@fullcalendar/core';
import { MatDateFormats } from '@angular/material/core';

let eventGuid = 0;
const TODAY_STR = new Date().toISOString().replace(/T.*$/, ''); // YYYY-MM-DD of today

export function createEventId() {
  return String(eventGuid++);
}

// двигаем дни относительно TODAY_STR (YYYY-MM-DD)
const day = (offset = 0) => {
  const d = new Date(TODAY_STR);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
};

export const INITIAL_EVENTS_ES: EventInput[] = [
  // 1) Evento de día completo (hoy)
  {
    id: createEventId(),
    title: 'Día festivo de la empresa',
    start: TODAY_STR,                   // all-day
    allDay: true,
    extendedProps: {
      location: 'Sede central',
      description: 'Oficinas cerradas. No se programan reuniones ni entregas.'
    }
  },

  // 2) Reunión con horas (hoy por la mañana)
  {
    id: createEventId(),
    title: 'Reunión de seguimiento — Equipo Web',
    start: `${TODAY_STR}T09:30:00`,
    end:   `${TODAY_STR}T10:30:00`,
    extendedProps: {
      location: 'Sala 3B · Planta 2',
      description: 'Agenda: métricas de la semana, bloqueos, próximas entregas.'
    }
  },

  // 3) Multi-día (todo el día, varios días seguidos)
  {
    id: createEventId(),
    title: 'Viaje de trabajo: Armenia → Medellin (cliente Horizon)',
    start: day(2),            // empieza dentro de 2 días
    end:   day(5),            // termina el día 5 (exclusivo si tu config lo trata así)
    allDay: true,
    extendedProps: {
      location: 'Armenia (Qui) · Medellin (Ant)',
      description:
        'Reuniones con el cliente, demos internas y revisión de contrato. '
        + 'Traer prototipo y material de marketing.'
    }
  },

  // 4) Tarea larga con texto extenso + cruce de medianoche
  {
    id: createEventId(),
    title:
      'Entrega del proyecto — Sprint 14: módulo de calendario con previsualización, edición, truncados y mejoras de accesibilidad',
    start: `${day(1)}T22:00:00`,     // mañana 22:00
    end:   `${day(2)}T01:30:00`,     // pasado 01:30 (cruza medianoche)
    extendedProps: {
      location:
        'Oficina remota · “Sala virtual A — Link de videoconferencia extremadamente largo para probar el truncado en diversas vistas y tamaños de pantalla”',
      description:
        'Checklist: pruebas e2e, validación de rangos de fecha, localización es-ES, '
        + 'tooltips en acciones del popover, límite de anchura (400px), estilos adaptativos y revisión final con el equipo. '
        + 'Este texto es deliberadamente largo para comprobar el comportamiento del truncado en popover y en la vista del calendario. '
        + 'Este texto es deliberadamente largo para comprobar el comportamiento del truncado en popover y en la vista del calendario. '
    }
  }
];

export const ES_PRETTY_FORMATS: MatDateFormats = {
  parse: { dateInput: { day: '2-digit', month: 'short', year: 'numeric' } as any },
  display: {
    dateInput:       { day: '2-digit', month: 'short', year: 'numeric' } as any,
    monthYearLabel:  { month: 'short', year: 'numeric' } as any,
    dateA11yLabel:   { day: '2-digit', month: 'long',  year: 'numeric' } as any,
    monthYearA11yLabel: { month: 'long', year: 'numeric' } as any,
  },
};

// time constants
export const SLOTS_PER_HOUR = 6;
export const SLOT_MINUTES = Math.floor(60 / SLOTS_PER_HOUR);
export const SLOT = `00:${String(SLOT_MINUTES).padStart(2, '0')}` as const;
export const STEP_MIN_FORM = 10