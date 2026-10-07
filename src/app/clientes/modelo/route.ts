import { CSV_TEMPLATE } from "@/lib/clientImport";

// Planilha modelo. O BOM faz o Excel abrir os acentos certos.
export function GET() {
  return new Response("﻿" + CSV_TEMPLATE, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="clientes-modelo.csv"',
    },
  });
}
