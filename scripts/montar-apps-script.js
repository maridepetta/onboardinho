/* eslint-disable @typescript-eslint/no-require-imports -- script Node simples (CommonJS) */
// Junta Regras.gs, Dados.gs e Code.gs num arquivo só (apps-script/Onboardinho.gs).
// É esse arquivo que vai no editor do Apps Script, colado no "Código.gs": um arquivo só
// evita sobrar um pedaço antigo misturado com um novo.
// Rodar: npm run montar
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "apps-script");
const partes = ["Regras.gs", "Dados.gs", "Code.gs"];

function montar() {
  const corpo = partes.map((p) => "// ===== " + p + " =====\n\n" + fs.readFileSync(path.join(dir, p), "utf8").trim() + "\n").join("\n");
  // Versão = começo do hash do conteúdo: o mesmo código dá sempre a mesma versão.
  const versao = crypto.createHash("sha256").update(corpo).digest("hex").slice(0, 7);
  const cabecalho = [
    "/**",
    " * Onboardinho — código do servidor (arquivo único).",
    " * Gerado por scripts/montar-apps-script.js a partir de Regras.gs, Dados.gs e Code.gs.",
    " * No editor do Apps Script: cole TUDO isto no arquivo Código.gs e apague Dados.gs e Regras.gs.",
    " */",
    "",
    "var VERSAO_ONBOARDINHO = '" + versao + "';",
    "",
    "",
  ].join("\n");
  return cabecalho + corpo;
}

if (require.main === module) {
  fs.writeFileSync(path.join(dir, "Onboardinho.gs"), montar());
  console.log("apps-script/Onboardinho.gs atualizado");
}
module.exports = { montar };
