/**
 * Parsea un string o número en formato argentino (ej. "10.000", "10.000,50", "10000.50")
 * a un float válido de JavaScript.
 */
export const parseArgNumber = (val: string | number | undefined | null): number => {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (String(val).trim() === '') return 0;
  
  const strVal = String(val).trim();

  // Si tiene formato inglés (punto como decimal) y NO tiene comas (ej. "100.55")
  if (strVal.includes('.') && !strVal.includes(',')) {
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

  // Formato argentino con puntos de miles y coma decimal
  let cleaned = strVal.replace(/\./g, '');
  cleaned = cleaned.replace(/,/g, '.');
  
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};
