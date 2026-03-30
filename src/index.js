/**
 * Bot de WhatsApp para registro de gastos compartidos.
 *
 * Escucha mensajes en un grupo de WhatsApp, parsea gastos
 * de texto libre y los registra en Google Sheets.
 */

require('dotenv').config();

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const sheets = require('./sheets');
const { parseGasto } = require('./parser');

// ─── Configuración ───────────────────────────────────────────
const GROUP_ID = process.env.WHATSAPP_GROUP_ID;
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_CREDENTIALS = process.env.GOOGLE_CREDENTIALS;

// Meses en español para el comando !total
const MESES = {
  enero: 1, febrero: 2, marzo: 3, abril: 4,
  mayo: 5, junio: 6, julio: 7, agosto: 8,
  septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

// ─── Inicialización del cliente WhatsApp ─────────────────────
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

// ─── Eventos del cliente ─────────────────────────────────────

client.on('qr', (qr) => {
  console.log('\n📱 Escaneá este QR con WhatsApp:\n');
  qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
  console.log('\n✅ Bot conectado y listo!\n');

  // Imprimir grupos disponibles para encontrar el ID
  if (!GROUP_ID) {
    console.log('⚠️  WHATSAPP_GROUP_ID no configurado. Grupos disponibles:\n');
    const chats = await client.getChats();
    const groups = chats.filter(c => c.isGroup);
    groups.forEach(g => {
      console.log(`  📌 "${g.name}" → ID: ${g.id._serialized}`);
    });
    console.log('\nCopiá el ID del grupo y ponelo en .env como WHATSAPP_GROUP_ID\n');
  }
});

client.on('auth_failure', (msg) => {
  console.error('❌ Error de autenticación:', msg);
});

client.on('disconnected', (reason) => {
  console.log('🔌 Bot desconectado:', reason);
});

// ─── Handler principal de mensajes ───────────────────────────

client.on('message', async (msg) => {
  try {
    // Solo responder en el grupo configurado
    const chat = await msg.getChat();
    if (!chat.isGroup) return;
    if (GROUP_ID && chat.id._serialized !== GROUP_ID) return;

    const texto = msg.body.trim();
    if (!texto) return;

    // Obtener nombre del contacto
    const contact = await msg.getContact();
    const socio = contact.pushname || contact.name || msg.author || 'Desconocido';

    // Procesar comandos
    if (texto.startsWith('!')) {
      await handleComando(chat, texto, socio);
      return;
    }

    // Intentar parsear como gasto
    const gasto = parseGasto(texto);
    if (gasto) {
      const id = await sheets.registrarGasto(socio, gasto.descripcion, gasto.monto);
      await chat.sendMessage(
        `✅ Registrado gasto #${id}\n` +
        `👤 ${socio}\n` +
        `📝 ${gasto.descripcion}\n` +
        `💰 $${formatMonto(gasto.monto)}`
      );
    }
  } catch (err) {
    console.error('[Bot] Error procesando mensaje:', err.message);
  }
});

// ─── Handlers de comandos ────────────────────────────────────

async function handleComando(chat, texto, socio) {
  const parts = texto.toLowerCase().split(/\s+/);
  const comando = parts[0];

  switch (comando) {
    case '!resumen':
    case '!deuda':
      await cmdResumen(chat, socio);
      break;

    case '!total':
      await cmdTotal(chat, parts.slice(1).join(' '));
      break;

    case '!reembolsar':
      await cmdReembolsar(chat, parts[1]);
      break;

    case '!ultimos':
      await cmdUltimos(chat);
      break;

    case '!ayuda':
    case '!help':
      await cmdAyuda(chat);
      break;

    default:
      // Comando no reconocido — no hacer nada
      break;
  }
}

async function cmdResumen(chat, socio) {
  const { pendientes, total } = await sheets.obtenerResumenSocio(socio);

  if (pendientes.length === 0) {
    await chat.sendMessage(`✨ ${socio}: No tenés gastos pendientes de reembolso.`);
    return;
  }

  let msg = `📊 *Resumen de ${socio}*\n\n`;
  pendientes.forEach(g => {
    msg += `  #${g.id} | ${g.fecha} | ${g.descripcion} | $${formatMonto(g.monto)}\n`;
  });
  msg += `\n💰 *Total pendiente: $${formatMonto(total)}* (${pendientes.length} gastos)`;

  await chat.sendMessage(msg);
}

async function cmdTotal(chat, mesTexto) {
  let mes = null;
  let anio = null;

  if (mesTexto) {
    const mesNorm = mesTexto.toLowerCase().trim();
    mes = MESES[mesNorm];
    if (!mes) {
      await chat.sendMessage(`❓ No reconozco el mes "${mesTexto}". Usá: enero, febrero, marzo...`);
      return;
    }
  }

  const data = await sheets.obtenerTotalMes(mes, anio);
  const nombreMes = Object.keys(MESES).find(k => MESES[k] === data.mes) || '';

  let msg = `📊 *Total de gastos - ${nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1)} ${data.anio}*\n\n`;
  msg += `💰 Total: $${formatMonto(data.total)} (${data.cantidad} gastos)\n\n`;
  msg += `*Por socio:*\n`;

  Object.entries(data.porSocio)
    .sort((a, b) => b[1] - a[1])
    .forEach(([nombre, monto]) => {
      msg += `  👤 ${nombre}: $${formatMonto(monto)}\n`;
    });

  await chat.sendMessage(msg);
}

async function cmdReembolsar(chat, idStr) {
  const id = parseInt(idStr);
  if (isNaN(id)) {
    await chat.sendMessage('❓ Usá: !reembolsar [número de gasto]\nEjemplo: !reembolsar 5');
    return;
  }

  const gasto = await sheets.marcarReembolsado(id);
  if (!gasto) {
    await chat.sendMessage(`❌ No encontré el gasto #${id}`);
    return;
  }

  await chat.sendMessage(
    `✅ Gasto #${id} marcado como *REEMBOLSADO*\n` +
    `👤 ${gasto.socio} | ${gasto.descripcion} | $${formatMonto(gasto.monto)}`
  );
}

async function cmdUltimos(chat) {
  const ultimos = await sheets.obtenerUltimos(5);

  if (ultimos.length === 0) {
    await chat.sendMessage('📭 No hay gastos registrados todavía.');
    return;
  }

  let msg = '📋 *Últimos 5 gastos:*\n\n';
  ultimos.reverse().forEach(g => {
    const estado = g.estado === 'REEMBOLSADO' ? '✅' : '⏳';
    msg += `  ${estado} #${g.id} | ${g.fecha} | ${g.socio} | ${g.descripcion} | $${formatMonto(g.monto)}\n`;
  });

  await chat.sendMessage(msg);
}

async function cmdAyuda(chat) {
  await chat.sendMessage(
    `🤖 *Bot de Gastos - Comandos*\n\n` +
    `📝 *Registrar gasto:* Escribí un mensaje con un monto\n` +
    `   Ej: "almuerzo cliente $150"\n` +
    `   Ej: "taxi 80"\n\n` +
    `📊 *!resumen* — Tus gastos pendientes de reembolso\n` +
    `📊 *!total* — Total de gastos del mes actual\n` +
    `📊 *!total marzo* — Total de un mes específico\n` +
    `✅ *!reembolsar 5* — Marcar gasto #5 como reembolsado\n` +
    `📋 *!ultimos* — Últimos 5 gastos registrados\n` +
    `❓ *!ayuda* — Este mensaje`
  );
}

// ─── Utilidades ──────────────────────────────────────────────

function formatMonto(num) {
  return num.toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

// ─── Arranque ────────────────────────────────────────────────

async function main() {
  console.log('🚀 Iniciando Bot de Gastos...\n');

  if (!SHEET_ID || !GOOGLE_CREDENTIALS) {
    console.error('❌ Faltan variables de entorno. Revisá el archivo .env');
    console.error('   Necesitás: GOOGLE_SHEET_ID y GOOGLE_CREDENTIALS');
    process.exit(1);
  }

  // Conectar a Google Sheets
  await sheets.init(SHEET_ID, GOOGLE_CREDENTIALS);

  // Iniciar cliente de WhatsApp
  client.initialize();
}

main().catch(err => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
