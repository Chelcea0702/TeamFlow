function toCsvValue(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(rows, columns) {
  const header = columns.join(",");
  const lines = rows.map((row) => columns.map((c) => toCsvValue(row[c])).join(","));
  return [header, ...lines].join("\n");
}

module.exports = { toCsv, toCsvValue };
