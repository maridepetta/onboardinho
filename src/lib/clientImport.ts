import { STAGES, isSegment, type Segment, type Stage, type User } from "./domain";

// Importação de clientes por planilha (CSV). Funções puras, testadas.
//
// Colunas (cabeçalho obrigatório, em qualquer ordem):
//   id_externo          opcional — id do cliente no sistema de origem (ex.: Astrobox).
//                       Se vier, é a chave para atualizar o cliente nas próximas importações.
//   nome                obrigatório
//   segmento            6D | 7D | 8D
//   responsavel_email   e-mail de um onboarder cadastrado, do mesmo segmento
//   etapa               uma das etapas do pipeline
//   desde               data em que entrou na etapa: dd/mm/aaaa ou aaaa-mm-dd
//
// Separador: vírgula ou ponto e vírgula (o Excel em português salva com ";").

export const CSV_COLUMNS = [
  "id_externo",
  "nome",
  "segmento",
  "responsavel_email",
  "etapa",
  "desde",
] as const;

const REQUIRED = ["nome", "segmento", "responsavel_email", "etapa", "desde"] as const;

export const CSV_TEMPLATE =
  CSV_COLUMNS.join(";") +
  "\n" +
  "AB-1042;Lumen Saúde;7D;onboarder7d@empresa.com;Activation & Monitoring;25/09/2026\n";

export type ImportedClient = {
  externalId?: string;
  name: string;
  segment: Segment;
  ownerId: string;
  stage: Stage;
  stageSince: string; // ISO
};

export type ImportResult = { rows: ImportedClient[]; errors: string[] };

// Divide o texto em linhas e células, respeitando aspas ("a;b" é uma célula só).
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, ""); // BOM do Excel
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

function parseStage(value: string): Stage | undefined {
  return STAGES.find((s) => normalize(s) === normalize(value));
}

// dd/mm/aaaa ou aaaa-mm-dd → ISO (meio-dia UTC, para não virar o dia anterior no fuso).
export function parseDate(value: string): string | undefined {
  const v = value.trim();
  let y: number, m: number, d: number;
  const br = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (br) [d, m, y] = [Number(br[1]), Number(br[2]), Number(br[3])];
  else if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else return undefined;
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return undefined; // 31/02 etc.
  }
  return date.toISOString();
}

// Valida a planilha inteira. Quem importa só pode trazer clientes dos próprios segmentos
// (admin: todos). Qualquer erro → nada é importado; a lista de erros diz linha e motivo.
export function validateImport(
  text: string,
  users: Pick<User, "id" | "email" | "role" | "segments">[],
  importer: Pick<User, "isAdmin" | "segments">,
  now: Date = new Date(),
): ImportResult {
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], errors: ["A planilha está vazia ou só tem o cabeçalho."] };

  const header = table[0].map(normalize);
  const missing = REQUIRED.filter((c) => !header.includes(c));
  if (missing.length) {
    return { rows: [], errors: [`Faltam colunas no cabeçalho: ${missing.join(", ")}.`] };
  }
  const col = (row: string[], name: string) => (row[header.indexOf(name)] ?? "").trim();

  const byEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));
  const rows: ImportedClient[] = [];
  const errors: string[] = [];
  const seenIds = new Set<string>();

  table.slice(1).forEach((row, i) => {
    const line = i + 2; // linha 1 é o cabeçalho
    const problems: string[] = [];

    const externalId = header.includes("id_externo") ? col(row, "id_externo") : "";
    const name = col(row, "nome");
    const segment = col(row, "segmento").toUpperCase();
    const ownerEmail = col(row, "responsavel_email").toLowerCase();
    const stage = parseStage(col(row, "etapa"));
    const since = parseDate(col(row, "desde"));
    const owner = byEmail.get(ownerEmail);

    if (!name) problems.push("nome vazio");
    if (!isSegment(segment)) problems.push(`segmento "${col(row, "segmento")}" inválido (use 6D, 7D ou 8D)`);
    if (!owner) problems.push(`responsável "${ownerEmail}" não é um usuário cadastrado`);
    else if (owner.role !== "onboarder") problems.push(`responsável "${ownerEmail}" não é onboarder`);
    else if (isSegment(segment) && !owner.segments.includes(segment)) {
      problems.push(`responsável "${ownerEmail}" não é do segmento ${segment}`);
    }
    if (!stage) problems.push(`etapa "${col(row, "etapa")}" não existe`);
    if (!since) problems.push(`data "${col(row, "desde")}" inválida (use dd/mm/aaaa)`);
    else if (new Date(since) > now) problems.push("data no futuro");
    if (isSegment(segment) && !importer.isAdmin && !importer.segments.includes(segment)) {
      problems.push(`você não tem acesso ao segmento ${segment}`);
    }
    if (externalId) {
      if (seenIds.has(externalId)) problems.push(`id_externo "${externalId}" repetido na planilha`);
      seenIds.add(externalId);
    }

    if (problems.length) {
      errors.push(`Linha ${line}: ${problems.join("; ")}.`);
      return;
    }
    rows.push({
      ...(externalId ? { externalId } : {}),
      name,
      segment: segment as Segment,
      ownerId: owner!.id,
      stage: stage!,
      stageSince: since!,
    });
  });

  return { rows: errors.length ? [] : rows, errors };
}
