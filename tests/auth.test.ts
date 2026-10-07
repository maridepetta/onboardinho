// Senha e token de sessão. Rodar: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createSessionToken,
  hashPassword,
  readSessionToken,
  verifyPassword,
} from "../src/lib/auth";

test("senha: confere a certa, recusa a errada, e o hash nunca é o texto", () => {
  const stored = hashPassword("senha-forte-1");
  assert.ok(!stored.includes("senha-forte-1"));
  assert.equal(verifyPassword("senha-forte-1", stored), true);
  assert.equal(verifyPassword("senha-forte-2", stored), false);
  assert.equal(verifyPassword("", stored), false);
});

test("mesma senha gera hashes diferentes (sal aleatório)", () => {
  assert.notEqual(hashPassword("x12345678"), hashPassword("x12345678"));
});

test("sem senha cadastrada ou formato estranho: recusa", () => {
  assert.equal(verifyPassword("qualquer", undefined), false);
  assert.equal(verifyPassword("qualquer", "texto-puro"), false);
});

test("token de sessão: lê o próprio, recusa adulterado ou de outro segredo", () => {
  const token = createSessionToken("u-onb-7d", "segredo");
  assert.equal(readSessionToken(token, "segredo"), "u-onb-7d");
  assert.equal(readSessionToken(token.replace("u-onb-7d", "u-admin"), "segredo"), null);
  assert.equal(readSessionToken(token, "outro-segredo"), null);
  assert.equal(readSessionToken("u-admin", "segredo"), null);
  assert.equal(readSessionToken(undefined, "segredo"), null);
});
