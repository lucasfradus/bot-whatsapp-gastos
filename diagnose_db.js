#!/usr/bin/env node
/**
 * Script para diagnosticar problemas de persistencia de datos
 * 
 * Uso: node diagnose_db.js
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔍 DIAGNÓSTICO DE BASE DE DATOS\n');
console.log('=' .repeat(60));

// 1. Verificar DATA_DIR
const dataDir = process.env.DATA_DIR || path.join(__dirname, '..');
console.log('\n📁 Directorio de datos (DATA_DIR):');
console.log(`   ${dataDir}`);

// 2. Verificar si existe la BD
const dbPath = path.join(dataDir, 'kine.db');
console.log('\n📊 Archivo de base de datos:');
console.log(`   ${dbPath}`);

if (fs.existsSync(dbPath)) {
  const stats = fs.statSync(dbPath);
  console.log(`   ✅ EXISTE`);
  console.log(`   📏 Tamaño: ${(stats.size / 1024).toFixed(2)} KB`);
  console.log(`   ⏰ Última modificación: ${stats.mtime.toLocaleString('es-AR')}`);
} else {
  console.log(`   ❌ NO EXISTE (se creará en el primer inicio)`);
}

// 3. Verificar archivos WAL (Write-Ahead Logging)
console.log('\n📝 Archivos WAL de SQLite:');
const walPath = dbPath + '-wal';
const shmPath = dbPath + '-shm';

console.log(`   ${walPath}`);
console.log(`   ${fs.existsSync(walPath) ? '✅ Existe' : '❌ No existe'}`);

console.log(`   ${shmPath}`);
console.log(`   ${fs.existsSync(shmPath) ? '✅ Existe' : '❌ No existe'}`);

// 4. Verificar directorio de uploads
console.log('\n📂 Directorio de uploads:');
const uploadsDir = path.join(dataDir, 'uploads');
console.log(`   ${uploadsDir}`);

if (fs.existsSync(uploadsDir)) {
  const files = fs.readdirSync(uploadsDir);
  console.log(`   ✅ EXISTE con ${files.length} archivo(s)`);
  if (files.length > 0) {
    files.slice(0, 5).forEach(f => console.log(`      - ${f}`));
    if (files.length > 5) console.log(`      ... y ${files.length - 5} más`);
  }
} else {
  console.log(`   ❌ NO EXISTE (se creará automáticamente)`);
}

// 5. Verificar permisos
console.log('\n🔐 Permisos:');
try {
  if (!fs.existsSync(dataDir)) {
    console.log(`   ${dataDir} - No existe, se creará al iniciar`);
  } else {
    const stats = fs.statSync(dataDir);
    const mode = ('0' + stats.mode.toString(8)).slice(-3);
    console.log(`   ${dataDir} - Permisos: ${mode}`);
  }
} catch (e) {
  console.log(`   ❌ Error: ${e.message}`);
}

// 6. Verificar si es volumen persistente (Railroad-specific)
console.log('\n🏗️  Entorno Railway:');
if (process.env.RAILWAY_ENVIRONMENT_NAME) {
  console.log(`   Environment: ${process.env.RAILWAY_ENVIRONMENT_NAME}`);
  console.log(`   ✅ Corriendo en Railway`);
} else {
  console.log(`   ❌ No está en Railway (local o otro)`);
}

// 7. Recomendaciones
console.log('\n💡 RECOMENDACIONES:\n');

if (process.env.DATA_DIR && process.env.DATA_DIR === '/data') {
  console.log('✅ DATA_DIR está configurado a /data');
  console.log('   → Necesitas un VOLUME persistente en Railway');
} else if (!process.env.DATA_DIR) {
  console.log('⚠️  DATA_DIR no está configurado');
  console.log('   → Se usará ..');
  console.log('   → En Railway, los datos se pierden entre deploys');
} else {
  console.log(`ℹ️  DATA_DIR = ${process.env.DATA_DIR}`);
}

console.log('\n📋 Para RAILWAY:');
console.log('   1. Ve a tu servicio en Railway Dashboard');
console.log('   2. Click en "Settings" (⚙️)');
console.log('   3. Busca "Volumes" o "Storage"');
console.log('   4. Crea un volumen nuevo:');
console.log('      - Mount Path: /data');
console.log('      - Size: 1GB');
console.log('      - Name: data-kine');
console.log('   5. Redeploy el servicio');

console.log('\n' + '='.repeat(60) + '\n');
