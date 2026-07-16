export function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function rowsToCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return rows
    .map((row) => row.map((cell) => escapeCsvField(cell)).join(","))
    .join("\r\n");
}
