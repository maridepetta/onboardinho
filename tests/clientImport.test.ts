// Importação de clientes por planilha. Rodar: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { CSV_TEMPLATE, parseCsv, parseDate, validateImport } from "../src/lib/clientImport";
import type { User } from "../src/lib/domain";

const users: Pick<User, "id" | "email" | "role" | "segments">[] = [
  { id: "onb7", email: "onb7@empresa.com", role: "onboarder", segments: ["7D"] },
  { id: "onb8", email: "onb8@empresa.com", role: "onboarder", segments: ["8D"] },
  { id: "lider", email: "lider@empresa.com", role: "lideranca", segments: ["6D", "7D"] },
];
const admin = { isAdmin: true, segments: [] };
const lider = { isAdmin: false, segments: ["6D", "7D"] as User["segments"] };
const now = new Date("2026-10-07T12:00:00.000Z");
const HEADER = "id_externo;nome;segmento;responsavel_email;etapa;desde";

test("lê ; e , e respeita aspas", () => {
  assert.deepEqual(parseCsv('a;b\n"x;y";"diz ""oi"""\n'), [["a", "b"], ["x;y", 'diz "oi"']]);
  assert.deepEqual(parseCsv("a,b\r\n1,2"), [["a", "b"], ["1", "2"]]);
  assert.deepEqual(parseCsv("﻿a;b\n\n1;2\n"), [["a", "b"], ["1", "2"]]);
});

test("datas brasileiras e ISO; rejeita data impossível", () => {
  assert.equal(parseDate("25/09/2026"), "2026-09-25T12:00:00.000Z");
  assert.equal(parseDate("2026-09-25"), "2026-09-25T12:00:00.000Z");
  assert.equal(parseDate("31/02/2026"), undefined);
  assert.equal(parseDate("09/25/2026"), undefined);
});

test("a planilha modelo é válida", () => {
  const template = CSV_TEMPLATE.replace("onboarder7d@empresa.com", "onb7@empresa.com");
  const { rows, errors } = validateImport(template, users, admin, now);
  assert.deepEqual(errors, []);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].externalId, "AB-1042");
  assert.equal(rows[0].stage, "Activation & Monitoring");
});

test("aceita etapa sem acento/maiúscula e cabeçalho em outra ordem", () => {
  const csv = "nome,desde,etapa,segmento,responsavel_email\nCasa,01/10/2026,pre onboarding,7d,ONB7@empresa.com";
  const { rows, errors } = validateImport(csv, users, admin, now);
  assert.deepEqual(errors, []);
  assert.equal(rows[0].stage, "Pre Onboarding");
  assert.equal(rows[0].segment, "7D");
  assert.equal(rows[0].ownerId, "onb7");
});

test("qualquer erro: nada é importado e cada linha diz o motivo", () => {
  const csv = [
    HEADER,
    "1;Boa;7D;onb7@empresa.com;Welcome;01/10/2026",
    "2;Errada;9D;ninguem@x.com;Fase X;99/99/2026",
    "3;Segmento trocado;7D;onb8@empresa.com;Welcome;01/10/2026",
    "4;Futuro;7D;onb7@empresa.com;Welcome;01/12/2026",
    "1;Repetido;7D;onb7@empresa.com;Welcome;01/10/2026",
  ].join("\n");
  const { rows, errors } = validateImport(csv, users, admin, now);
  assert.equal(rows.length, 0);
  assert.equal(errors.length, 4);
  assert.match(errors[0], /^Linha 3: .*segmento "9D".*responsável.*etapa "Fase X".*data "99\/99\/2026"/);
  assert.match(errors[1], /^Linha 4: .*não é do segmento 7D/);
  assert.match(errors[2], /^Linha 5: data no futuro/);
  assert.match(errors[3], /^Linha 6: id_externo "1" repetido/);
});

test("liderança só importa clientes dos próprios segmentos", () => {
  const csv = `${HEADER}\n;Fora;8D;onb8@empresa.com;Welcome;01/10/2026`;
  const { errors } = validateImport(csv, users, lider, now);
  assert.match(errors[0], /não tem acesso ao segmento 8D/);
});

test("responsável precisa ser onboarder", () => {
  const csv = `${HEADER}\n;X;7D;lider@empresa.com;Welcome;01/10/2026`;
  assert.match(validateImport(csv, users, admin, now).errors[0], /não é onboarder/);
});

test("cabeçalho incompleto", () => {
  assert.match(validateImport("nome;segmento\nA;7D", users, admin, now).errors[0], /Faltam colunas/);
});
