// Regra de segmento e fila da página inicial. Rodar: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateGrant, type Client, type Orientation, type User } from "../src/lib/domain";
import { buildQueue, clientsNeedingAction, daysSince } from "../src/lib/queue";

test("onboarder tem exatamente uma segmentação; liderança, uma ou mais", () => {
  assert.equal(validateGrant("onboarder", ["7D"]), null);
  assert.match(validateGrant("onboarder", ["6D", "7D"]) ?? "", /uma segmentação só/);
  assert.equal(validateGrant("lideranca", ["6D", "7D", "8D"]), null);
  assert.match(validateGrant("lideranca", []) ?? "", /ao menos uma/);
  assert.match(validateGrant("onboarder", []) ?? "", /ao menos uma/);
});

const onb: Pick<User, "id" | "role" | "segments"> = { id: "onb", role: "onboarder", segments: ["7D"] };
const lider: Pick<User, "id" | "role" | "segments"> = { id: "lider", role: "lideranca", segments: ["6D", "7D"] };

const client = (id: string, ownerId: string, segment: Client["segment"]): Client => ({
  id,
  name: id,
  segment,
  ownerId,
  stage: "Welcome",
  stageSince: "2026-10-01T12:00:00.000Z",
});

const clients = [client("meu", "onb", "7D"), client("colega", "outro", "7D"), client("oitod", "x", "8D")];

const o = (over: Partial<Orientation>): Orientation => ({
  id: over.id ?? "o",
  title: over.title ?? over.id ?? "o",
  description: "",
  scope: "geral",
  manualRef: "Manual",
  priority: 5,
  source: "lideranca",
  ...over,
});

const orientations = [
  o({ id: "meu-2", scope: "cliente", clientId: "meu", priority: 2 }),
  o({ id: "meu-1", scope: "cliente", clientId: "meu", priority: 1 }),
  o({ id: "colega", scope: "cliente", clientId: "colega", priority: 1 }),
  o({ id: "oitod", scope: "cliente", clientId: "oitod", priority: 1 }),
  o({ id: "seg7", scope: "segmento", segment: "7D" }),
  o({ id: "seg8", scope: "segmento", segment: "8D" }),
  o({ id: "geral", scope: "geral" }),
];

const ids = (items: { id: string }[]) => items.map((i) => i.id);

test("carteira do onboarder: só os clientes dele, por prioridade", () => {
  const q = buildQueue(onb, "carteira", clients, orientations);
  assert.deepEqual(ids(q), ["meu-1", "meu-2"]);
  assert.equal(clientsNeedingAction(q), 1);
});

test("liderança vê os clientes de todos os seus segmentos, nunca os de fora", () => {
  const q = buildQueue(lider, "carteira", clients, orientations);
  assert.deepEqual(ids(q).sort(), ["colega", "meu-1", "meu-2"]);
  assert.ok(!ids(q).includes("oitod"));
});

test("aba do time mostra só orientações dos segmentos da pessoa; geral é de todos", () => {
  assert.deepEqual(ids(buildQueue(onb, "time", clients, orientations)), ["seg7"]);
  assert.deepEqual(ids(buildQueue(onb, "geral", clients, orientations)), ["geral"]);
});

test("dias na etapa", () => {
  assert.equal(daysSince("2026-10-01T12:00:00.000Z", new Date("2026-10-07T13:00:00.000Z")), 6);
  assert.equal(daysSince("2026-10-08T12:00:00.000Z", new Date("2026-10-07T13:00:00.000Z")), 0);
});
