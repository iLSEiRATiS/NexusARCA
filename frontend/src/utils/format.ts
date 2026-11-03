/**
 * Parses a string in Argentine format (e.g. "100.000,50", "100000,50", "100000.50")
 * to a valid JavaScript float (100000.5).
 */
export const parseArgNumber = (val: string | number | undefined | null): number => {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  if (val.trim() === '') return 0;
  
  const strVal = String(val).trim();

  // Si tiene formato inglés (punto como decimal) y NO tiene comas, lo parseamos directo.
  // Ejemplo: "100000.55"
  if (strVal.includes('.') && !strVal.includes(',')) {
    // Check if it has multiple dots (e.g., 100.000.000), then it's thousands separator.
    if (strVal.split('.').length - 1 === 1) {
      // Si empieza con '0.' o '-0.', es decimal pequeño (ej: 0.500)
      // Si NO termina en exactamente 3 dígitos (ej: 100.50, 100.5), es decimal usando teclado inglés
      // Si termina en 3 dígitos y no empieza con 0 (ej: 10.000, 9.990, 1.500), es separador de miles argentino
      if (strVal.startsWith('0.') || strVal.startsWith('-0.') || !/\.\d{3}$/.test(strVal)) {
        const parsed = parseFloat(strVal);
        if (!isNaN(parsed)) return parsed;
      }
    }
  }

  // Formato argentino o crudo
  // 1. Quitamos los puntos de miles
  let cleaned = strVal.replace(/\./g, '');
  // 2. Reemplazamos la coma por punto decimal
  cleaned = cleaned.replace(/,/g, '.');
  
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Retorna la fecha local en formato YYYY-MM-DD para inputs de tipo date,
 * evitando el desfase de zona horaria hacia el día siguiente que causa toISOString().
 */
export const getLocalDateString = (d: Date = new Date()): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Formatea una fecha y hora en formato argentino: "D/M/AAAA HH:mm hs".
 * Combina dateVal con fallbackDate (ej. createdAt) para garantizar que se muestre la hora exacta en que se registró.
 */
export const formatArgDateTime = (
  dateVal: string | Date | undefined | null,
  fallbackDate?: string | Date | null
): string => {
  if (!dateVal && !fallbackDate) return '-';

  const d = dateVal ? new Date(dateVal) : null;
  const fb = fallbackDate ? new Date(fallbackDate) : null;

  let target: Date;

  if (d && !isNaN(d.getTime())) {
    // Si la fecha principal es medianoche o mediodía estándar por haber venido de un input YYYY-MM-DD,
    // y tenemos un fallback (como createdAt) que tiene la hora real exacta en que se registró:
    const hasGenericTime =
      (d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0) ||
      (d.getUTCHours() === 15 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) ||
      (d.getUTCHours() === 12 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0);

    if (hasGenericTime && fb && !isNaN(fb.getTime())) {
      target = new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        fb.getHours(),
        fb.getMinutes(),
        fb.getSeconds()
      );
    } else {
      target = d;
    }
  } else if (fb && !isNaN(fb.getTime())) {
    target = fb;
  } else {
    return '-';
  }

  const dateStr = target.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });

  const timeStr = target.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return `${dateStr} ${timeStr} hs`;
};

