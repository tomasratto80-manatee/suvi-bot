'use strict';

require('dotenv').config();
const http        = require('http');
const TelegramBot = require('node-telegram-bot-api');
const Anthropic   = require('@anthropic-ai/sdk');
const { getProximosVencimientos, formatearVencimientosCuit, validarCuit } = require('./vencimientos');
const { agregarCliente, eliminarCliente, buscarCliente, listarClientes, formatCuit } = require('./clientes');

// clean:true descarta updates pendientes de sesiones anteriores al arrancar
const bot       = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: { clean: true } });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const OPTS_MD = { parse_mode: 'Markdown', disable_web_page_preview: true };

const SYSTEM_PROMPT = `Sos Suvi, el asistente virtual de un estudio contable argentino.
Respondés consultas contables, impositivas y administrativas con precisión y en español rioplatense (usando "vos", "te", etc.).
Tus respuestas son claras, concisas y profesionales.
Cuando corresponda, recomendás consultar con el contador del estudio para casos particulares.
Tenés conocimiento sobre: AFIP, monotributo, IVA, ganancias, bienes personales, ingresos brutos, facturación electrónica, libros contables, balances, y normativa impositiva argentina.
No inventés información: si no sabés algo con certeza, lo decís claramente.`;

// ---------------------------------------------------------------------------
// Historial de conversación por usuario
// ---------------------------------------------------------------------------
const conversaciones = new Map();

function getHistorial(userId) {
  if (!conversaciones.has(userId)) conversaciones.set(userId, []);
  return conversaciones.get(userId);
}

function agregarMensaje(userId, role, content) {
  const h = getHistorial(userId);
  h.push({ role, content });
  if (h.length > 10) h.splice(0, h.length - 10);
}

async function consultarClaude(userId, pregunta) {
  agregarMensaje(userId, 'user', pregunta);
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: getHistorial(userId),
  });
  const respuesta = response.content[0].text;
  agregarMensaje(userId, 'assistant', respuesta);
  return respuesta;
}

// ---------------------------------------------------------------------------
// Limpiar listeners antes de registrar (evita duplicados en hot-reload)
// ---------------------------------------------------------------------------
// Garantiza un solo set de handlers aunque el módulo se cargue más de una vez
bot.removeAllListeners('message');
bot._textRegexpCallbacks = [];

// ---------------------------------------------------------------------------
// /start
// ---------------------------------------------------------------------------
bot.onText(/^\/start(?:@\w+)?$/, (msg) => {
  const nombre = msg.from.first_name || 'ahí';
  bot.sendMessage(msg.chat.id,
    `👋 ¡Hola, ${nombre}! Soy *Suvi*, el asistente del estudio contable.\n\n` +
    `Puedo ayudarte con:\n` +
    `• Vencimientos fiscales (IVA, IIBB ARBA, AGIP)\n` +
    `• Gestión de clientes del estudio\n` +
    `• Dudas contables e impositivas\n\n` +
    `Usá /ayuda para ver todos los comandos.`, OPTS_MD);
});

// ---------------------------------------------------------------------------
// /ayuda
// ---------------------------------------------------------------------------
bot.onText(/^\/ayuda(?:@\w+)?$/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `📚 *Comandos disponibles*\n\n` +
    `*Vencimientos:*\n` +
    `• /vencimientos — Tabla completa del mes\n` +
    `• /vencimientos @NombreCliente — Tarjeta del cliente\n` +
    `• /vencimientos 20-12345678-9 — Por CUIT directo\n` +
    `• /cuit 20-12345678-9 — Igual que lo anterior\n\n` +
    `*Clientes:*\n` +
    `• /addcliente CUIT Nombre — Registrá un cliente\n` +
    `• /clientes — Listado de clientes guardados\n` +
    `• /delcliente Nombre — Eliminá un cliente\n\n` +
    `*Otros:*\n` +
    `• /limpiar — Borrá el historial de conversación\n` +
    `• /ayuda — Este mensaje\n\n` +
    `También podés escribirme cualquier consulta contable y te respondo.`,
    OPTS_MD);
});

// ---------------------------------------------------------------------------
// /vencimientos [opcional: @cliente | CUIT]
// ---------------------------------------------------------------------------
bot.onText(/^\/vencimientos(?:@\w+)?(?:\s+(.+))?$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const arg    = match[1] ? match[1].trim() : null;
  bot.sendChatAction(chatId, 'typing');

  try {
    // Sin argumento → tabla completa
    if (!arg) {
      const texto = await getProximosVencimientos();
      return bot.sendMessage(chatId, texto, OPTS_MD);
    }

    // @NombreCliente
    if (arg.startsWith('@')) {
      const nombre  = arg.slice(1);
      const cliente = buscarCliente(nombre);
      if (!cliente) {
        return bot.sendMessage(chatId,
          `❌ No encontré ningún cliente llamado *${nombre}*.\nUsá /clientes para ver la lista.`, OPTS_MD);
      }
      const texto = await formatearVencimientosCuit(cliente.cuit, cliente.nombre);
      return bot.sendMessage(chatId, texto, OPTS_MD);
    }

    // CUIT directo
    if (/\d/.test(arg)) {
      const texto = await formatearVencimientosCuit(arg);
      return bot.sendMessage(chatId, texto, OPTS_MD);
    }

    // Nombre sin @ (búsqueda flexible)
    const cliente = buscarCliente(arg);
    if (cliente) {
      const texto = await formatearVencimientosCuit(cliente.cuit, cliente.nombre);
      return bot.sendMessage(chatId, texto, OPTS_MD);
    }

    bot.sendMessage(chatId,
      `❓ No entendí el argumento. Usá:\n• /vencimientos @NombreCliente\n• /vencimientos 20-12345678-9\n• /vencimientos (sin argumentos para la tabla completa)`,
      OPTS_MD);

  } catch (error) {
    console.error('Error en /vencimientos:', error.message);
    bot.sendMessage(chatId, '⚠️ No se pudo obtener los vencimientos. Intentá de nuevo.');
  }
});

// ---------------------------------------------------------------------------
// /cuit [número]
// ---------------------------------------------------------------------------
bot.onText(/^\/cuit(?:@\w+)?(?:\s+(.+))?$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const cuit   = match[1] ? match[1].trim() : null;

  if (!cuit) {
    return bot.sendMessage(chatId,
      '📝 Indicá el CUIT después del comando.\n_Ejemplo:_ /cuit 20-12345678-9', OPTS_MD);
  }

  bot.sendChatAction(chatId, 'typing');
  try {
    const texto = await formatearVencimientosCuit(cuit);
    bot.sendMessage(chatId, texto, OPTS_MD);
  } catch (error) {
    console.error('Error en /cuit:', error.message);
    bot.sendMessage(chatId, '⚠️ No se pudo obtener los vencimientos. Intentá de nuevo.');
  }
});

// ---------------------------------------------------------------------------
// /addcliente CUIT NombreCliente
// ---------------------------------------------------------------------------
bot.onText(/^\/addcliente(?:@\w+)?(?:\s+(.+))?$/, (msg, match) => {
  const chatId = msg.chat.id;
  const args   = match[1] ? match[1].trim() : null;

  if (!args) {
    return bot.sendMessage(chatId,
      '📝 Uso: /addcliente CUIT NombreCliente\n_Ejemplo:_ /addcliente 20-12345678-9 Empresa ABC', OPTS_MD);
  }

  // El primer token es el CUIT, el resto es el nombre
  const tokens = args.split(/\s+/);
  const cuit   = tokens[0];
  const nombre = tokens.slice(1).join(' ');

  if (!nombre) {
    return bot.sendMessage(chatId,
      '❌ Falta el nombre del cliente.\n_Ejemplo:_ /addcliente 20-12345678-9 Empresa ABC', OPTS_MD);
  }

  if (!validarCuit(cuit)) {
    return bot.sendMessage(chatId,
      `❌ CUIT inválido: \`${cuit}\`\nIngresá 11 dígitos (con o sin guiones).`, OPTS_MD);
  }

  agregarCliente(nombre, cuit);
  bot.sendMessage(chatId,
    `✅ Cliente guardado:\n*${nombre}*\nCUIT: \`${formatCuit(cuit)}\`\n\nUsá /vencimientos @${nombre} para ver sus vencimientos.`,
    OPTS_MD);
});

// ---------------------------------------------------------------------------
// /delcliente NombreCliente
// ---------------------------------------------------------------------------
bot.onText(/^\/delcliente(?:@\w+)?(?:\s+(.+))?$/, (msg, match) => {
  const chatId = msg.chat.id;
  const nombre = match[1] ? match[1].trim() : null;

  if (!nombre) {
    return bot.sendMessage(chatId,
      '📝 Uso: /delcliente NombreCliente', OPTS_MD);
  }

  const ok = eliminarCliente(nombre);
  bot.sendMessage(chatId,
    ok ? `🗑 Cliente *${nombre}* eliminado.` : `❌ No encontré ningún cliente llamado *${nombre}*.`,
    OPTS_MD);
});

// ---------------------------------------------------------------------------
// /clientes — lista completa
// ---------------------------------------------------------------------------
bot.onText(/^\/clientes(?:@\w+)?$/, (msg) => {
  const chatId   = msg.chat.id;
  const clientes = listarClientes();

  if (clientes.length === 0) {
    return bot.sendMessage(chatId,
      '📋 No hay clientes guardados.\nUsá /addcliente CUIT Nombre para agregar uno.', OPTS_MD);
  }

  const lineas = clientes.map((c, i) =>
    `${i + 1}\\. *${c.nombre}* — \`${formatCuit(c.cuit)}\``
  );

  bot.sendMessage(chatId,
    `📋 *Clientes registrados (${clientes.length})*\n\n${lineas.join('\n')}\n\n` +
    `_Usá /vencimientos @NombreCliente para ver los vencimientos de cada uno._`,
    OPTS_MD);
});

// ---------------------------------------------------------------------------
// /limpiar
// ---------------------------------------------------------------------------
bot.onText(/^\/limpiar(?:@\w+)?$/, (msg) => {
  conversaciones.delete(msg.from.id);
  bot.sendMessage(msg.chat.id, '🧹 Historial de conversación borrado.');
});

// ---------------------------------------------------------------------------
// Mensajes de texto libre → Claude
// ---------------------------------------------------------------------------
bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;

  const chatId = msg.chat.id;
  const userId = msg.from.id;

  // Detectar CUIT + pregunta de vencimiento en texto libre
  const cuitMatch = msg.text.match(/\b(\d{2}[-\s]?\d{8}[-\s]?\d{1})\b/);
  if (cuitMatch && /vencimiento|vence|vencer|fecha|cuando/i.test(msg.text)) {
    bot.sendChatAction(chatId, 'typing');
    const texto = await formatearVencimientosCuit(cuitMatch[1]);
    return bot.sendMessage(chatId, texto, OPTS_MD);
  }

  bot.sendChatAction(chatId, 'typing');
  try {
    const respuesta = await consultarClaude(userId, msg.text);
    bot.sendMessage(chatId, respuesta, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error al consultar Claude:', error.message);
    bot.sendMessage(chatId, '⚠️ Hubo un error al procesar tu consulta. Intentá de nuevo en unos momentos.');
  }
});

// Servidor HTTP mínimo para mantener el proceso vivo en Render
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200);
  res.end('OK');
}).listen(PORT);

console.log('🤖 Suvi Bot iniciado correctamente.');
