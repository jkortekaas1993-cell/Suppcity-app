/**
 * Minimal RFC 4180 CSV reader/writer. Handles quoted fields, escaped quotes,
 * CRLF/LF, a UTF-8 BOM and a configurable delimiter. Pure.
 */

export function detectDelimiter(text: string): ',' | ';' {
  const firstLine = stripBom(text).split(/\r?\n/, 1)[0] ?? '';
  let commas = 0;
  let semis = 0;
  let inQuotes = false;
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch === ',') commas++;
    else if (!inQuotes && ch === ';') semis++;
  }
  return semis > commas ? ';' : ',';
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function parseCsv(input: string, delimiter: string = detectDelimiter(input)): string[][] {
  const text = stripBom(input);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i] as string;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
      } else {
        field += ch;
      }
      i++;
      continue;
    }
    if (ch === '"' && field === '') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      if (ch === '\r' && text[i + 1] === '\n') i++;
    } else {
      field += ch;
    }
    i++;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop fully empty lines.
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** Rows as objects keyed by the (trimmed) header names. */
export function parseCsvObjects(input: string): { headers: string[]; records: Record<string, string>[] } {
  const rows = parseCsv(input);
  const headers = (rows[0] ?? []).map((h) => h.trim());
  const records = rows.slice(1).map((r) => {
    const rec: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rec[h] = (r[idx] ?? '').trim();
    });
    return rec;
  });
  return { headers, records };
}

/**
 * CSV/formula injection (OWASP): a text cell starting with = + - @ TAB or CR is run as
 * a formula by Excel/Sheets. Text (never numbers) gets a leading apostrophe.
 */
export function neutraliseFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export function escapeCsvField(value: string | number | null | undefined, delimiter = ','): string {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'number' ? String(value) : neutraliseFormula(value);
  return s.includes('"') || s.includes(delimiter) || s.includes('\n') || s.includes('\r') ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: readonly string[], rows: readonly (readonly (string | number | null | undefined)[])[]): string {
  const lines = [headers.map((h) => escapeCsvField(h)).join(',')];
  for (const r of rows) lines.push(r.map((v) => escapeCsvField(v)).join(','));
  return `${lines.join('\r\n')}\r\n`;
}
