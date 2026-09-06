const XLSX = require('xlsx');

/**
 * Reads a CSV or XLSX file from disk and returns an array of plain row
 * objects, keyed by header name. Works for both formats because XLSX's
 * reader auto-detects the file type from its contents.
 */
function parseFile(filePath) {
  const workbook = XLSX.readFile(filePath, { raw: false });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  // defval:'' keeps missing cells as empty strings instead of undefined,
  // so every row has every column even if a field is blank in the source.
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

module.exports = { parseFile };
