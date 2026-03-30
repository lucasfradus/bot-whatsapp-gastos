# Bot de Gastos Compartidos - WhatsApp

Bot que registra gastos de un grupo de socios en Google Sheets directamente desde WhatsApp.

## Requisitos

- Node.js 18+
- Una cuenta de Google (para Google Sheets)
- Un celular con WhatsApp

## Instalación

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar Google Sheets

#### a) Crear un proyecto en Google Cloud Console

1. Ir a [console.cloud.google.com](https://console.cloud.google.com)
2. Crear un proyecto nuevo (o usar uno existente)
3. Ir a **APIs y servicios > Biblioteca**
4. Buscar y activar **Google Sheets API**

#### b) Crear una Service Account

1. Ir a **APIs y servicios > Credenciales**
2. Click en **Crear credenciales > Cuenta de servicio**
3. Ponerle un nombre (ej: "bot-gastos")
4. Click en la cuenta creada, ir a la pestaña **Claves**
5. Click en **Agregar clave > Crear clave nueva > JSON**
6. Se descarga un archivo JSON — ese es tu credencial

#### c) Crear la Google Sheet

1. Crear una nueva Google Sheet
2. Copiar el ID de la URL: `https://docs.google.com/spreadsheets/d/ESTE_ES_EL_ID/edit`
3. Compartir la Sheet con el email de la Service Account (el que termina en `@...iam.gserviceaccount.com`) con permisos de **Editor**

### 3. Configurar variables de entorno

Copiar `.env.example` a `.env` y completar:

```bash
cp .env.example .env
```

Editar `.env`:

```
GOOGLE_SHEET_ID=tu_id_de_la_sheet
GOOGLE_CREDENTIALS={"type":"service_account","project_id":"...el JSON completo en una línea..."}
```

Para poner el JSON en una línea, podés usar:
```bash
cat tu-archivo-de-credenciales.json | tr -d '\n'
```

### 4. Primer inicio

```bash
npm start
```

Al iniciar por primera vez:
1. Aparece un **código QR** en la terminal
2. Abrí WhatsApp en tu celular > menú (⋮) > Dispositivos vinculados > Vincular un dispositivo
3. Escaneá el QR
4. El bot va a listar los grupos disponibles con sus IDs
5. Copiá el ID del grupo donde querés que funcione
6. Pegalo en `.env` como `WHATSAPP_GROUP_ID`
7. Reiniciá el bot

## Uso

### Registrar un gasto

Simplemente escribí un mensaje con un monto en el grupo:

- `almuerzo cliente $150`
- `taxi aeropuerto 80`
- `$200 materiales oficina`
- `compre insumos por 350`

El bot confirma automáticamente.

### Comandos

| Comando | Qué hace |
|---------|----------|
| `!resumen` | Muestra tus gastos pendientes de reembolso |
| `!total` | Total de gastos del mes actual |
| `!total marzo` | Total de un mes específico |
| `!reembolsar 5` | Marca el gasto #5 como reembolsado |
| `!ultimos` | Últimos 5 gastos registrados |
| `!ayuda` | Lista de comandos |

## Deploy en Railway

1. Subí el proyecto a un repositorio de GitHub
2. Entrá a [railway.app](https://railway.app) y conectá tu repo
3. En **Variables**, agregá las mismas del `.env`
4. Railway hace el deploy automático
5. Para el QR inicial, mirá los logs del deploy

## Estructura del proyecto

```
├── src/
│   ├── index.js     # Punto de entrada, bot de WhatsApp
│   ├── parser.js    # Parser de mensajes de texto libre
│   └── sheets.js    # Integración con Google Sheets API
├── .env.example     # Template de variables de entorno
├── .gitignore
├── package.json
├── ARQUITECTURA.md  # Documento de arquitectura
└── README.md        # Este archivo
```
