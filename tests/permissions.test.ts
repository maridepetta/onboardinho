// Regras de quem decide pedidos. Rodar: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { canDecide, canManageUsers, canReviewRequests } from "../src/lib/permissions";
import type { AccessRequest, User } from "../src/lib/domain";

const user = (over: Partial<User>): User => ({
  id: "u",
  name: "U",
  email: "u@x.com",
  role: "onboarder",
  segments: ["7D"],
  isAdmin: false,
  grantedBy: "Admin",
  grantedAt: "2026-01-01",
  confirmedAt: "2026-01-01",
  ...over,
});

const request = (over: Partial<AccessRequest>): AccessRequest => ({
  id: "r",
  userId: "alvo",
  kind: "segmentacao",
  segments: ["7D"],
  note: "",
  status: "pendente",
  createdAt: "2026-01-01",
  ...over,
});

const admin = user({ id: "admin", isAdmin: true, role: "lideranca", segments: ["6D", "7D", "8D"] });
const lider67 = user({ id: "lider", role: "lideranca", segments: ["6D", "7D"] });
const onboarder = user({ id: "onb" });

test("admin decide qualquer pedido de outra pessoa", () => {
  assert.equal(canDecide(admin, request({ kind: "papel", role: "lideranca" })), true);
  assert.equal(canDecide(admin, request({ segments: ["8D"] })), true);
});

test("ninguém decide o próprio pedido, nem admin", () => {
  assert.equal(canDecide(admin, request({ userId: "admin" })), false);
  assert.equal(canDecide(lider67, request({ userId: "lider", segments: ["6D"] })), false);
});

test("liderança decide segmentação só dentro das próprias segmentações", () => {
  assert.equal(canDecide(lider67, request({ segments: ["6D", "7D"] })), true);
  assert.equal(canDecide(lider67, request({ segments: ["7D", "8D"] })), false);
  assert.equal(canDecide(lider67, request({ segments: ["8D"] })), false);
});

test("liderança não decide mudança de papel", () => {
  assert.equal(canDecide(lider67, request({ kind: "papel", role: "lideranca", segments: undefined })), false);
});

test("onboarder não decide nada", () => {
  assert.equal(canDecide(onboarder, request({ segments: ["7D"] })), false);
});

test("pedido já decidido não pode ser decidido de novo", () => {
  assert.equal(canDecide(admin, request({ status: "aprovado" })), false);
});

test("só admin gerencia usuários; liderança e admin veem pedidos", () => {
  assert.equal(canManageUsers(admin), true);
  assert.equal(canManageUsers(lider67), false);
  assert.equal(canReviewRequests(lider67), true);
  assert.equal(canReviewRequests(onboarder), false);
});
