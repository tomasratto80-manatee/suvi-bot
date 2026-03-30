'use strict';

const fs   = require('fs');
const path = require('path');

const ARCHIVO = path.join(__dirname, 'clientes.json');

function cargar() {
  if (!fs.existsSync(ARCHIVO)) return {};
  try { return JSON.parse(fs.readFileSync(ARCHIVO, 'utf8')); }
  catch { return {}; }
}

function guardar(data) {
  fs.writeFileSync(ARCHIVO, JSON.stringify(data, null, 2), 'utf8');
}

// Agrega o sobreescribe un cliente (nombre → CUIT normalizado sin guiones)
function agregarCliente(nombre, cuit) {
  const data = cargar();
  data[nombre] = cuit.replace(/[-\s]/g, '');
  guardar(data);
}

function eliminarCliente(nombre) {
  const data = cargar();
  const key = Object.keys(data).find(k => k.toLowerCase() === nombre.toLowerCase());
  if (!key) return false;
  delete data[key];
  guardar(data);
  return true;
}

// Devuelve { nombre, cuit } o null
function buscarCliente(query) {
  const data = cargar();
  // Búsqueda exacta primero, luego parcial case-insensitive
  const exacto = Object.keys(data).find(k => k.toLowerCase() === query.toLowerCase());
  if (exacto) return { nombre: exacto, cuit: data[exacto] };
  const parcial = Object.keys(data).find(k => k.toLowerCase().includes(query.toLowerCase()));
  if (parcial) return { nombre: parcial, cuit: data[parcial] };
  return null;
}

// Devuelve array de { nombre, cuit } ordenado alfabéticamente
function listarClientes() {
  const data = cargar();
  return Object.entries(data)
    .map(([nombre, cuit]) => ({ nombre, cuit }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

function formatCuit(cuit) {
  const c = cuit.replace(/[-\s]/g, '');
  if (c.length !== 11) return cuit;
  return `${c.slice(0,2)}-${c.slice(2,10)}-${c.slice(10)}`;
}

module.exports = { agregarCliente, eliminarCliente, buscarCliente, listarClientes, formatCuit };
