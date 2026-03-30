'use strict';

const { scrapearAFIP, scrapearARBA, scrapearAGIP } = require('./scraper');

// ---------------------------------------------------------------------------
// Calendario oficial 2026
// Fuente: afip.gob.ar · arba.gov.ar · agip.gob.ar
// Clave: mes de vencimiento (1-12). El período es el mes anterior.
// Meses marcados "(confirmado AFIP)" tienen fechas reales de seti.afip.gob.ar.
// El resto son estimaciones basadas en calendario estándar AFIP 2026.
// ---------------------------------------------------------------------------

// AFIP - IVA Declaración Jurada Mensual 2026
// Regla base: 0-1→18, 2-3→19, 4-5→20, 6-7→25, 8-9→26 del mes de vencimiento.
// Se corre al siguiente día hábil si cae en fin de semana o feriado nacional.
// Meses con "(✓ AFIP)" tienen fechas confirmadas desde seti.afip.gob.ar.
const AFIP_IVA_2026 = {
  // ene: 18=dom→19L, 19=L, 20=M, 25=dom→26L, 26=L
  1:  { 0:19, 1:19, 2:19, 3:19, 4:20, 5:20, 6:26, 7:26, 8:26, 9:26 }, // período dic 2025
  // feb: 18=mié, 19=jue, 20=vie, 25=mié, 26=jue (carnestolendas 16-17, no afecta)
  2:  { 0:18, 1:18, 2:19, 3:19, 4:20, 5:20, 6:25, 7:25, 8:26, 9:26 }, // período ene 2026
  // mar: 18=mié, 19=jue, 20=vie, 25=mar, 26=mié (feriado 24/3 no afecta rango 18-26) ✓ AFIP
  3:  { 0:18, 1:18, 2:19, 3:19, 4:20, 5:20, 6:25, 7:25, 8:26, 9:26 }, // período feb 2026 (✓ AFIP)
  // abr: 18=sáb, 19=dom, 20=L, 25=sáb, 26=dom — confirmado AFIP seti (cascada: 20,21,22,23,24) ✓ AFIP
  4:  { 0:20, 1:20, 2:21, 3:21, 4:22, 5:22, 6:23, 7:23, 8:24, 9:24 }, // período mar 2026 (✓ AFIP)
  // may: 18=L, 19=M, 20=mié, 25=L(feriado 25/5)→26M, 26=M
  5:  { 0:18, 1:18, 2:19, 3:19, 4:20, 5:20, 6:26, 7:26, 8:26, 9:26 }, // período abr 2026
  // jun: 18=jue, 19=vie, 20=sáb→22L, 25=jue, 26=vie
  6:  { 0:18, 1:18, 2:19, 3:19, 4:22, 5:22, 6:25, 7:25, 8:26, 9:26 }, // período may 2026
  // jul: 18=sáb→20L, 19=dom→20L, 20=L, 25=sáb→27L, 26=dom→27L
  7:  { 0:20, 1:20, 2:20, 3:20, 4:20, 5:20, 6:27, 7:27, 8:27, 9:27 }, // período jun 2026
  // ago: 18=mar, 19=mié, 20=jue, 25=mar, 26=mié (feriado 17/8 no afecta)
  8:  { 0:18, 1:18, 2:19, 3:19, 4:20, 5:20, 6:25, 7:25, 8:26, 9:26 }, // período jul 2026
  // sep: 18=vie, 19=sáb→21L, 20=dom→21L, 25=vie, 26=sáb→28L
  9:  { 0:18, 1:18, 2:21, 3:21, 4:21, 5:21, 6:25, 7:25, 8:28, 9:28 }, // período ago 2026
  // oct: 18=dom→19L, 19=L, 20=M, 25=dom→26L, 26=L
  10: { 0:19, 1:19, 2:19, 3:19, 4:20, 5:20, 6:26, 7:26, 8:26, 9:26 }, // período sep 2026
  // nov: 18=mié, 19=jue, 20=vie, 25=mié, 26=jue
  11: { 0:18, 1:18, 2:19, 3:19, 4:20, 5:20, 6:25, 7:25, 8:26, 9:26 }, // período oct 2026
  // dic: 18=vie, 19=sáb→21L, 20=dom→21L, 25=vie(feriado Navidad)→28L, 26=sáb→28L
  12: { 0:18, 1:18, 2:21, 3:21, 4:21, 5:21, 6:28, 7:28, 8:28, 9:28 }, // período nov 2026
};

// ARBA - IIBB Provincia de Buenos Aires - Contribuyentes Locales 2026
// Fuente oficial arba.gov.ar. Grupos: 0-1 / 2-3 / 4-5 / 6-7 / 8-9
// Clave: mes de vencimiento. Key 1 = enero 2027 (período dic 2026).
const ARBA_IIBB_2026 = {
  1:  { 0:18, 1:18, 2:19, 3:19, 4:20, 5:20, 6:21, 7:21, 8:22, 9:22 }, // período dic 2026 → ene 2027
  2:  { 0:23, 1:23, 2:24, 3:24, 4:25, 5:25, 6:26, 7:26, 8:27, 9:27 }, // período ene 2026
  3:  { 0:25, 1:25, 2:26, 3:26, 4:27, 5:27, 6:30, 7:30, 8:31, 9:31 }, // período feb 2026
  4:  { 0:20, 1:20, 2:21, 3:21, 4:22, 5:22, 6:23, 7:23, 8:24, 9:24 }, // período mar 2026
  5:  { 0:18, 1:18, 2:19, 3:19, 4:20, 5:20, 6:21, 7:21, 8:22, 9:22 }, // período abr 2026
  6:  { 0:22, 1:22, 2:23, 3:23, 4:24, 5:24, 6:25, 7:25, 8:26, 9:26 }, // período may 2026
  7:  { 0:20, 1:20, 2:21, 3:21, 4:22, 5:22, 6:23, 7:23, 8:24, 9:24 }, // período jun 2026
  8:  { 0:24, 1:24, 2:25, 3:25, 4:26, 5:26, 6:27, 7:27, 8:28, 9:28 }, // período jul 2026
  9:  { 0:21, 1:21, 2:22, 3:22, 4:23, 5:23, 6:24, 7:24, 8:25, 9:25 }, // período ago 2026
  10: { 0:19, 1:19, 2:20, 3:20, 4:21, 5:21, 6:22, 7:22, 8:23, 9:23 }, // período sep 2026
  11: { 0:24, 1:24, 2:25, 3:25, 4:26, 5:26, 6:27, 7:27, 8:30, 9:30 }, // período oct 2026
  12: { 0:21, 1:21, 2:22, 3:22, 4:23, 5:23, 6:28, 7:28, 8:29, 9:29 }, // período nov 2026
};

// AGIP - IIBB CABA - Convenio Multilateral 2026
// Fuente oficial agip.gob.ar. Grupos: 0-2 / 3-5 / 6-7 / 8-9
// Clave: mes de vencimiento. Key 1 = enero 2027 (período dic 2026).
const AGIP_IIBB_2026 = {
  1:  { 0:15, 1:15, 2:15, 3:18, 4:18, 5:18, 6:19, 7:19, 8:20, 9:20 }, // período dic 2026 → ene 2027
  2:  { 0:13, 1:13, 2:13, 3:18, 4:18, 5:18, 6:19, 7:19, 8:20, 9:20 }, // período ene 2026
  3:  { 0:13, 1:13, 2:13, 3:16, 4:16, 5:16, 6:17, 7:17, 8:18, 9:18 }, // período feb 2026
  4:  { 0:15, 1:15, 2:15, 3:16, 4:16, 5:16, 6:17, 7:17, 8:20, 9:20 }, // período mar 2026
  5:  { 0:15, 1:15, 2:15, 3:18, 4:18, 5:18, 6:19, 7:19, 8:20, 9:20 }, // período abr 2026
  6:  { 0:16, 1:16, 2:16, 3:17, 4:17, 5:17, 6:18, 7:18, 8:19, 9:19 }, // período may 2026
  7:  { 0:15, 1:15, 2:15, 3:16, 4:16, 5:16, 6:17, 7:17, 8:20, 9:20 }, // período jun 2026
  8:  { 0:14, 1:14, 2:14, 3:18, 4:18, 5:18, 6:19, 7:19, 8:20, 9:20 }, // período jul 2026
  9:  { 0:15, 1:15, 2:15, 3:16, 4:16, 5:16, 6:17, 7:17, 8:18, 9:18 }, // período ago 2026
  10: { 0:15, 1:15, 2:15, 3:16, 4:16, 5:16, 6:19, 7:19, 8:20, 9:20 }, // período sep 2026
  11: { 0:13, 1:13, 2:13, 3:16, 4:16, 5:16, 6:17, 7:17, 8:18, 9:18 }, // período oct 2026
  12: { 0:15, 1:15, 2:15, 3:16, 4:16, 5:16, 6:17, 7:17, 8:18, 9:18 }, // período nov 2026
};

// AGIP - IIBB CABA - Régimen Local (Contribuyentes Locales) 2026
// Fuente oficial agip.gob.ar. Grupos: 0-1 / 2-3 / 4-5 / 6-7 / 8-9
// Clave: mes de vencimiento.
const AGIP_LOCAL_2026 = {
  3:  { 0:11, 1:11, 2:12, 3:12, 4:13, 5:13, 6:16, 7:16, 8:17, 9:17 }, // período feb 2026
  4:  { 0:13, 1:13, 2:14, 3:14, 4:15, 5:15, 6:16, 7:16, 8:17, 9:17 }, // período mar 2026
  5:  { 0:11, 1:11, 2:12, 3:12, 4:13, 5:13, 6:14, 7:14, 8:15, 9:15 }, // período abr 2026
  6:  { 0:11, 1:11, 2:12, 3:12, 4:16, 5:16, 6:17, 7:17, 8:18, 9:18 }, // período may 2026
  7:  { 0:13, 1:13, 2:14, 3:14, 4:15, 5:15, 6:16, 7:16, 8:17, 9:17 }, // período jun 2026
  8:  { 0:11, 1:11, 2:12, 3:12, 4:13, 5:13, 6:14, 7:14, 8:18, 9:18 }, // período jul 2026
  9:  { 0:11, 1:11, 2:14, 3:14, 4:15, 5:15, 6:16, 7:16, 8:17, 9:17 }, // período ago 2026
  10: { 0:13, 1:13, 2:14, 3:14, 4:15, 5:15, 6:16, 7:16, 8:19, 9:19 }, // período sep 2026
  11: { 0:11, 1:11, 2:12, 3:12, 4:13, 5:13, 6:16, 7:16, 8:17, 9:17 }, // período oct 2026
  12: { 0:11, 1:11, 2:14, 3:14, 4:15, 5:15, 6:16, 7:16, 8:17, 9:17 }, // período nov 2026
};

// Monotributo ARCA 2026 — vence el día 20 de cada mes para todos los contribuyentes.
// Desde ene 2026 incluye el componente IIBB CABA (Monotributo Unificado).
// Si el 20 cae fin de semana o feriado, se corre al siguiente día hábil.
// Tabla uniforme: todos los dígitos de CUIT tienen el mismo vencimiento.
const MONOTRIBUTO_ARCA_2026 = {
  1:  20, // 20 ene = martes
  2:  20, // 20 feb = viernes
  3:  20, // 20 mar = viernes
  4:  20, // 20 abr = lunes
  5:  20, // 20 may = miércoles
  6:  22, // 20 jun = sábado (tb. Día de la Bandera) → 22L
  7:  20, // 20 jul = lunes
  8:  20, // 20 ago = jueves
  9:  21, // 20 sep = domingo → 21L
  10: 20, // 20 oct = martes
  11: 20, // 20 nov = viernes
  12: 21, // 20 dic = domingo → 21L
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MESES = [
  'enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre',
];

function padDos(n) { return n < 10 ? '0' + n : '' + n; }

function getUltimoDigito(cuit) {
  return parseInt(cuit.replace(/[-\s]/g, '').slice(-1));
}

function validarCuit(cuit) {
  return /^\d{11}$/.test(cuit.replace(/[-\s]/g, ''));
}

// Devuelve { mesVenc (1-12), anioVenc, mesPeriodo (1-12), anioPeriodo }
function getMesVencimiento() {
  const hoy = new Date();
  const mesVenc = hoy.getMonth() + 1; // 1-indexed
  const anioVenc = hoy.getFullYear();
  const mesPeriodo = mesVenc === 1 ? 12 : mesVenc - 1;
  const anioPeriodo = mesVenc === 1 ? anioVenc - 1 : anioVenc;
  return { mesVenc, anioVenc, mesPeriodo, anioPeriodo };
}

// ---------------------------------------------------------------------------
// Formateo visual
// ---------------------------------------------------------------------------

const SEP = '━━━━━━━━━━━━━━━━━━━━━━━━━━';

// Agrupa dígitos consecutivos que comparten el mismo día de vencimiento
function agruparDigitos(tabla) {
  const grupos = [];
  let g = { desde: 0, hasta: 0, dia: tabla[0] };
  for (let d = 1; d <= 9; d++) {
    if (tabla[d] === g.dia) {
      g.hasta = d;
    } else {
      grupos.push({ ...g });
      g = { desde: d, hasta: d, dia: tabla[d] };
    }
  }
  grupos.push({ ...g });
  return grupos;
}

// Construye tabla monoespaciada para código block de Telegram
function tablaGrupos(tabla, mes, anio) {
  const mStr = padDos(mes);
  const grupos = agruparDigitos(tabla);
  return grupos.map(g => {
    const term = g.desde === g.hasta
      ? `Term. ...${g.desde}  `
      : `Term. ...${g.desde}-${g.hasta}`;
    return `${term}  │  ${padDos(g.dia)}/${mStr}/${anio}`;
  }).join('\n');
}

// Sección para Monotributo ARCA (fecha única, sin tabla de dígitos)
function seccionMonotributo(dia, mes, anio) {
  if (dia == null) {
    return `${SEP}\n🟣 *Monotributo ARCA*\n⚠️ Fechas pendientes — [arca.gob.ar](https://www.arca.gob.ar/vencimientos/)`;
  }
  const mStr = padDos(mes);
  return (
    `${SEP}\n` +
    `🟣 *Monotributo ARCA*\n` +
    `_Todos los contribuyentes · incl. IIBB CABA (Unificado) desde ene 2026_\n` +
    '```\n' +
    `Todos        │  ${padDos(dia)}/${mStr}/${anio}` +
    '\n```' +
    `\n_📎 [arca.gob.ar/vencimientos](https://www.arca.gob.ar/vencimientos/)_`
  );
}

// Sección completa para un impuesto (retorna string listo para enviar)
function seccion(emoji, titulo, subtitulo, tabla, mes, anio, urlFuente) {
  if (!tabla) {
    return (
      `${SEP}\n` +
      `${emoji} *${titulo}*\n` +
      `⚠️ Fechas pendientes — [${urlFuente}](https://${urlFuente})`
    );
  }
  return (
    `${SEP}\n` +
    `${emoji} *${titulo}*\n` +
    `_${subtitulo}_\n` +
    '```\n' + tablaGrupos(tabla, mes, anio) + '\n```' +
    `\n_📎 [${urlFuente}](https://${urlFuente})_`
  );
}

// ---------------------------------------------------------------------------
// Función principal: próximos vencimientos (async)
// ---------------------------------------------------------------------------

async function getProximosVencimientos() {
  const { mesVenc, anioVenc, mesPeriodo, anioPeriodo } = getMesVencimiento();
  const periodoStr = `período ${MESES[mesPeriodo - 1]} ${anioPeriodo}`;
  const partes = [
    `📅 *Vencimientos — ${MESES[mesVenc - 1].charAt(0).toUpperCase() + MESES[mesVenc - 1].slice(1)} ${anioVenc}*`,
  ];

  // --- AFIP IVA ---
  let afipTabla = AFIP_IVA_2026[mesVenc];
  try {
    const filas = await scrapearAFIP();
    // Si el scraping trae datos válidos, construimos una pseudo-tabla desde ellos
    const scraped = {};
    for (const f of filas) {
      const d = parseInt(f.digito);
      const dia = parseInt(f.fecha.split('/')[0]);
      if (!isNaN(d) && !isNaN(dia)) scraped[d] = dia;
    }
    if (Object.keys(scraped).length >= 5) afipTabla = scraped;
  } catch { /* usar calendario */ }

  partes.push(seccion('🔷', 'IVA AFIP — DJ Mensual', periodoStr,
    afipTabla, mesVenc, anioVenc, 'afip.gob.ar/vencimientos/'));

  // --- ARBA ---
  let arbaTabla = ARBA_IIBB_2026[mesVenc];
  try {
    const filas = await scrapearARBA();
    // scraping exitoso → armamos tabla (si el formato coincide)
    const scraped = {};
    for (const f of filas) {
      const d = parseInt(f.col1);
      const dia = parseInt((f.col2 || '').split('/')[0]);
      if (!isNaN(d) && !isNaN(dia)) scraped[d] = dia;
    }
    if (Object.keys(scraped).length >= 5) arbaTabla = scraped;
  } catch { /* usar calendario */ }

  partes.push(seccion('🔶', 'IIBB ARBA — Contribuyentes Locales', periodoStr,
    arbaTabla, mesVenc, anioVenc, 'arba.gov.ar/vencimientos'));

  // --- AGIP Convenio Multilateral ---
  let agipTabla = AGIP_IIBB_2026[mesVenc];
  try {
    const filas = await scrapearAGIP();
    const scraped = {};
    for (const f of filas) {
      const d = parseInt(f.col1);
      const dia = parseInt((f.col2 || '').split('/')[0]);
      if (!isNaN(d) && !isNaN(dia)) scraped[d] = dia;
    }
    if (Object.keys(scraped).length >= 5) agipTabla = scraped;
  } catch { /* usar calendario */ }

  partes.push(seccion('🔸', 'IIBB AGIP — Convenio Multilateral', periodoStr,
    agipTabla, mesVenc, anioVenc, 'agip.gob.ar/vencimientos'));

  // --- AGIP Régimen Local ---
  partes.push(seccion('🔹', 'IIBB AGIP — Régimen Local', periodoStr,
    AGIP_LOCAL_2026[mesVenc] || null, mesVenc, anioVenc, 'agip.gob.ar/vencimientos'));

  // --- Monotributo ARCA ---
  partes.push(seccionMonotributo(MONOTRIBUTO_ARCA_2026[mesVenc] || null, mesVenc, anioVenc));

  partes.push(`${SEP}\n⚠️ _Verificá siempre en los sitios oficiales._`);
  return partes.join('\n\n');
}

// ---------------------------------------------------------------------------
// Tarjeta de vencimientos para un CUIT / cliente específico
// ---------------------------------------------------------------------------

function _tarjetaCuit(cuit, nombreCliente) {
  if (!validarCuit(cuit)) {
    return '❌ CUIT inválido. Ingresá 11 dígitos (con o sin guiones).';
  }

  const digito = getUltimoDigito(cuit);
  const { mesVenc, anioVenc, mesPeriodo, anioPeriodo } = getMesVencimiento();
  const mStr = padDos(mesVenc);

  const fecha = (tabla) =>
    tabla && tabla[digito] != null
      ? `*${padDos(tabla[digito])}/${mStr}/${anioVenc}*`
      : '_sin datos_';

  const cuitFmt = (() => {
    const c = cuit.replace(/[-\s]/g, '');
    return c.length === 11 ? `${c.slice(0,2)}-${c.slice(2,10)}-${c.slice(10)}` : cuit;
  })();

  const encabezado = nombreCliente
    ? `📋 *${nombreCliente}*\nCUIT: \`${cuitFmt}\` — Term. *...${digito}*`
    : `📋 *CUIT ${cuitFmt}* — Term. *...${digito}*`;

  return (
    `${encabezado}\n` +
    `_Período: ${MESES[mesPeriodo - 1]} ${anioPeriodo}_\n\n` +
    `${SEP}\n` +
    `🔷 IVA AFIP         → ${fecha(AFIP_IVA_2026[mesVenc])}\n` +
    `🔶 ARBA Loc.        → ${fecha(ARBA_IIBB_2026[mesVenc])}\n` +
    `🔸 AGIP Conv. Mult. → ${fecha(AGIP_IIBB_2026[mesVenc])}\n` +
    `🔹 AGIP Reg. Local  → ${fecha(AGIP_LOCAL_2026[mesVenc])}\n` +
    `🟣 Monotributo ARCA → ${MONOTRIBUTO_ARCA_2026[mesVenc] != null ? `*${padDos(MONOTRIBUTO_ARCA_2026[mesVenc])}/${padDos(mesVenc)}/${anioVenc}*` : '_sin datos_'}\n` +
    `${SEP}\n` +
    `⚠️ _Verificá en [afip.gob.ar](https://www.afip.gob.ar/vencimientos/), ` +
    `[arba.gov.ar](https://www.arba.gov.ar/vencimientos) y [agip.gob.ar](https://agip.gob.ar/vencimientos)._`
  );
}

async function formatearVencimientosCuit(cuit, nombreCliente) {
  return _tarjetaCuit(cuit, nombreCliente || null);
}

module.exports = { getProximosVencimientos, formatearVencimientosCuit, validarCuit };
