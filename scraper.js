'use strict';

const axios = require('axios');
const cheerio = require('cheerio');

const TIMEOUT_MS = 10000;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-AR,es;q=0.9',
};

function padDos(n) {
  return n < 10 ? '0' + n : '' + n;
}

function ultimoDiaMes(anio, mes) {
  return new Date(anio, mes, 0).getDate();
}

/**
 * Intenta obtener los vencimientos de IVA desde AFIP (seti.afip.gob.ar).
 * Retorna un array de objetos { digito, impuesto, fecha } o lanza un error.
 */
async function scrapearAFIP() {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = hoy.getMonth() + 1; // 1-indexed
  const desde = `01/${padDos(mes)}/${anio}`;
  const hasta = `${ultimoDiaMes(anio, mes)}/${padDos(mes)}/${anio}`;

  // Primero obtenemos la sesión/cookies del formulario
  const sesion = await axios.get('https://seti.afip.gob.ar/av/seleccionVencimientos.do', {
    headers: HEADERS,
    timeout: TIMEOUT_MS,
  });

  const cookies = sesion.headers['set-cookie']
    ? sesion.headers['set-cookie'].map(c => c.split(';')[0]).join('; ')
    : '';

  // POST con el rango del mes actual, todos los dígitos, IVA seleccionado
  const params = new URLSearchParams();
  params.append('fechaVDesde', desde);
  params.append('fechaVHasta', hasta);
  params.append('terminacionCuit', ''); // vacío = todos
  params.append('tipoVencimiento', 'IVA - DECLARACION JURADA MENSUAL');

  const respuesta = await axios.post(
    'https://seti.afip.gob.ar/av/viewVencimientos.do',
    params.toString(),
    {
      headers: {
        ...HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://seti.afip.gob.ar/av/seleccionVencimientos.do',
        ...(cookies ? { Cookie: cookies } : {}),
      },
      timeout: TIMEOUT_MS,
    }
  );

  const $ = cheerio.load(respuesta.data);
  const filas = [];

  // La tabla de resultados suele tener th con "Terminación CUIT", "Impuesto", "Fecha"
  $('table tr').each((i, fila) => {
    const celdas = $(fila).find('td');
    if (celdas.length >= 3) {
      const digito = $(celdas[0]).text().trim();
      const impuesto = $(celdas[1]).text().trim();
      const fecha = $(celdas[2]).text().trim();
      if (digito && fecha) {
        filas.push({ digito, impuesto, fecha });
      }
    }
  });

  // Validar que las filas tienen dígitos reales (0-9) y fechas con formato dd/mm/aaaa
  const filasValidas = filas.filter(f =>
    /^\d$/.test(f.digito.trim()) && /\d{2}\/\d{2}\/\d{4}/.test(f.fecha)
  );

  if (filasValidas.length === 0) {
    throw new Error('No se encontraron datos válidos en la tabla de AFIP');
  }

  return filasValidas;
}

/**
 * Intenta obtener los vencimientos de IIBB desde ARBA.
 * Retorna el HTML parseado como texto legible o lanza un error.
 */
async function scrapearARBA() {
  const respuesta = await axios.get('https://www.arba.gov.ar/vencimientos', {
    headers: HEADERS,
    timeout: TIMEOUT_MS,
  });

  const $ = cheerio.load(respuesta.data);
  const filas = [];

  $('table tr').each((i, fila) => {
    const celdas = $(fila).find('td');
    if (celdas.length >= 2) {
      const col1 = $(celdas[0]).text().trim();
      const col2 = $(celdas[1]).text().trim();
      if (col1 && col2) {
        filas.push({ col1, col2 });
      }
    }
  });

  if (filas.length === 0) {
    throw new Error('No se encontraron datos en la tabla de ARBA');
  }

  return filas;
}

/**
 * Intenta obtener los vencimientos de IIBB desde AGIP.
 * Retorna el HTML parseado como texto legible o lanza un error.
 */
async function scrapearAGIP() {
  const respuesta = await axios.get('https://agip.gob.ar/vencimientos', {
    headers: HEADERS,
    timeout: TIMEOUT_MS,
  });

  const $ = cheerio.load(respuesta.data);
  const filas = [];

  $('table tr').each((i, fila) => {
    const celdas = $(fila).find('td');
    if (celdas.length >= 2) {
      const col1 = $(celdas[0]).text().trim();
      const col2 = $(celdas[1]).text().trim();
      if (col1 && col2) {
        filas.push({ col1, col2 });
      }
    }
  });

  if (filas.length === 0) {
    throw new Error('No se encontraron datos en la tabla de AGIP');
  }

  return filas;
}

module.exports = { scrapearAFIP, scrapearARBA, scrapearAGIP };
