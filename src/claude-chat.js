/**
 * Chat con Claude — acceso completo al sistema
 */

const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PROYECTO = 'c:\\Users\\augus\\bot-whatsapp-gastos';

const SYSTEM_PROMPT = `Sos un asistente personal de Augusto, que trabaja en Pilates Casa Central en Buenos Aires.

Tenés acceso completo a su computadora Windows y podés leer/escribir archivos, ejecutar comandos y modificar código.

Contexto del proyecto principal:
- Bot de WhatsApp en: ${PROYECTO}
- El bot registra gastos y movimientos de caja en Google Sheets
- Frontend React en: ${PROYECTO}\\client\\src\\
- Backend Node.js en: ${PROYECTO}\\src\\

Cuando modifiques código del bot o del frontend, acordate de avisarle a Augusto que tiene que:
1. Reiniciar el servidor si cambió archivos .js del backend
2. Hacer "npm run build" en la carpeta client si cambió el frontend, y recargar el browser

Respondé siempre en español. Sé conciso y directo. Si vas a modificar un archivo, leelo primero para entender el contexto.`;

const TOOLS = [
  {
    name: 'read_file',
    description: 'Lee el contenido de un archivo del sistema',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Ruta absoluta o relativa al archivo' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Escribe o reemplaza el contenido de un archivo',
    input_schema: {
      type: 'object',
      properties: {
        path:    { type: 'string', description: 'Ruta absoluta del archivo' },
        content: { type: 'string', description: 'Contenido completo a escribir' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'edit_file',
    description: 'Reemplaza un fragmento específico dentro de un archivo (más seguro que write_file)',
    input_schema: {
      type: 'object',
      properties: {
        path:       { type: 'string', description: 'Ruta absoluta del archivo' },
        old_string: { type: 'string', description: 'Texto exacto a reemplazar' },
        new_string: { type: 'string', description: 'Texto nuevo' },
      },
      required: ['path', 'old_string', 'new_string'],
    },
  },
  {
    name: 'list_directory',
    description: 'Lista archivos y carpetas en una ruta',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Ruta a listar (por defecto el proyecto)' },
      },
      required: [],
    },
  },
  {
    name: 'execute_command',
    description: 'Ejecuta un comando de shell y devuelve el output. Útil para npm install, git, node, etc.',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Comando a ejecutar' },
        cwd:     { type: 'string', description: 'Directorio de trabajo (opcional)' },
      },
      required: ['command'],
    },
  },
  {
    name: 'search_in_files',
    description: 'Busca un texto en archivos de una carpeta',
    input_schema: {
      type: 'object',
      properties: {
        directory: { type: 'string', description: 'Carpeta donde buscar' },
        pattern:   { type: 'string', description: 'Texto o regex a buscar' },
        extension: { type: 'string', description: 'Filtrar por extensión ej: .js .jsx (opcional)' },
      },
      required: ['directory', 'pattern'],
    },
  },
];

function ejecutarHerramienta(nombre, input) {
  switch (nombre) {
    case 'read_file': {
      const p = path.resolve(input.path);
      if (!fs.existsSync(p)) throw new Error(`Archivo no encontrado: ${p}`);
      const content = fs.readFileSync(p, 'utf8');
      return content.length > 50000 ? content.slice(0, 50000) + '\n... (truncado)' : content;
    }

    case 'write_file': {
      const p = path.resolve(input.path);
      const dir = path.dirname(p);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(p, input.content, 'utf8');
      return `✓ Guardado: ${p}`;
    }

    case 'edit_file': {
      const p = path.resolve(input.path);
      if (!fs.existsSync(p)) throw new Error(`Archivo no encontrado: ${p}`);
      let content = fs.readFileSync(p, 'utf8');
      if (!content.includes(input.old_string)) throw new Error(`No encontré el texto a reemplazar en ${p}`);
      content = content.replace(input.old_string, input.new_string);
      fs.writeFileSync(p, content, 'utf8');
      return `✓ Editado: ${p}`;
    }

    case 'list_directory': {
      const p = path.resolve(input.path || PROYECTO);
      if (!fs.existsSync(p)) throw new Error(`Directorio no encontrado: ${p}`);
      const items = fs.readdirSync(p, { withFileTypes: true });
      return items
        .map(i => `${i.isDirectory() ? '📁' : '📄'} ${i.name}`)
        .join('\n') || '(vacío)';
    }

    case 'execute_command': {
      const cwd = input.cwd ? path.resolve(input.cwd) : PROYECTO;
      try {
        const output = execSync(input.command, {
          encoding: 'utf8',
          timeout: 60000,
          cwd,
        });
        return output.trim() || '(sin output)';
      } catch (err) {
        return `Exit ${err.status}:\n${err.stdout || ''}\n${err.stderr || ''}`.trim();
      }
    }

    case 'search_in_files': {
      const dir = path.resolve(input.directory);
      if (!fs.existsSync(dir)) throw new Error(`Directorio no encontrado: ${dir}`);

      const ext = input.extension || '';
      const results = [];

      function buscar(carpeta) {
        const items = fs.readdirSync(carpeta, { withFileTypes: true });
        for (const item of items) {
          if (item.name === 'node_modules' || item.name === '.git' || item.name === 'dist') continue;
          const full = path.join(carpeta, item.name);
          if (item.isDirectory()) { buscar(full); continue; }
          if (ext && !item.name.endsWith(ext)) continue;
          try {
            const lines = fs.readFileSync(full, 'utf8').split('\n');
            lines.forEach((line, i) => {
              if (new RegExp(input.pattern, 'i').test(line)) {
                results.push(`${full}:${i + 1}: ${line.trim()}`);
              }
            });
          } catch { /* ignorar archivos binarios */ }
        }
      }

      buscar(dir);
      if (results.length === 0) return 'Sin resultados';
      return results.slice(0, 100).join('\n');
    }

    default:
      throw new Error(`Herramienta desconocida: ${nombre}`);
  }
}

// Conversaciones por WebSocket: Map<ws, messages[]>
const conversaciones = new Map();

async function procesarMensaje(ws, texto, sendFn) {
  if (!conversaciones.has(ws)) conversaciones.set(ws, []);
  const messages = conversaciones.get(ws);

  messages.push({ role: 'user', content: texto });

  try {
    // Agentic loop: sigue mientras Claude use herramientas
    while (true) {
      const stream = anthropic.messages.stream({
        model: 'claude-opus-4-6',
        max_tokens: 8096,
        system: SYSTEM_PROMPT,
        messages,
        tools: TOOLS,
      });

      // Streamear texto token a token
      stream.on('text', (token) => {
        sendFn({ tipo: 'claude_token', token });
      });

      const finalMsg = await stream.finalMessage();
      messages.push({ role: 'assistant', content: finalMsg.content });

      // Si terminó sin herramientas, listo
      if (finalMsg.stop_reason !== 'tool_use') {
        sendFn({ tipo: 'claude_done' });
        break;
      }

      // Ejecutar herramientas
      const toolResults = [];
      for (const block of finalMsg.content) {
        if (block.type !== 'tool_use') continue;

        sendFn({ tipo: 'claude_herramienta', nombre: block.name, input: block.input });

        let resultado;
        try {
          resultado = ejecutarHerramienta(block.name, block.input);
          sendFn({ tipo: 'claude_herramienta_ok', nombre: block.name });
        } catch (err) {
          resultado = `Error: ${err.message}`;
          sendFn({ tipo: 'claude_herramienta_error', nombre: block.name, error: err.message });
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: resultado,
        });
      }

      messages.push({ role: 'user', content: toolResults });
    }
  } catch (err) {
    sendFn({ tipo: 'claude_error', mensaje: err.message });
  }
}

function limpiarConversacion(ws) {
  conversaciones.delete(ws);
}

module.exports = { procesarMensaje, limpiarConversacion };
