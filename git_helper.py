#!/usr/bin/env python3
"""
Git Commit + Push Helper
Uso: python3 git_helper.py "Descripción del cambio paso a paso"

Ejemplos:
  python3 git_helper.py "feat: Agregar nuevas funciones de pago"
  python3 git_helper.py "fix: Corregir error en validación"
  python3 git_helper.py "refactor: Mejorar estructura de código"
"""

import subprocess
import sys
import os
from datetime import datetime

def run_command(cmd, description=""):
    """Ejecutar comando y retornar resultado"""
    if description:
        print(f"\n{description}")
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return result.stdout.strip(), result.stderr.strip(), True
    except subprocess.CalledProcessError as e:
        return "", e.stderr.strip(), False

def main():
    """Ejecutar commit + push"""
    
    if len(sys.argv) < 2:
        print("❌ Error: Debes proporcionar un mensaje de commit")
        print(f"\nUso: python3 {sys.argv[0]} \"Descripción del cambio\"")
        print("\nEjemplos:")
        print('  python3 git_helper.py "feat: Nueva funcionalidad de pago"')
        print('  python3 git_helper.py "fix: Corregir bug en validación"')
        print('  python3 git_helper.py "refactor: Mejorar estructura"')
        sys.exit(1)
    
    commit_message = sys.argv[1]
    os.chdir('/workspaces/bot-whatsapp-gastos')
    
    print("=" * 80)
    print(f"🔄 GIT COMMIT + PUSH HELPER")
    print("=" * 80)
    
    # 1. Verificar estado
    status_output, _, _ = run_command(
        ['git', 'status', '--short'],
        "📊 Archivos modificados:"
    )
    
    if not status_output:
        print("   (sin cambios)")
        return
    
    print(f"   {status_output}")
    
    # 2. Agregar cambios
    run_command(['git', 'add', '-A'], "✅ Agregando todos los cambios...")
    
    # 3. Crear commit
    success_commit = run_command(
        ['git', 'commit', '-m', commit_message],
        f"💾 Creando commit..."
    )[2]
    
    if not success_commit:
        print("❌ No hay cambios nuevos para commitear")
        return
    
    # 4. Retraerse un cambio si es necesario
    log_output, _, _ = run_command(
        ['git', 'log', '-1', '--pretty=format:%h|%s|%an|%ar'],
        ""
    )
    
    if log_output:
        parts = log_output.split('|')
        if len(parts) >= 4:
            print(f"\n   [{parts[0]}] {parts[1]}")
            print(f"   por {parts[2]} ({parts[3]})")
    
    # 5. Push
    stdout, stderr, success = run_command(
        ['git', 'push', 'origin', 'main'],
        "\n🚀 Haciendo push a GitHub..."
    )
    
    if success:
        print("   ✅ Push completado")
    else:
        if "permission denied" in stderr.lower() or "authentication" in stderr.lower():
            print("   ⚠️  Problema de autenticación - verifica credenciales")
        else:
            print(f"   ⚠️  {stderr}")
    
    print("\n" + "=" * 80)
    print("✅ Workflow completado - Claude puede hacer pull en su computadora")
    print("=" * 80)

if __name__ == '__main__':
    main()
