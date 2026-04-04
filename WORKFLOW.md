# 🔄 WORKFLOW DE DESARROLLO - Copilot + Claude

## ¿Cómo funciona?

### 1️⃣ **Vos me pides un cambio en el chat**
   ```
   "Agregar campo de password validado en el formulario de login"
   ```

### 2️⃣ **Yo trabajo el cambio en tiempo real**
   - Leo el código existente
   - Hago las modificaciones necesarias
   - Guardo los archivos

### 3️⃣ **Hago commit + push automáticamente**
   - Describo qué cambié en términos claros
   - Ejecuto: `git_helper.py "feat: Agregar validación de password en login"`
   - Los cambios se pushean a GitHub automáticamente

### 4️⃣ **Claude en tu computadora puede hacer pull**
   ```bash
   cd bot-whatsapp-gastos
   git pull origin main
   ```
   Y ve exactamente qué cambié y por qué (en el mensaje del commit)

---

## 📋 Convención de Commits

Para que los commits sean claros y útiles, usaremos este formato:

```
[tipo]: Descripción clara y concisa
```

### Tipos de commit:
- `feat:` - Nueva funcionalidad/feature
- `fix:` - Corrección de bug
- `refactor:` - Reorganización de código (sin cambiar funcionalidad)
- `perf:` - Mejora de performance
- `style:` - Cambios de formato/estilos CSS
- `docs:` - Cambios en documentación
- `test:` - Agregar/modificar tests
- `chore:` - Dependencias, configuración, etc.

### Ejemplos:
```
feat: Agregar validación de password en formulario de login
fix: Corregir error de autenticación en portal de paciente
refactor: Reorganizar componentes de kine en carpeta separada
style: Mejorar CSS del dashboard de pacientes
docs: Actualizar README con instrucciones de setup
```

---

## ✅ Checklist de cada cambio

Cuando me pidas un cambio, yo haré esto:

- [ ] Leer el código existente relacionado
- [ ] Hacer los cambios solicitados
- [ ] Probar la lógica (si es posible)
- [ ] Verificar que no rompo nada
- [ ] Hace commit con descripción clara
- [ ] Hace push a GitHub
- [ ] Confirma en el chat que está listoEjemplo en el chat:

```
✅ Cambio completado:

feat: Agregar validación de password en login

📝 Qué cambié:
  - client/src/kine/Login.jsx:
    - Agregué regex para validar password (min 8 caracteres, 1 mayúscula, 1 número)
    - Mostrar mensaje de error si no cumple requisitos
    - Deshabilitar botón "Ingresar" hasta que sea válido

  - src/kine-routes.js:
    - Validación en backend también (duplicada para seguridad)

📊 Git:
  [a1b2c3d] feat: Agregar validación de password en login (ago 2 minutos)

🚀 Push completado a origin/main - Claude puede hacer git pull
```

---

## 🛠️ Cómo usar en tu computadora

### Opción 1: Pull automático
```bash
cd bot-whatsapp-gastos
git pull origin main
```

### Opción 2: Ver cambios antes de pullear
```bash
# Ver qué está nuevo en remoto
git fetch origin

# Ver los commits nuevos
git log origin/main --oneline -10

# Pullear cuando quieras
git pull origin main
```

### Opción 3: Ver un commit específico
```bash
# Ver detalles de un commit
git show a1b2c3d

# Ver qué archivos cambió
git show --name-status a1b2c3d
```

---

## 💡 Ventajas

1. ✅ **Historial limpio** - Cada cambio es un commit con propósito claro
2. ✅ **Siempre sincronizado** - GitHub siempre tiene lo último
3. ✅ **Claude se entera** - Puede revisar el código que hice
4. ✅ **Reversible** - Si algo sale mal, se puede hacer `git revert`
5. ✅ **Documentado** - Los mensajes de commit explican el "por qué"

---

## ⚙️ Configuración Actual

```
Repositorio: github.com/lucasfradus/bot-whatsapp-gastos
Branch: main
Usuario de commits: Copilot Agent <copilot@github.com>
Remote: origin (GitHub)
```

Listo para trabajar. ¿Qué cambio necesitas que haga? 🚀
