/**
 * Parser de mensajes de gastos.
 * Extrae monto y descripción de mensajes de texto libre en español.
 *
 * Formatos soportados:
 *   "almuerzo cliente $150"
 *   "taxi aeropuerto 80"
 *   "$200 materiales oficina"
 *   "compre insumos por 350"
 *   "gaste 500 en combustible"
 *   "150.50 uber"
 *   "nafta $1200,50"
 */

// Patrones para detectar montos en distintas posiciones del mensaje
const MONTO_PATTERNS = [
  // $150 o $1.200 o $150,50 o $1.200,50
  /\$\s?([\d]+(?:[.\u00a0]?\d{3})*(?:,\d{1,2})?)/,
  // "por 150" o "por $150"
  /por\s+\$?\s?([\d]+(?:[.\u00a0]?\d{3})*(?:,\d{1,2})?)/i,
  // "gaste 500" o "gasté 500" o "pague 500" o "pagué 500"
  /(?:gast[eé]|pagu[eé]|cost[oó])\s+\$?\s?([\d]+(?:[.\u00a0]?\d{3})*(?:,\d{1,2})?)/i,
  // Número suelto (al inicio o al final del mensaje)
  /^([\d]+(?:[.\u00a0]?\d{3})*(?:,\d{1,2})?)\s+/,
  /\s([\d]+(?:[.\u00a0]?\d{3})*(?:,\d{1,2})?)$/,
  // Número suelto en cualquier parte (último recurso)
  /([\d]+(?:[.\u00a0]?\d{3})*(?:,\d{1,2})?)/,
];

// Palabras que descartamos — no son gastos
const SKIP_PATTERNS = [
  /^!/, // Comandos del bot
  /^hola\b/i,
  /^buen[oa]s?\b/i,
  /^gracias\b/i,
  /^ok\b/i,
  /^dale\b/i,
  /^si+\b/i,
  /^no\b/i,
  /^jaj/i,
  /^https?:\/\//i,
];

/**
 * Limpia el string de monto y lo convierte a número.
 * Maneja formato argentino: 1.200,50 → 1200.50
 */
function parseMonto(raw) {
  if (!raw) return null;

  let cleaned = raw
    .replace(/[\s\u00a0]/g, '') // Quitar espacios
    .replace(/\./g, '')          // Quitar puntos de miles
    .replace(',', '.');           // Coma decimal → punto

  const num = parseFloat(cleaned);
  return isNaN(num) || num <= 0 ? null : num;
}

/**
 * Extrae la descripción quitando el monto y palabras auxiliares.
 */
function extractDescripcion(texto, montoMatch) {
  let desc = texto
    .replace(montoMatch, '')       // Quitar el monto encontrado
    .replace(/^\s*[-–—]\s*/, '')   // Quitar guiones iniciales
    .replace(/\bpor\b/gi, '')     // Quitar "por"
    .replace(/\bgast[eé]\b/gi, '') // Quitar "gasté"
    .replace(/\bpagu[eé]\b/gi, '') // Quitar "pagué"
    .replace(/\bcost[oó]\b/gi, '') // Quitar "costó"
    .replace(/\ben\b/gi, '')       // Quitar "en" suelto
    .replace(/\$\s*/g, '')         // Quitar signos $
    .replace(/\s{2,}/g, ' ')      // Espacios múltiples → uno
    .trim();

  // Si quedó vacío, usar genérico
  return desc || 'Gasto sin descripción';
}

/**
 * Intenta parsear un mensaje como un gasto.
 * @param {string} texto - El mensaje recibido
 * @returns {null | { monto: number, descripcion: string }} - null si no es un gasto
 */
function parseGasto(texto) {
  if (!texto || typeof texto !== 'string') return null;

  const textoTrimmed = texto.trim();

  // Descartar mensajes que no son gastos
  for (const pattern of SKIP_PATTERNS) {
    if (pattern.test(textoTrimmed)) return null;
  }

  // Si no tiene ningún dígito, no puede ser un gasto
  if (!/\d/.test(textoTrimmed)) return null;

  // Probar cada patrón de monto
  for (const pattern of MONTO_PATTERNS) {
    const match = textoTrimmed.match(pattern);
    if (match && match[1]) {
      const monto = parseMonto(match[1]);
      if (monto !== null && monto >= 1) {
        const descripcion = extractDescripcion(textoTrimmed, match[0]);
        return { monto, descripcion };
      }
    }
  }

  return null;
}

module.exports = { parseGasto, parseMonto };
