import { format, getWeek, startOfWeek, endOfWeek } from 'date-fns';

/**
 * Obtiene el número de semana de una fecha.
 */
export const getWeekNumber = (date) => {
  if (!date) return 0;
  return getWeek(new Date(date + 'T12:00:00'), { weekStartsOn: 1 });
};

/**
 * Obtiene el rango de fechas (Inicio - Fin) de una semana específica.
 */
export const getWeekRange = (weekNum, year) => {
  const jan4 = new Date(year, 0, 4);
  const day = jan4.getDay() || 7;
  const start = new Date(jan4);
  start.setDate(jan4.getDate() - (day - 1) + (weekNum - 1) * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${format(start, 'dd/MM')} - ${format(end, 'dd/MM')}`;
};

/**
 * Obtiene objeto de información detallada de semana (número, rango, etiqueta).
 */
export const getSemanaInfo = (dateInput) => {
  if (!dateInput) return null;
  try {
    let d;
    if (dateInput instanceof Date) {
      d = dateInput;
    } else if (typeof dateInput === 'string' && dateInput.includes('T')) {
      d = new Date(dateInput);
    } else if (typeof dateInput === 'string') {
      d = new Date(dateInput + 'T12:00:00');
    } else {
      d = new Date(dateInput);
    }

    if (isNaN(d.getTime())) return null;

    const weekNum = getWeek(d, { weekStartsOn: 1 });
    const year = d.getFullYear();
    const start = startOfWeek(d, { weekStartsOn: 1 });
    const end = endOfWeek(d, { weekStartsOn: 1 });
    const startStr = format(start, 'dd/MM');
    const endStr = format(end, 'dd/MM');

    return {
      weekNum,
      year,
      label: `SEM ${weekNum}`,
      rango: `${startStr} al ${endStr}`,
      fullLabel: `SEM ${weekNum} (${startStr} al ${endStr})`,
      key: `SEM-${weekNum}-${year}`
    };
  } catch (err) {
    console.error("Error al calcular getSemanaInfo:", err);
    return null;
  }
};

/**
 * Formatea un número como moneda ($).
 */
export const formatCurrency = (value) => {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(value || 0);
};

/**
 * Obtiene las iniciales de un nombre y apellido.
 */
export const getInitials = (nombre, apellido) => {
  const n = (nombre || '').charAt(0);
  const a = (apellido || '').charAt(0);
  return (n + a).toUpperCase() || 'TC';
};

/**
 * Mapeo de gerencias a sus siglas oficiales.
 */
export const obtenerSiglasGerencia = (gerencia) => {
  const gUpper = (gerencia || '').toUpperCase().trim();
  if (gUpper.includes('ADMINISTRA')) {
    return 'ADM';
  }
  const mapping = {
    'Dirección Corporativa': 'DC',
    'Gerencia General': 'GG',
    'Administración': 'ADM',
    'Contabilidad': 'CONT',
    'SIAHO': 'SIAHO',
    'Seguridad': 'SEG',
    'Operaciones': 'OPE',
    'Mantenimiento': 'MANT',
    'Compras': 'COM',
    'Recursos Humanos': 'RRHH',
    'Logística': 'LOG'
  };
  return mapping[gerencia] || 'GEN';
};
