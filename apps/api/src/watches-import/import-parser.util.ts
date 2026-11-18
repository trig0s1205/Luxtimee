import ExcelJS from 'exceljs';
import { BadRequestException } from '@nestjs/common';
import {
  IMPORT_DATA_COLUMNS,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  REQUIRED_TECH_COLUMNS,
  type ImportDataColumn,
} from './import.constants';
import { neutralizeSpreadsheetText } from './import-normalize.util';

export type RawImportRow = {
  rowNumber: number;
  values: Partial<Record<ImportDataColumn, string>>;
};

function isZipXlsx(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07) &&
    (buffer[3] === 0x04 || buffer[3] === 0x06 || buffer[3] === 0x08)
  );
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (typeof value === 'object' && value !== null) {
    if ('result' in value) {
      return cellToString((value as ExcelJS.CellFormulaValue).result ?? '');
    }
    if ('richText' in value) {
      const rt = (value as ExcelJS.CellRichTextValue).richText;
      if (Array.isArray(rt)) return rt.map((p) => p.text).join('');
    }
    if ('text' in value && typeof (value as { text?: unknown }).text === 'string') {
      return (value as { text: string }).text;
    }
    if ('hyperlink' in value && 'text' in value) {
      return String((value as ExcelJS.CellHyperlinkValue).text ?? '');
    }
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  return '';
}

function detectCsvDelimiter(headerLine: string): ',' | ';' {
  const commas = (headerLine.match(/,/g) || []).length;
  const semis = (headerLine.match(/;/g) || []).length;
  return semis > commas ? ';' : ',';
}

function parseCsvLine(line: string, delim: ',' | ';'): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delim && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function assertRequiredHeaders(headers: string[]) {
  const set = new Set(headers.map((h) => h.trim()));
  const missing = REQUIRED_TECH_COLUMNS.filter((c) => !set.has(c));
  if (missing.length) {
    throw new BadRequestException(
      `Faltan columnas técnicas obligatorias en la fila 2: ${missing.join(', ')}`,
    );
  }
}

function isDataRowEmpty(values: Partial<Record<ImportDataColumn, string>>) {
  return IMPORT_DATA_COLUMNS.every((col) => !String(values[col] ?? '').trim());
}

export function assertImportFile(file: Express.Multer.File) {
  if (!file?.buffer?.length) {
    throw new BadRequestException('Archivo vacío.');
  }
  if (file.buffer.length > MAX_IMPORT_BYTES) {
    throw new BadRequestException('El archivo supera 2 MB.');
  }
  const name = (file.originalname || '').toLowerCase();
  const isXlsx = name.endsWith('.xlsx');
  const isCsv = name.endsWith('.csv');
  if (!isXlsx && !isCsv) {
    throw new BadRequestException('Solo se aceptan .xlsx o .csv UTF-8.');
  }
  if (isXlsx && !isZipXlsx(file.buffer)) {
    throw new BadRequestException(
      'El .xlsx no tiene firma ZIP válida (archivo corrupto o falso).',
    );
  }
  return { isXlsx, isCsv };
}

export async function parseImportBuffer(
  buffer: Buffer,
  kind: 'xlsx' | 'csv',
): Promise<RawImportRow[]> {
  if (kind === 'csv') {
    return parseCsvBuffer(buffer);
  }
  return parseXlsxBuffer(buffer);
}

async function parseXlsxBuffer(buffer: Buffer): Promise<RawImportRow[]> {
  const wb = new ExcelJS.Workbook();
  // exceljs tipa Buffer de forma estricta; Uint8Array es compatible en runtime
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet =
    wb.getWorksheet('Relojes') ||
    wb.worksheets.find((s) => /reloj/i.test(s.name)) ||
    wb.worksheets[0];
  if (!sheet) throw new BadRequestException('El Excel no tiene hojas.');

  const headerRow = sheet.getRow(2);
  const colIndex = new Map<ImportDataColumn, number>();
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const name = neutralizeSpreadsheetText(cellToString(cell.value)).trim();
    if ((IMPORT_DATA_COLUMNS as readonly string[]).includes(name)) {
      colIndex.set(name as ImportDataColumn, colNumber);
    }
  });
  assertRequiredHeaders([...colIndex.keys()]);

  const rows: RawImportRow[] = [];
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    if (rowNumber <= 2) return;
    const values: Partial<Record<ImportDataColumn, string>> = {};
    for (const col of IMPORT_DATA_COLUMNS) {
      const idx = colIndex.get(col);
      if (!idx) continue;
      const raw = cellToString(row.getCell(idx).value);
      // Solo valores (no fórmulas): si la celda era fórmula, cellToString ya usa result
      values[col] = neutralizeSpreadsheetText(raw);
    }
    if (isDataRowEmpty(values)) return;
    rows.push({ rowNumber, values });
  });

  if (rows.length > MAX_IMPORT_ROWS) {
    throw new BadRequestException(`Máximo ${MAX_IMPORT_ROWS} filas de datos.`);
  }
  return rows;
}

function parseCsvBuffer(buffer: Buffer): RawImportRow[] {
  let text = buffer.toString('utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const lines = text.split(/\r?\n/).filter((l, i, arr) => {
    // keep empty middle lines; drop trailing empties later
    return i < arr.length - 1 || l.trim().length > 0;
  });
  if (lines.length < 2) {
    throw new BadRequestException('CSV sin fila de nombres técnicos.');
  }
  // Fila 1 = encabezados ES (opcional en CSV), fila 2 = técnicos.
  // Si la primera línea ya parece técnica (tiene importKey), úsala como técnicos.
  let techLineIdx = 0;
  const first = parseCsvLine(lines[0], detectCsvDelimiter(lines[0]));
  if (!first.map((h) => h.trim()).includes('importKey') && lines.length >= 2) {
    techLineIdx = 1;
  }
  const delim = detectCsvDelimiter(lines[techLineIdx]);
  const headers = parseCsvLine(lines[techLineIdx], delim).map((h) =>
    neutralizeSpreadsheetText(h).trim(),
  );
  assertRequiredHeaders(headers);

  const colIndex = new Map<ImportDataColumn, number>();
  headers.forEach((h, i) => {
    if ((IMPORT_DATA_COLUMNS as readonly string[]).includes(h)) {
      colIndex.set(h as ImportDataColumn, i);
    }
  });

  const rows: RawImportRow[] = [];
  for (let i = techLineIdx + 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cells = parseCsvLine(lines[i], delim);
    const values: Partial<Record<ImportDataColumn, string>> = {};
    for (const col of IMPORT_DATA_COLUMNS) {
      const idx = colIndex.get(col);
      if (idx == null) continue;
      values[col] = neutralizeSpreadsheetText(cells[idx] ?? '');
    }
    if (isDataRowEmpty(values)) continue;
    rows.push({ rowNumber: i + 1, values });
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new BadRequestException(`Máximo ${MAX_IMPORT_ROWS} filas de datos.`);
  }
  return rows;
}
