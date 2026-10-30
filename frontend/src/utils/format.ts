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

