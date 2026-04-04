# 🚀 Configuración de Railway - Base de Datos Persistente

## ⚠️ Problema: Pacientes se borran al hacer deploy

Cuando haces un nuevo deploy en Railway, la base de datos SQLite se pierde porque los datos están en un directorio efímero que se recrea en cada deploy.

## ✅ Solución: Volumen Persistente

Para que los pacientes y datos se mantengan entre deploys, necesitas **configurar un volumen persistente** en Railway.

### Pasos en Railway Dashboard:

1. **Ir a tu servicio en Railway**
2. **Clickear en "Settings" (⚙️)**
3. **Buscar "Volumes" o "Storage"**
4. **Crear un nuevo volumen persistente:**
   - **Mount Path:** `/data`
   - **Size:** 1GB (o más si necesitas)
   - **Name:** `data-kine` (o cualquier nombre)

### Cómo confirmar que está funcionando:

Después de configurar el volumen:

```bash
# Ver los deploys
git log --oneline -5

# El próximo deploy que hagas NO debe borrar los datos
# Los datos se mantendrán en el volumen /data
```

## 📁 Estructura de Directorios

```
/data/                          ← Volumen persistente en Railway
├── kine.db                     ← Base de datos SQLite (PERSISTE)
├── kine.db-shm                 ← Archivo WAL de SQLite
├── kine.db-wal                 ← Archivo WAL de SQLite
└── uploads/                    ← Estudios, documentos, etc.
    ├── estudio_001.pdf
    ├── foto_rx_002.jpg
    └── ...
```

## 🔍 Variables de Entorno

En Railway, asegúrate de tener:

```env
DATA_DIR=/data
```

(Esto ya está configurado en el Dockerfile)

## 🛠️ Si aún así se borran los datos:

Si los datos se siguen borrando, prueba estas opciones:

### Opción 1: Cambiar a PostgreSQL (Recomendado)
Railway ofrece bases de datos PostgreSQL incluidas. Es más estable que SQLite en producción.

### Opción 2: Usar Backup automático
- Agregar un cron job que backup la BD a GitHub o S3
- Restaurar desde backup si falla

### Opción 3: Usar mejor-sqlite3 con WAL mode (Ya configurado)
```javascript
db.pragma('journal_mode = WAL');  // ← Ya está en kine-db.js
```

## 📝 Checklist

- [ ] ¿Creaste un volumen persistente en Railway?
- [ ] ¿El Mount Path es `/data`?
- [ ] ¿El servicio está corriendo después del volumen?
- [ ] ¿Pusheaste el código con el VOLUME en el Dockerfile?

## 💾 Backup Manual (Si necesitas):

Para hacer backup de los datos:

```bash
# Descargar la BD desde Railway
railway run "cat /data/kine.db" > kine_backup.db

# O copiar la BD completa
railway volume ls /data
railway volume download /data kine_backup/
```

## 🆘 Soporte

Si Railway te dice que los volúmenes necesitan pago premium:

1. **Verificar plan:** Algunos planes free tienen limitaciones
2. **Alternativa:** Usar `/app/data` pero con rsync a backup externo
3. **Mejor:** Migrar a PostgreSQL (hay tier free en Railway)

---

**Próximas acciones:**

1. ✅ Este código ya tiene `VOLUME ["/data"]` en el Dockerfile
2. ❌ TÚ debes configurar el volumen en Railway Dashboard
3. ✅ Haz un nuevo deploy y verifica que los datos persisten

