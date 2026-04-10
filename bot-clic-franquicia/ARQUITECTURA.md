# Bot de Gastos Compartidos - WhatsApp + Google Sheets

## Resumen

Bot de WhatsApp que permite a un grupo de socios registrar gastos compartidos mediante mensajes de texto libre, almacenándolos automáticamente en Google Sheets. Incluye funciones de resumen, totales por mes y marcado de reembolsos.

---

## Arquitectura General

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  WhatsApp    │────▶│   Bot (Node.js)  │────▶│  Google Sheets   │
│  Grupo       │◀────│   whatsapp-web.js│◀────│  (Base de datos)  │
│  de Socios   │     │                  │     │                  │
└─────────────┘     └──────────────────┘     └──────────────────┘
                           │
                    ┌──────┴──────┐
                    │  Parser de  │
                    │  Mensajes   │
                    │  (NLP light)│
                    └─────────────┘
```

## Stack Tecnológico

| Componente        | Tecnología              | Justificación                                |
|-------------------|-------------------------|----------------------------------------------|
| Runtime           | Node.js 18+             | Ecosistema maduro, librerías disponibles     |
| WhatsApp Client   | whatsapp-web.js         | Gratis, fácil setup, ideal para grupos chicos|
| Almacenamiento    | Google Sheets API v4    | Sin costo, visible por todos los socios      |
| Hosting           | Railway (free tier)     | Deploy simple con Git, sin costo inicial     |
| Parser            | Regex + heurísticas     | Liviano, sin dependencias externas           |

## Flujo de Datos

### 1. Registro de Gasto
```
Socio escribe: "almuerzo cliente $150"
    ↓
Bot recibe mensaje via whatsapp-web.js
    ↓
Parser extrae: { monto: 150, descripcion: "almuerzo cliente", socio: "Lucas" }
    ↓
Se escribe fila en Google Sheets: [fecha, socio, descripcion, monto, estado]
    ↓
Bot confirma: "✓ Registrado: almuerzo cliente $150 (Lucas)"
```

### 2. Consulta de Resumen
```
Socio escribe: "!resumen" o "!deuda"
    ↓
Bot lee Google Sheets, filtra por socio
    ↓
Calcula gastos pendientes de reembolso
    ↓
Bot responde: "Lucas: $450 pendiente de reembolso (3 gastos)"
```

### 3. Marcar Reembolso
```
Socio escribe: "!reembolsar 5" (número de fila/ID)
    ↓
Bot actualiza estado en Google Sheets a "REEMBOLSADO"
    ↓
Bot confirma: "✓ Gasto #5 marcado como reembolsado"
```

## Estructura de Google Sheets

### Hoja: "Gastos"

| Columna | Campo       | Ejemplo              |
|---------|-------------|----------------------|
| A       | ID          | 1                    |
| B       | Fecha       | 2026-03-28           |
| C       | Hora        | 14:30                |
| D       | Socio       | Lucas                |
| E       | Descripción | almuerzo cliente     |
| F       | Monto       | 150                  |
| G       | Estado      | PENDIENTE            |
| H       | Fecha Reemb.| (vacío o fecha)      |

## Comandos del Bot

| Comando             | Descripción                                   |
|---------------------|-----------------------------------------------|
| (texto libre)       | Registra un gasto si detecta un monto ($)     |
| `!resumen`          | Muestra gastos pendientes del que escribe      |
| `!total`            | Total de gastos del grupo en el mes actual     |
| `!total marzo`      | Total de un mes específico                     |
| `!reembolsar [ID]`  | Marca un gasto como reembolsado               |
| `!ultimos`          | Muestra los últimos 5 gastos registrados       |
| `!ayuda`            | Lista de comandos disponibles                  |

## Formato de Mensajes Aceptados

El parser reconoce estos formatos de texto libre:

- `almuerzo cliente $150`
- `taxi aeropuerto 80`
- `$200 materiales oficina`
- `compre insumos por 350`
- `gaste 500 en combustible`

## Seguridad

- El bot solo responde en el grupo configurado (por ID de grupo)
- Solo los contactos del grupo pueden registrar gastos
- Google Sheets compartido como solo lectura con los socios (escritura solo via bot)
- Credenciales almacenadas en variables de entorno

## Deploy en Railway

1. Crear repo en GitHub con el código
2. Conectar Railway al repo
3. Configurar variables de entorno (credenciales Google)
4. Escanear QR de WhatsApp Web al primer inicio
5. El bot queda activo 24/7

## Limitaciones Conocidas

- **whatsapp-web.js** no es la API oficial de Meta — funciona simulando WhatsApp Web
- Requiere mantener una sesión activa (el QR se escanea una vez y se guarda)
- Free tier de Railway tiene límite de horas/mes (~500h, suficiente para un bot)
- Si WhatsApp actualiza su protocolo, puede requerir actualizar la librería
