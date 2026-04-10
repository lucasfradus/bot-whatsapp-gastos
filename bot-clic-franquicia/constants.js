/**
 * Opciones compartidas entre parser y sheets.
 */

const OPCIONES_INGRESO_EGRESO = ['Ingreso', 'Egreso'];

const OPCIONES_SEDE = [
  'Central', 'Olivos', 'Nordelta', 'Escobar', 'Pilara',
  'Office', 'Soho', 'Hollywood', 'Belgrano C', 'Nuñez', 'Lomada',
];

const OPCIONES_CAJA = [
  'Pilates Office', 'Caja Oficina', 'Caja Quiosco',
  'MP Fitness', 'Fradus', 'Nico', 'Tizi', 'CC',
];

const OPCIONES_CATEGORIA = [
  'Salarios', 'Capacitacion', 'Retiro', 'Venta de Franquicia',
  'Canon Franquicia', 'Inversiones', 'Cursos/Congresos', 'Pauta de Marca',
  'Publicidad Particular', 'Varios', 'Merch', 'Horas',
  'Mov. de Saldo', 'Prestamo',
];

module.exports = { OPCIONES_INGRESO_EGRESO, OPCIONES_SEDE, OPCIONES_CAJA, OPCIONES_CATEGORIA };
