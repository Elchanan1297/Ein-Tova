/**
 * קריאת טבלה מטקסט: הדבקה מאקסל (טאבים) או קובץ CSV (פסיקים / נקודה־פסיק).
 * תומך בגרשיים ("..."), שורות חדשות בתוך תא, ו־BOM.
 */
export function parseTable(text: string): string[][] {
  const src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const firstLine = src.slice(0, src.indexOf('\n') >>> 0);
  const delimiter = firstLine.includes('\t')
    ? '\t'
    : count(firstLine, ';') > count(firstLine, ',')
      ? ';'
      : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ''));
}

/** קובץ CSV מאקסל בעברית שמור לפעמים ב־Windows-1255 ולא ב־UTF-8 */
export async function readTextFile(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1255').decode(bytes);
  }
}

/** CSV עם BOM כדי שאקסל יפתח עברית נכון */
export function toCsv(rows: string[][]): Blob {
  const esc = (c: string) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c);
  return new Blob(['﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
}

function count(s: string, ch: string): number {
  return s.split(ch).length - 1;
}
