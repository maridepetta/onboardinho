// Servidor do Onboardinho (apps-script/*.gs) rodando contra uma planilha de mentira.
// Rodar: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createGoogleFakes } = require("./apps-script/googleFakes.js");

const GS = ["Regras.gs", "Dados.gs", "Code.gs"].map((f) =>
  readFileSync(join(__dirname, "..", "apps-script", f), "utf8"),
);

const DONA = "dona@empresa.com";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type App = any;

function novoApp() {
  const fakes = createGoogleFakes({ owner: DONA, email: DONA });
  const ctx = vm.createContext({ ...fakes.services });
  GS.forEach((code) => vm.runInContext(code, ctx));
  // Como o google.script.run: tudo que volta para a tela passa por JSON.
  const plain = (x: unknown) => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
  const funcs = ctx as Record<string, unknown>;
  const app: App = new Proxy(funcs, {
    get: (target, key: string) => {
      const value = target[key];
      return typeof value === "function" ? (...args: unknown[]) => plain(value(...args)) : value;
    },
  });
  app.configurar();
  return { app, fakes, como: (email: string) => fakes.setEmail(email) };
}

function cenario() {
  const t = novoApp();
  const { app, como } = t;
  como(DONA);
  app.apiCriarUsuario({ nome: "Paula Reis", email: "lider@empresa.com", papel: "lideranca", segmentos: ["6D", "7D"] });
  app.apiCriarUsuario({ nome: "Marina Costa", email: "onb7@empresa.com", papel: "onboarder", segmentos: ["7D"] });
  app.apiCriarUsuario({ nome: "Rafael Lima", email: "onb8@empresa.com", papel: "onboarder", segmentos: ["8D"] });
  t.fakes.paste("Clientes", [
    ["AB-1", "Lumen Saúde", "7D", "onb7@empresa.com", "Activation & Monitoring", "25/09/2026"],
    ["AB-2", "Vértice Log", "7d", "ONB7@empresa.com", "ready for activation", "2026-10-03"],
    ["AB-3", "Órbita Pay", "8D", "onb8@empresa.com", "Product Migration", "01/10/2026"],
    ["AB-4", "Errado", "9D", "ninguem@x.com", "Fase X", "31/02/2026"],
  ]);
  return t;
}

test("configurar cria as abas e cadastra quem rodou como admin", () => {
  const { app, fakes } = novoApp();
  assert.deepEqual(Object.keys(fakes.sheets).sort(), ["Clientes", "Orientacoes", "Pedidos", "Usuarios"]);
  const estado = app.apiEstado();
  assert.equal(estado.tela, "app");
  assert.equal(estado.eu.email, DONA);
  assert.equal(estado.eu.admin, true);
  app.configurar(); // rodar de novo não duplica
  assert.equal(fakes.values("Usuarios").length, 2);
});

test("sem conta Google identificada, ou fora da aba Usuarios: sem acesso", () => {
  const { app, como } = novoApp();
  como("");
  assert.equal(app.apiEstado().tela, "sem-email");
  como("estranho@empresa.com");
  assert.deepEqual(app.apiEstado(), { tela: "sem-acesso", email: "estranho@empresa.com" });
  assert.throws(() => app.apiConfirmarAcesso(), /não tem acesso/);
});

test("admin cria usuário com as regras de segmento; ninguém mais cria", () => {
  const { app, como } = cenario();
  assert.throws(
    () => app.apiCriarUsuario({ nome: "X", email: "x@empresa.com", papel: "onboarder", segmentos: ["6D", "7D"] }),
    /uma segmentação só/,
  );
  assert.throws(
    () => app.apiCriarUsuario({ nome: "X", email: "LIDER@empresa.com", papel: "lideranca", segmentos: ["6D"] }),
    /Já existe/,
  );
  como("lider@empresa.com");
  assert.throws(
    () => app.apiCriarUsuario({ nome: "X", email: "y@empresa.com", papel: "onboarder", segmentos: ["6D"] }),
    /Só admin/,
  );
});

test("primeiro acesso: confirma e entra", () => {
  const { app, como } = cenario();
  como("onb7@empresa.com");
  assert.equal(app.apiEstado().tela, "primeiro-acesso");
  assert.equal(app.apiConfirmarAcesso().tela, "app");
});

test("planilha de clientes: linha ruim não entra e aparece só para o admin", () => {
  const { app, como } = cenario();
  const admin = app.apiEstado();
  assert.equal(admin.clientes.length, 3);
  assert.equal(admin.problemasClientes.length, 1);
  assert.match(admin.problemasClientes[0], /^Linha 5: .*segmento "9D".*Usuarios.*etapa "Fase X".*data "31\/02\/2026"/);
  como("lider@empresa.com");
  assert.deepEqual(app.apiEstado().problemasClientes, []);
});

test("cada um vê só os seus clientes", () => {
  const { app, como } = cenario();
  como("onb7@empresa.com");
  assert.deepEqual(app.apiEstado().clientes.map((c: { nome: string }) => c.nome).sort(), ["Lumen Saúde", "Vértice Log"]);
  como("lider@empresa.com");
  assert.deepEqual(app.apiEstado().clientes.map((c: { id: string }) => c.id).sort(), ["AB-1", "AB-2"]);
  como("onb8@empresa.com");
  const e8 = app.apiEstado();
  assert.deepEqual(e8.clientes.map((c: { id: string }) => c.id), ["AB-3"]);
  assert.equal(e8.usuarios.length, 0); // lista de usuários só para admin
  assert.ok(!("onb7@empresa.com" in e8.nomes)); // não recebe nome de quem não precisa
});

test("pedido de ajuste: um por vez; liderança só decide dentro da alçada; aprovação aplica", () => {
  const { app, como } = cenario();
  como("onb7@empresa.com");
  app.apiConfirmarAcesso();
  assert.throws(() => app.apiPedirAjuste({ tipo: "segmentacao", segmentos: ["7D", "8D"] }), /uma segmentação só/);
  app.apiPedirAjuste({ tipo: "segmentacao", segmentos: ["8D"], nota: "Atendo 8D" });
  assert.throws(() => app.apiPedirAjuste({ tipo: "segmentacao", segmentos: ["6D"] }), /já tem um pedido/);
  const id = app.apiEstado().meusPedidos[0].id;
  assert.throws(() => app.apiDecidir(id, true), /não pode decidir/); // o próprio

  como("lider@empresa.com");
  assert.equal(app.apiEstado().paraDecidir.length, 0); // 8D está fora da alçada (6D/7D)
  assert.throws(() => app.apiDecidir(id, true), /não pode decidir/);

  como(DONA);
  assert.equal(app.apiEstado().paraDecidir.length, 1);
  app.apiDecidir(id, true);
  como("onb7@empresa.com");
  const depois = app.apiEstado();
  assert.deepEqual(depois.eu.segmentos, ["8D"]);
  assert.equal(depois.eu.liberadoPor, DONA);
  assert.equal(depois.meusPedidos[0].status, "aprovado");

  // Os clientes 7D dela não somem: continuam com a liderança 7D, e o admin é avisado.
  como("lider@empresa.com");
  assert.deepEqual(app.apiEstado().clientes.map((c: { id: string }) => c.id).sort(), ["AB-1", "AB-2"]);
  como(DONA);
  const admin = app.apiEstado();
  assert.equal(admin.avisosClientes.length, 2);
  assert.match(admin.avisosClientes[0], /Lumen Saúde é 7D, mas Marina Costa agora é 8D\. Reatribua/);
});

test("orientações: quem cria, quem vê e quem conclui", () => {
  const { app, como } = cenario();
  como("lider@empresa.com");
  assert.throws(() => app.apiCriarOrientacao({ titulo: "X", escopo: "geral" }), /não pode criar/);
  assert.throws(() => app.apiCriarOrientacao({ titulo: "X", escopo: "segmento", segmento: "8D" }), /não pode criar/);
  assert.throws(() => app.apiCriarOrientacao({ titulo: "X", escopo: "cliente", cliente: "AB-3" }), /não pode criar/);
  app.apiCriarOrientacao({ titulo: "Ligar para a Lumen", descricao: "Uso caiu", escopo: "cliente", cliente: "AB-1",
    etapa: "Activation & Monitoring", refManual: "Manual 7D §5.1", prioridade: 1 });
  app.apiCriarOrientacao({ titulo: "Checklist v3", escopo: "segmento", segmento: "7D", prioridade: 2 });

  como("onb8@empresa.com");
  assert.equal(app.apiEstado().orientacoes.length, 0); // nada de 7D nem de cliente alheio

  como("onb7@empresa.com");
  assert.throws(() => app.apiCriarOrientacao({ titulo: "X", escopo: "cliente", cliente: "AB-1" }), /não pode criar/);
  const e = app.apiEstado();
  assert.equal(e.orientacoes.length, 2);
  const daLumen = e.orientacoes.find((o: { cliente: string }) => o.cliente === "AB-1");
  const doTime = e.orientacoes.find((o: { escopo: string }) => o.escopo === "segmento");
  assert.equal(daLumen.podeConcluir, true); // é a responsável pelo cliente
  assert.equal(doTime.podeConcluir, false); // aviso do time: só a liderança arquiva
  assert.throws(() => app.apiConcluirOrientacao(doTime.id), /não pode concluir/);
  const fim = app.apiConcluirOrientacao(daLumen.id);
  assert.equal(fim.orientacoes.find((o: { id: string }) => o.id === daLumen.id).status, "concluida");
  assert.equal(app.montarFila_(fim.eu, "carteira", fim.clientes, fim.orientacoes).length, 0);
});

test("texto com cara de fórmula é gravado como texto, não como fórmula", () => {
  const { app, fakes } = cenario();
  app.apiCriarUsuario({ nome: '=IMPORTXML("http://x","//a")', email: "f@empresa.com", papel: "onboarder", segmentos: ["6D"] });
  const linha = fakes.values("Usuarios").find((r: string[]) => r[0] === "f@empresa.com");
  assert.equal(linha[1], '=IMPORTXML("http://x","//a")');
  assert.ok(!JSON.stringify(fakes.sheets).includes("#FORMULA"));
});
