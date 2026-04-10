const { google } = require('googleapis');

const SPREADSHEET_ID = '1VcH-2CDesE1P1jmlhyPN80pE9MOxymeOyovvSF0D34E';
const SHEET_NAME = 'Influencer';
const KEY_FILE = 'C:\\Users\\augus\\Downloads\\fleet-symbol-492812-m9-e3a80a0a8d3c.json';

// Columnas: Nombre, Apellido, Sede, D (vacío), Plan Activo (E)
const data = [
  ['Ani', 'Nijen', 'Soho', '', 'Activo'],
  ['Milo', 'Gonzalez', 'Soho', '', 'Activo'],
  ['Jacinta', 'de Oromi', 'Soho', '', 'Activo'],
  ['Sarira', 'Skleit', 'Soho', '', 'Activo'],
  ['Iara', 'Courbrant', 'Soho', '', 'Activo'],
  ['Naty', 'Franzoni', 'Soho', '', 'Activo'],
  ['Vicky', 'Garabal', 'Soho', '', 'Activo'],
  ['Felicitas', 'Azinheira', 'Soho', '', 'Activo'],
  ['Fran', 'Mauro', 'Soho', '', 'Pausa'],
  ['Alexia', 'Bledel', 'Soho', '', 'Activo'],
  ['Lu', 'Salazar', 'Soho', '', ''],
  ['Millet', '', 'Soho', '', ''],
  ['Agus', 'Agazzani', 'Hollywood', '', 'Activo'],
  ['Delfi', 'Ausedv', 'Hollywood', '', 'Activo'],
  ['Domi', 'Faena', 'Hollywood', '', 'Activo'],
  ['Male', 'Rondina', 'Hollywood', '', 'Activo'],
  ['Buenos', 'Paladaires', 'Hollywood', '', 'Pausa'],
  ['Conny', 'Pereyra', 'Belgrano C', '', 'Activo'],
  ['Titi', 'Tcherkaski', 'Belgrano C', '', 'Activo'],
  ['Fran', 'Ezcurra', 'Belgrano C', '', 'Pausa'],
  ['Luli', 'Eyman', 'Belgrano C', '', 'Pausa'],
  ['Cami', 'Proven', 'Nuñez', '', 'Activo'],
  ['Valentina', 'Chait', 'Nuñez', '', 'Activo'],
  ['Nora', 'Colosimo', 'Nuñez', '', ''],
  ['Juanita', 'Boccardo', 'Nordelta', '', 'Activo'],
  ['Purpura', '', 'Nordelta', '', 'Activo'],
  ['Juli', 'Bianco', 'Nordelta', '', 'Pausa'],
  ['Olivia', 'Sposetti', 'Nordelta', '', 'Inactivo'],
  ['Nicki', 'Grau', 'Nordelta', '', 'Inactivo'],
  ['Anto', 'Macchi', 'Nordelta', '', 'Inactivo'],
  ['Lola', 'Latorre', 'Pilar', '', 'Activo'],
  ['Martu', 'Hernandez', 'Pilar', '', 'Activo'],
  ['Paula', 'Tucci', 'Pilar', '', 'Activo'],
  ['Cata', 'Guimarey', 'Pilar', '', 'Pausa'],
  ['Cami', 'Proven', 'Escobar', '', 'Activo'],
  ['Juana', 'Ramos', 'Escobar', '', 'Activo'],
  ['Martu', 'Ortiz', 'Olivos', '', 'Inactivo'],
  ['Nana', 'Inseul', 'Olivos', '', 'Activo'],
  ['Juana', 'Lopez Castro', 'Pilara', '', ''],
];

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // Primero obtenemos info de la hoja para saber en qué columnas escribir
  const sheetInfo = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = sheetInfo.data.sheets.find(s => s.properties.title === SHEET_NAME);
  if (!sheet) {
    console.error(`No encontré una hoja llamada "${SHEET_NAME}". Las hojas disponibles son:`);
    sheetInfo.data.sheets.forEach(s => console.log(' -', s.properties.title));
    return;
  }

  // Escribimos los datos a partir de la fila 2 (A2) para no pisar encabezados
  const range = `${SHEET_NAME}!A2`;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: 'RAW',
    requestBody: { values: data },
  });

  console.log(`✓ ${data.length} influencers cargados correctamente en la hoja "${SHEET_NAME}"`);
}

main().catch(console.error);
