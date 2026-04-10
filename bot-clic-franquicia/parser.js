/**
 * Parser de mensajes de gastos y movimientos de caja.
 */

const { OPCIONES_SEDE, OPCIONES_CAJA, OPCIONES_CATEGORIA } = require('./constants');

// ─── Socios y aliases ────────────────────────────────────────
const SOCIOS = [
  { nombre: 'Lucas F',    aliases: ['lucas', 'lucas fradusco', 'fradusco', 'fradus', 'frat', 'lu', 'luqui'] },
  { nombre: 'Tiziana V',  aliases: ['tizi', 'tiziana'] },
  { nombre: 'Nicolas V',  aliases: ['nico', 'nicolas'] },
  { nombre: 'Augusto C',  aliases: ['augusto', 'ago'] },
];

const ALIAS_MAP = {};
SOCIOS.forEach(s => {
  s.aliases.forEach(a => { ALIAS_MAP[a.toLowerCase()] = s.nombre; });
});

// ─── Patrones de monto ───────────────────────────────────────
const MONTO_PATTERNS = [
  /\$\s?([\d]+(?:[.\u00a0]?\d{3})*(?:,\d{1,2})?)/,
  /por\s+\$?\s?([\d]+(?:[.\u00a0]?\d{3})*(?:,\d{1,2})?)/i,
  /(?:gast[eé]|pagu[eé]|cost[oó])\s+\$?\s?([\d]+(?:[.\u00a0]?\d{3})*(?:,\d{1,2})?)/i,
  /^([\d]+(?:[.\u00a0]?\d{3})*(?:,\d{1,2})?)\s+/,
  /\s([\d]+(?:[.\u00a0]?\d{3})*(?:,\d{1,2})?)$/,
  /([\d]+(?:[.\u00a0]?\d{3})*(?:,\d{1,2})?)/,
];

const SKIP_PATTERNS = [
  /^!/,
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

// ─── Utilidades ──────────────────────────────────────────────

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolverSocio(alias) {
  if (!alias) return null;
  return ALIAS_MAP[alias.toLowerCase().trim()] || null;
}

function normalizarMiles(texto) {
  return texto
    .replace(/(\d+(?:[.,]\d+)?)\s*mil(?:es)?\b/gi, (_, n) => {
      const num = parseFloat(n.replace(',', '.'));
      return isNaN(num) ? _ : String(Math.round(num * 1000));
    })
    .replace(/(\d+(?:[.,]\d+)?)\s*mill[oó]n(?:es)?\b/gi, (_, n) => {
      const num = parseFloat(n.replace(',', '.'));
      return isNaN(num) ? _ : String(Math.round(num * 1000000));
    });
}

function parseMonto(raw) {
  if (!raw) return null;
  const cleaned = raw
    .replace(/[\s\u00a0]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) || num <= 0 ? null : num;
}

function limpiarTexto(texto) {
  return texto
    .replace(/\b(agreg[aá](me|r|s|ste)?|carg[aá](me|r|s)?|anot[aá](me|r|s)?|pon[eé](me|r|s)?|met[eé](me|r|s)?|registr[aá](me|r|s)?|sum[aá](me|r|s)?|a[ñn]ad[ií](me|r)?)\b/gi, '')
    .replace(/[^\w\sáéíóúüñÁÉÍÓÚÜÑ]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ─── Parser de Gastos ────────────────────────────────────────

function detectarSocioEnTexto(texto) {
  const textoLower = texto.toLowerCase();

  const contextoRe = /(?:que|como)\s+([a-záéíóúüñ]+(?:\s+[a-záéíóúüñ]+)?)\s+(?:gast[oóeé]|pag[oóuú]|puso|pone)\b/i;
  const mContexto = textoLower.match(contextoRe);
  if (mContexto) {
    const nombre = resolverSocio(mContexto[1].trim());
    if (nombre) return { nombre, matchStr: mContexto[0] };
  }

  const aliases = Object.entries(ALIAS_MAP)
    .filter(([alias]) => alias.length >= 4)
    .sort((a, b) => b[0].length - a[0].length);

  for (const [alias, nombre] of aliases) {
    const re = new RegExp(`\\b${escapeRegex(alias)}\\b`, 'i');
    if (re.test(textoLower)) {
      return { nombre, matchStr: alias };
    }
  }

  return null;
}

function extractDescripcion(texto, montoMatch, socioMatchStr) {
  let desc = texto;
  if (socioMatchStr) {
    desc = desc.replace(new RegExp(escapeRegex(socioMatchStr), 'i'), '');
  }
  desc = desc
    .replace(new RegExp(escapeRegex(montoMatch), 'i'), '')
    .replace(/\b(agreg[aá](me|r|s|ste)?|carg[aá](me|r|s)?|anot[aá](me|r|s)?|pon[eé](me|r|s)?|met[eé](me|r|s)?|registr[aá](me|r|s)?)\b/gi, '')
    .replace(/\bpor\b/gi, '')
    .replace(/\bgast[eé]\b/gi, '')
    .replace(/\bpagu[eé]\b/gi, '')
    .replace(/\bcost[oó]\b/gi, '')
    .replace(/\ben\b/gi, '')
    .replace(/\bque\b/gi, '')
    .replace(/[^\w\sáéíóúüñÁÉÍÓÚÜÑ]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return desc || 'Gasto sin descripción';
}

/**
 * Parsea un mensaje como gasto en la hoja Gastos.
 * @param {string} texto
 * @param {string} [remitente]
 * @returns {null | { monto, descripcion, socio }}
 */
function parseGasto(texto, remitente) {
  if (!texto || typeof texto !== 'string') return null;

  const textoTrimmed = texto.trim();
  for (const pattern of SKIP_PATTERNS) {
    if (pattern.test(textoTrimmed)) return null;
  }
  if (!/\d/.test(textoTrimmed)) return null;

  const textoNorm = normalizarMiles(textoTrimmed);
  const socioDetectado = detectarSocioEnTexto(textoNorm);
  const socio = socioDetectado
    ? socioDetectado.nombre
    : (resolverSocio(remitente) || remitente || 'Desconocido');

  for (const pattern of MONTO_PATTERNS) {
    const match = textoNorm.match(pattern);
    if (match && match[1]) {
      const monto = parseMonto(match[1]);
      if (monto !== null && monto >= 1) {
        const descripcion = extractDescripcion(
          textoNorm,
          match[0],
          socioDetectado ? socioDetectado.matchStr : null,
        );
        return { monto, descripcion, socio };
      }
    }
  }
  return null;
}

// ─── Parser de Mov de Caja ───────────────────────────────────

// Ordenadas de mayor a menor longitud para evitar matches parciales
const CAJAS_SORTED = [...OPCIONES_CAJA].sort((a, b) => b.length - a.length);
const SEDES_SORTED = [...OPCIONES_SEDE].sort((a, b) => b.length - a.length);
const CATEGORIAS_SORTED = [...OPCIONES_CATEGORIA].sort((a, b) => b.length - a.length);

/**
 * Parsea un mensaje como movimiento de caja.
 * @param {string} texto
 * @returns {null | { item, ingresoEgreso, categoria, caja, sede, fechaImputacion, fecha, monto, notas }}
 */
function parseCaja(texto) {
  if (!texto || typeof texto !== 'string') return null;
  if (!/\d/.test(texto)) return null;

  let t = normalizarMiles(texto.trim());

  // Quitar trigger "mov de caja" / "movimiento de caja"
  t = t.replace(/\bmov(?:imiento)?\s+de\s+caja\b/gi, '').trim();

  // Ingreso / Egreso
  let ingresoEgreso = null;
  const matchIE = t.match(/\b(ingreso|egreso)\b/i);
  if (matchIE) {
    ingresoEgreso = matchIE[1].charAt(0).toUpperCase() + matchIE[1].slice(1).toLowerCase();
    t = t.replace(matchIE[0], '');
  }

  // Caja (primero, para evitar que "Office" de Sede matchee "Pilates Office")
  let caja = null;
  for (const c of CAJAS_SORTED) {
    const re = new RegExp(`\\b${escapeRegex(c)}\\b`, 'i');
    if (re.test(t)) {
      caja = c;
      t = t.replace(re, '');
      break;
    }
  }

  // Categoría
  let categoria = null;
  for (const c of CATEGORIAS_SORTED) {
    const re = new RegExp(`\\b${escapeRegex(c)}\\b`, 'i');
    if (re.test(t)) {
      categoria = c;
      t = t.replace(re, '');
      break;
    }
  }

  // Sede
  let sede = null;
  for (const s of SEDES_SORTED) {
    const re = new RegExp(`\\b${escapeRegex(s)}\\b`, 'i');
    if (re.test(t)) {
      sede = s;
      t = t.replace(re, '');
      break;
    }
  }

  // Fecha de imputación (dd/mm o dd/mm/yyyy)
  let fechaImputacion = null;
  const matchFecha = t.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
  if (matchFecha) {
    const dia = matchFecha[1].padStart(2, '0');
    const mes = matchFecha[2].padStart(2, '0');
    const anio = matchFecha[3]
      ? (matchFecha[3].length === 2 ? '20' + matchFecha[3] : matchFecha[3])
      : new Date().getFullYear();
    fechaImputacion = `${anio}-${mes}-${dia}`;
    t = t.replace(matchFecha[0], '');
  }

  // Notas (todo lo que sigue a "nota:" o "notas:")
  let notas = null;
  const matchNotas = t.match(/\bnotas?\s*:?\s+(.+)$/i);
  if (matchNotas) {
    notas = matchNotas[1].trim();
    t = t.replace(matchNotas[0], '');
  }

  // Monto
  let monto = null;
  for (const pattern of MONTO_PATTERNS) {
    const match = t.match(pattern);
    if (match && match[1]) {
      const m = parseMonto(match[1]);
      if (m !== null && m >= 1) {
        monto = m;
        t = t.replace(match[0], '');
        break;
      }
    }
  }

  if (!monto) return null;

  const fecha = new Date().toISOString().split('T')[0];
  const item = limpiarTexto(t) || 'Sin descripción';

  return {
    item,
    ingresoEgreso,
    categoria,
    caja,
    sede,
    fechaImputacion: fechaImputacion || fecha,
    fecha,
    monto,
    notas,
  };
}

module.exports = { parseGasto, parseCaja, parseMonto, resolverSocio };
