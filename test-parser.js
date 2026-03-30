const { parseGasto } = require('./src/parser');

const tests = [
  // Should parse
  ['almuerzo cliente $150', { monto: 150, descripcion: 'almuerzo cliente' }],
  ['taxi aeropuerto 80', { monto: 80 }],
  ['$200 materiales oficina', { monto: 200 }],
  ['compre insumos por 350', { monto: 350 }],
  ['gaste 500 en combustible', { monto: 500 }],
  ['nafta $1200,50', { monto: 1200.50 }],
  ['150 uber', { monto: 150 }],

  // Should NOT parse (return null)
  ['!resumen', null],
  ['hola como va', null],
  ['buenas tardes', null],
  ['ok dale', null],
  ['jajaja', null],
  ['gracias', null],
];

let passed = 0;
let failed = 0;

tests.forEach(([input, expected]) => {
  const result = parseGasto(input);

  if (expected === null) {
    if (result === null) {
      console.log(`✅ "${input}" → null (correcto)`);
      passed++;
    } else {
      console.log(`❌ "${input}" → esperaba null, obtuvo:`, result);
      failed++;
    }
  } else {
    if (result && result.monto === expected.monto) {
      console.log(`✅ "${input}" → $${result.monto} "${result.descripcion}"`);
      passed++;
    } else {
      console.log(`❌ "${input}" → esperaba $${expected.monto}, obtuvo:`, result);
      failed++;
    }
  }
});

console.log(`\n${passed}/${tests.length} tests pasaron, ${failed} fallaron`);
