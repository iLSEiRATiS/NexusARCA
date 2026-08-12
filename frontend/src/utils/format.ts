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
      // Si tiene exactamente 3 dígitos después del punto, asumimos que es separador de miles (ej: 200.000)
      // Si tiene 1 o 2 (ej: 100.50, 100.5), o más de 3, asumimos que es decimal usando el teclado numérico inglés.
      if (!/\.\d{3}$/.test(strVal)) {
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
