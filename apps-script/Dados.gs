/**
 * Acesso à planilha. Cada aba é uma "tabela": linha 1 = cabeçalho, uma linha por registro.
 * A planilha fica só com o dono do script; o time acessa pelo app, nunca pela planilha.
 */

var ABAS = {
  Usuarios: ['email', 'nome', 'papel', 'segmentos', 'admin', 'liberado_por', 'liberado_em', 'confirmado_em'],
  Clientes: ['id_externo', 'nome', 'segmento', 'responsavel_email', 'etapa', 'desde'],
  Orientacoes: ['id', 'titulo', 'descricao', 'escopo', 'segmento', 'cliente', 'etapa', 'ref_manual',
    'prioridade', 'origem', 'status', 'criado_por', 'criado_em', 'concluida_por', 'concluida_em'],
  Pedidos: ['id', 'email', 'tipo', 'papel', 'segmentos', 'nota', 'status', 'criado_em', 'decidido_por', 'decidido_em']
};

var PROP_PLANILHA = 'PLANILHA_ID';

var NOME_PLANILHA = 'Onboardinho – dados';

/**
 * A planilha do app. Na primeira vez, prepara sozinha: usa a planilha onde o script foi
 * criado (Extensões → Apps Script) ou, se o projeto foi criado em script.google.com,
 * cria uma planilha nova no Drive de quem publicou. Não precisa rodar nada no editor.
 */
function planilha_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(PROP_PLANILHA);
  if (id) return SpreadsheetApp.openById(id);
  var ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.create(NOME_PLANILHA);
  props.setProperty(PROP_PLANILHA, ss.getId());
  prepararAbas_(ss);
  cadastrarDonaComoAdmin_();
  return ss;
}

function prepararAbas_(ss) {
  Object.keys(ABAS).forEach(function (nome) {
    var sh = ss.getSheetByName(nome) || ss.insertSheet(nome);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, ABAS[nome].length).setValues([ABAS[nome]]).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
  });
}

/** Quem publicou o app (o script roda como essa pessoa) vira admin, se ainda não estiver cadastrada. */
function cadastrarDonaComoAdmin_() {
  var eu = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  if (!eu || lerUsuarios_().some(function (u) { return u.email === eu; })) return;
  var agora = new Date().toISOString();
  inserir_('Usuarios', {
    email: eu, nome: eu.split('@')[0], papel: 'lideranca', segmentos: '6D, 7D, 8D', admin: true,
    liberado_por: 'configuração inicial', liberado_em: agora, confirmado_em: agora
  });
}

/** Link da planilha (para o admin abrir pelo app). */
function urlPlanilha_() {
  return planilha_().getUrl();
}

function aba_(nome) {
  var sh = planilha_().getSheetByName(nome);
  if (!sh) throw new Error('Aba "' + nome + '" não encontrada. Rode "configurar" de novo.');
  return sh;
}

/** Lê a aba como lista de objetos { coluna: valor, _linha: n }. Ignora linhas totalmente vazias. */
function lerTabela_(nome) {
  var valores = aba_(nome).getDataRange().getValues();
  if (valores.length < 2) return [];
  var cab = valores[0].map(function (c) { return normalizarTexto_(c); });
  var out = [];
  for (var i = 1; i < valores.length; i++) {
    var linha = valores[i];
    if (linha.every(function (v) { return v === '' || v === null; })) continue;
    var obj = { _linha: i + 1 };
    cab.forEach(function (c, j) { if (c) obj[c] = linha[j]; });
    out.push(obj);
  }
  return out;
}

/**
 * Texto que começa com = + - @ vira fórmula no Sheets. Um nome de cliente como
 * "=IMPORTXML(...)" poderia vazar dados. O apóstrofo força texto.
 */
function celulaSegura_(v) {
  if (typeof v === 'string' && /^[=+\-@]/.test(v)) return "'" + v;
  return v;
}

function linhaDe_(nome, obj) {
  return ABAS[nome].map(function (c) { return celulaSegura_(obj[c] == null ? '' : obj[c]); });
}

function inserir_(nome, obj) {
  aba_(nome).appendRow(linhaDe_(nome, obj));
}

/** Atualiza só as colunas informadas da linha `linha`. */
function atualizar_(nome, linha, mudancas) {
  var sh = aba_(nome);
  Object.keys(mudancas).forEach(function (col) {
    var j = ABAS[nome].indexOf(col);
    if (j < 0) throw new Error('Coluna desconhecida: ' + col);
    sh.getRange(linha, j + 1).setValue(celulaSegura_(mudancas[col]));
  });
}

/** Escritas passam por aqui: uma de cada vez, para duas pessoas não gravarem na mesma linha. */
function comTrava_(fn) {
  var trava = LockService.getScriptLock();
  trava.waitLock(15000);
  try { return fn(); } finally { trava.releaseLock(); }
}

/** Data de hoje (aaaa-mm-dd) no fuso do projeto, não em UTC: à noite no Brasil, UTC já é amanhã. */
function hoje_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'America/Sao_Paulo', 'yyyy-MM-dd');
}

function iso_(v) {
  if (v instanceof Date) return v.toISOString();
  return v ? String(v) : '';
}

// ---------- Leitura tipada ----------

function lerUsuarios_() {
  return lerTabela_('Usuarios').map(function (r) {
    return {
      linha: r._linha,
      email: String(r.email || '').trim().toLowerCase(),
      nome: String(r.nome || '').trim(),
      papel: String(r.papel || '').trim().toLowerCase(),
      segmentos: lerSegmentos_(r.segmentos),
      admin: r.admin === true || normalizarTexto_(r.admin) === 'true' || normalizarTexto_(r.admin) === 'sim',
      liberadoPor: String(r.liberado_por || ''),
      liberadoEm: iso_(r.liberado_em),
      confirmadoEm: iso_(r.confirmado_em)
    };
  }).filter(function (u) { return u.email; });
}

/**
 * Clientes da aba "Clientes" (colada da exportação).
 * - `problemas`: linhas que não dá para usar (sem nome, segmento/etapa/data inválidos,
 *   responsável desconhecido). Não entram na tela.
 * - `avisos`: linhas usáveis mas que precisam de atenção, como responsável que mudou de
 *   segmento. O cliente continua visível para não sumir de ninguém; o admin reatribui.
 */
function lerClientes_(usuarios) {
  var porEmail = {};
  usuarios.forEach(function (u) { porEmail[u.email] = u; });
  var clientes = [];
  var problemas = [];
  var avisos = [];
  var linhas = lerTabela_('Clientes');
  linhas.forEach(function (r) {
    var erros = [];
    var nome = String(r.nome || '').trim();
    var segmento = lerSegmentos_(r.segmento)[0];
    var email = String(r.responsavel_email || '').trim().toLowerCase();
    var dono = porEmail[email];
    var etapa = lerEtapa_(r.etapa);
    var desde = lerData_(r.desde);
    if (!nome) erros.push('nome vazio');
    if (!segmento) erros.push('segmento "' + r.segmento + '" inválido');
    if (!dono) erros.push('responsável "' + email + '" não está na aba Usuarios');
    else if (segmento && (dono.papel !== 'onboarder' || dono.segmentos.indexOf(segmento) < 0)) {
      avisos.push('Linha ' + r._linha + ': ' + nome + ' é ' + segmento + ', mas ' + (dono.nome || email) +
        (dono.papel !== 'onboarder' ? ' não é onboarder' : ' agora é ' + dono.segmentos.join(' + ')) +
        '. Reatribua o responsável.');
    }
    if (!etapa) erros.push('etapa "' + r.etapa + '" não existe');
    if (!desde) erros.push('data "' + r.desde + '" inválida');
    if (erros.length) { problemas.push('Linha ' + r._linha + ': ' + erros.join('; ') + '.'); return; }
    var idExterno = String(r.id_externo || '').trim();
    clientes.push({
      linha: r._linha,
      id: idExterno || nome,
      idExterno: idExterno,
      nome: nome,
      segmento: segmento,
      responsavelEmail: email,
      etapa: etapa,
      desde: desde
    });
  });
  return { clientes: clientes, problemas: problemas, avisos: avisos, totalLinhas: linhas.length };
}

function lerOrientacoes_() {
  return lerTabela_('Orientacoes').map(function (r) {
    return {
      linha: r._linha,
      id: String(r.id),
      titulo: String(r.titulo || ''),
      descricao: String(r.descricao || ''),
      escopo: String(r.escopo || '').trim().toLowerCase(),
      segmento: lerSegmentos_(r.segmento)[0] || '',
      cliente: String(r.cliente || '').trim(),
      etapa: lerEtapa_(r.etapa) || '',
      refManual: String(r.ref_manual || ''),
      prioridade: Number(r.prioridade) || 99,
      origem: normalizarTexto_(r.origem) === 'ia' ? 'ia' : 'lideranca',
      status: normalizarTexto_(r.status) || 'ativa',
      criadoPor: String(r.criado_por || ''),
      criadoEm: iso_(r.criado_em)
    };
  }).filter(function (o) { return o.id && o.titulo && ESCOPOS.indexOf(o.escopo) >= 0; });
}

function lerPedidos_() {
  return lerTabela_('Pedidos').map(function (r) {
    return {
      linha: r._linha,
      id: String(r.id),
      email: String(r.email || '').trim().toLowerCase(),
      tipo: String(r.tipo || ''),
      papel: String(r.papel || ''),
      segmentos: lerSegmentos_(r.segmentos),
      nota: String(r.nota || ''),
      status: String(r.status || 'pendente'),
      criadoEm: iso_(r.criado_em),
      decididoPor: String(r.decidido_por || ''),
      decididoEm: iso_(r.decidido_em)
    };
  }).sort(function (a, b) { return a.criadoEm < b.criadoEm ? 1 : -1; });
}

// ---------- Configuração (opcional) ----------

/**
 * Opcional: rode pelo editor para preparar tudo e ver o link da planilha no registro.
 * O app também se prepara sozinho na primeira vez que alguém abre o link.
 */
function configurar() {
  var ss = planilha_();
  prepararAbas_(ss);
  cadastrarDonaComoAdmin_();
  var msg = 'Pronto. Planilha: ' + ss.getUrl() + ' · Admin: ' + Session.getEffectiveUser().getEmail();
  Logger.log(msg);
  return msg;
}
