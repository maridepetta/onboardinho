/**
 * Onboardinho — VERSÃO ESTÁVEL (a que funcionou em 07/10, commit 279968d), num arquivo só.
 * No editor do Apps Script: cole TUDO isto no arquivo Código.gs (substituindo o que estiver lá).
 * Sem importação, sem página do cliente: é a versão de login, acesso, orientações, pedidos e usuários.
 */

// ===== Regras.gs =====

/**
 * Regras do Onboardinho: quem vê e quem pode o quê.
 * Só JavaScript puro (nada de SpreadsheetApp aqui), para poder ser testado fora do Google.
 */

var SEGMENTOS = { '6D': 'Clientes N2 · N3', '7D': 'Clientes N4 · N5', '8D': 'Clientes N6+' };
var ORDEM_SEGMENTOS = ['6D', '7D', '8D'];
var PAPEIS = { onboarder: 'Onboarder', lideranca: 'Liderança' };
var ETAPAS = [
  'Pre Onboarding',
  'Welcome',
  'Product Migration',
  'Ready for Activation',
  'Activation & Monitoring',
  'Accomplished',
  'Unaccomplished'
];
var ESCOPOS = ['geral', 'segmento', 'cliente'];

function normalizarTexto_(s) {
  return String(s == null ? '' : s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

/** "6d, 7D" → ['6D','7D'] na ordem 6D→8D, sem repetir e sem valores inválidos. */
function lerSegmentos_(valor) {
  var lista = Array.isArray(valor) ? valor : String(valor == null ? '' : valor).split(/[,;+\s]+/);
  var pedidos = lista.map(function (s) { return String(s).trim().toUpperCase(); });
  return ORDEM_SEGMENTOS.filter(function (s) { return pedidos.indexOf(s) >= 0; });
}

function lerEtapa_(valor) {
  var alvo = normalizarTexto_(valor);
  for (var i = 0; i < ETAPAS.length; i++) if (normalizarTexto_(ETAPAS[i]) === alvo) return ETAPAS[i];
  return null;
}

/** Data de célula (Date) ou texto dd/mm/aaaa | aaaa-mm-dd → ISO. null se inválida. */
function lerData_(valor) {
  if (valor instanceof Date) return isNaN(valor.getTime()) ? null : valor.toISOString();
  var v = String(valor == null ? '' : valor).trim();
  var br = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  var iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  var y, m, d;
  if (br) { d = +br[1]; m = +br[2]; y = +br[3]; }
  else if (iso) { y = +iso[1]; m = +iso[2]; d = +iso[3]; }
  else return null;
  var data = new Date(Date.UTC(y, m - 1, d, 12));
  if (data.getUTCFullYear() !== y || data.getUTCMonth() !== m - 1 || data.getUTCDate() !== d) return null;
  return data.toISOString();
}

function diasDesde_(iso, agora) {
  var ms = (agora || new Date()).getTime() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

/** Onboarder: exatamente 1 segmento. Liderança: 1 ou mais. Devolve erro ou null. */
function validarLiberacao_(papel, segmentos) {
  if (!PAPEIS[papel]) return 'Papel inválido.';
  if (!segmentos || segmentos.length === 0) return 'Escolha ao menos uma segmentação.';
  if (papel === 'onboarder' && segmentos.length !== 1) return 'Onboarder tem uma segmentação só.';
  return null;
}

function podeGerenciarUsuarios_(u) { return !!u && u.admin === true; }
function podeVerPedidos_(u) { return !!u && (u.admin === true || u.papel === 'lideranca'); }
function podeVerClientes_(u) { return podeVerPedidos_(u); }

/**
 * Quem decide um pedido de ajuste:
 * - ninguém decide o próprio;
 * - admin decide qualquer um;
 * - liderança decide só segmentação, e só dentro dos próprios segmentos;
 * - mudança de papel: só admin.
 */
function podeDecidir_(quem, pedido) {
  if (!quem || !pedido || pedido.status !== 'pendente') return false;
  if (normalizarTexto_(quem.email) === normalizarTexto_(pedido.email)) return false;
  if (quem.admin === true) return true;
  if (quem.papel !== 'lideranca') return false;
  if (pedido.tipo !== 'segmentacao' || !pedido.segmentos || !pedido.segmentos.length) return false;
  return pedido.segmentos.every(function (s) { return quem.segmentos.indexOf(s) >= 0; });
}

/** Clientes visíveis: onboarder vê os seus; liderança, os dos seus segmentos; admin, todos. */
function clientesVisiveis_(u, clientes) {
  return clientes.filter(function (c) {
    if (u.admin === true) return true;
    if (u.papel === 'lideranca') return u.segmentos.indexOf(c.segmento) >= 0;
    return normalizarTexto_(c.responsavelEmail) === normalizarTexto_(u.email);
  });
}

/**
 * Quem pode criar uma orientação:
 * - geral: só admin;
 * - segmento: admin, ou liderança daquele segmento;
 * - cliente: admin, ou liderança do segmento do cliente.
 */
function podeCriarOrientacao_(u, orientacao, cliente) {
  if (!u) return false;
  if (u.admin === true) return true;
  if (u.papel !== 'lideranca') return false;
  if (orientacao.escopo === 'segmento') return u.segmentos.indexOf(orientacao.segmento) >= 0;
  if (orientacao.escopo === 'cliente') return !!cliente && u.segmentos.indexOf(cliente.segmento) >= 0;
  return false;
}

/**
 * Concluir (cliente) ou arquivar (geral/segmento) uma orientação.
 * De cliente: o responsável pelo cliente, a liderança do segmento ou admin.
 * Geral/segmento: quem poderia criá-la.
 */
function podeConcluir_(u, orientacao, cliente) {
  if (!u || orientacao.status !== 'ativa') return false;
  if (orientacao.escopo === 'cliente' && cliente &&
      normalizarTexto_(cliente.responsavelEmail) === normalizarTexto_(u.email)) return true;
  return podeCriarOrientacao_(u, orientacao, cliente);
}

/** Fila da página inicial. aba: carteira | time | geral. Só orientações ativas, por prioridade. */
function montarFila_(u, aba, clientes, orientacoes) {
  var meus = {};
  clientesVisiveis_(u, clientes).forEach(function (c) { meus[c.id] = c; });
  return orientacoes
    .filter(function (o) {
      if (o.status !== 'ativa') return false;
      if (aba === 'carteira') return o.escopo === 'cliente' && !!meus[o.cliente];
      if (aba === 'time') return o.escopo === 'segmento' && u.segmentos.indexOf(o.segmento) >= 0;
      return o.escopo === 'geral';
    })
    .sort(function (a, b) { return a.prioridade - b.prioridade || a.titulo.localeCompare(b.titulo, 'pt-BR'); });
}

function descreverPedido_(p) {
  var segs = (p.segmentos || []).join(' + ');
  if (p.tipo === 'papel') return 'Papel → ' + PAPEIS[p.papel] + (segs ? ' (' + segs + ')' : '');
  return 'Segmentação → ' + segs;
}

// ===== Dados.gs =====

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
  lerTabela_('Clientes').forEach(function (r) {
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
      id: idExterno || nome,
      idExterno: idExterno,
      nome: nome,
      segmento: segmento,
      responsavelEmail: email,
      etapa: etapa,
      desde: desde
    });
  });
  return { clientes: clientes, problemas: problemas, avisos: avisos };
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

// ===== Code.gs =====

/**
 * Onboardinho — Google Apps Script.
 *
 * Instalação: veja apps-script/README.md.
 * Toda função "api*" é chamada pela tela (google.script.run). Cada uma:
 *  1. descobre quem é a pessoa pela conta Google (nunca pelo que a tela manda);
 *  2. checa a permissão aqui no servidor;
 *  3. devolve o "estado" já filtrado para essa pessoa.
 */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Onboardinho')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ---------- Identidade ----------

function emailAtual_() {
  return String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
}

function usuarioAtual_(usuarios) {
  var email = emailAtual_();
  if (!email) return null;
  return (usuarios || lerUsuarios_()).filter(function (u) { return u.email === email; })[0] || null;
}

function exigirUsuario_(usuarios) {
  var u = usuarioAtual_(usuarios);
  if (!u) throw new Error('Você não tem acesso ao Onboardinho.');
  return u;
}

// ---------- Estado para a tela ----------

/** Tudo que a tela precisa, já filtrado pelo que a pessoa pode ver. */
function apiEstado() {
  var email = emailAtual_();
  if (!email) return { tela: 'sem-email' };
  var usuarios = lerUsuarios_();
  var eu = usuarioAtual_(usuarios);
  if (!eu) return { tela: 'sem-acesso', email: email };

  var lidos = lerClientes_(usuarios);
  var clientes = clientesVisiveis_(eu, lidos.clientes);
  var idsClientes = {};
  clientes.forEach(function (c) { idsClientes[c.id] = true; });

  var orientacoes = lerOrientacoes_().filter(function (o) {
    if (o.escopo === 'geral') return true;
    if (o.escopo === 'segmento') return eu.admin || eu.segmentos.indexOf(o.segmento) >= 0;
    return !!idsClientes[o.cliente];
  });

  var pedidos = lerPedidos_();
  var meusPedidos = pedidos.filter(function (p) { return p.email === eu.email; });
  var paraDecidir = pedidos.filter(function (p) { return podeDecidir_(eu, p); });
  var historico = pedidos.filter(function (p) {
    return p.status !== 'pendente' && (eu.admin || normalizarTexto_(p.decididoPor) === eu.email);
  });

  // Só os nomes que aparecem para esta pessoa (responsáveis dos clientes dela e quem fez pedidos).
  var precisa = {};
  precisa[eu.email] = true;
  precisa[eu.liberadoPor] = true;
  clientes.forEach(function (c) { precisa[c.responsavelEmail] = true; });
  paraDecidir.concat(historico).forEach(function (p) { precisa[p.email] = true; precisa[p.decididoPor] = true; });
  var nomes = {};
  usuarios.forEach(function (u) { if (eu.admin || precisa[u.email]) nomes[u.email] = u.nome || u.email; });

  var clientesPorId = {};
  lidos.clientes.forEach(function (c) { clientesPorId[c.id] = c; });

  return {
    tela: eu.confirmadoEm ? 'app' : 'primeiro-acesso',
    agora: new Date().toISOString(),
    eu: semLinha_(eu),
    nomes: nomes,
    clientes: clientes,
    orientacoes: orientacoes.map(function (o) {
      var c = clientesPorId[o.cliente];
      return Object.assign(semLinha_(o), { podeConcluir: podeConcluir_(eu, o, c) });
    }),
    meusPedidos: meusPedidos.map(semLinha_),
    paraDecidir: paraDecidir.map(semLinha_),
    historico: historico.slice(0, 50).map(semLinha_),
    usuarios: podeGerenciarUsuarios_(eu) ? usuarios.map(semLinha_) : [],
    problemasClientes: eu.admin ? lidos.problemas : [],
    avisosClientes: eu.admin ? lidos.avisos : [],
    planilhaUrl: eu.admin ? urlPlanilha_() : ''
  };
}

function semLinha_(obj) {
  var copia = Object.assign({}, obj);
  delete copia.linha;
  return copia;
}

// ---------- Primeiro acesso e ajustes ----------

function apiConfirmarAcesso() {
  return comTrava_(function () {
    var eu = exigirUsuario_();
    if (!eu.confirmadoEm) atualizar_('Usuarios', eu.linha, { confirmado_em: new Date().toISOString() });
    return apiEstado();
  });
}

/** pedido: { tipo: 'segmentacao'|'papel', papel?, segmentos: [], nota } */
function apiPedirAjuste(pedido) {
  return comTrava_(function () {
    var eu = exigirUsuario_();
    pedido = pedido || {};
    var pendente = lerPedidos_().some(function (p) { return p.email === eu.email && p.status === 'pendente'; });
    if (pendente) throw new Error('Você já tem um pedido aguardando resposta.');

    var segmentos = lerSegmentos_(pedido.segmentos || []);
    var registro = { id: Utilities.getUuid(), email: eu.email, nota: String(pedido.nota || '').slice(0, 500),
      status: 'pendente', criado_em: new Date().toISOString() };

    if (pedido.tipo === 'papel') {
      if (!PAPEIS[pedido.papel] || pedido.papel === eu.papel) throw new Error('Escolha um papel diferente do atual.');
      if (!segmentos.length) segmentos = eu.segmentos;
      var erroPapel = validarLiberacao_(pedido.papel, segmentos);
      if (erroPapel) throw new Error(erroPapel);
      registro.tipo = 'papel';
      registro.papel = pedido.papel;
    } else if (pedido.tipo === 'segmentacao') {
      var erroSeg = validarLiberacao_(eu.papel, segmentos);
      if (erroSeg) throw new Error(erroSeg);
      if (segmentos.join() === eu.segmentos.join()) throw new Error('Essas já são as suas segmentações.');
      registro.tipo = 'segmentacao';
    } else {
      throw new Error('Pedido inválido.');
    }
    registro.segmentos = segmentos.join(', ');
    inserir_('Pedidos', registro);
    return apiEstado();
  });
}

function apiDecidir(idPedido, aprovar) {
  return comTrava_(function () {
    var usuarios = lerUsuarios_();
    var eu = exigirUsuario_(usuarios);
    var pedido = lerPedidos_().filter(function (p) { return p.id === String(idPedido); })[0];
    if (!pedido || !podeDecidir_(eu, pedido)) throw new Error('Você não pode decidir este pedido.');
    var agora = new Date().toISOString();
    atualizar_('Pedidos', pedido.linha, {
      status: aprovar ? 'aprovado' : 'recusado', decidido_por: eu.email, decidido_em: agora
    });
    if (aprovar) {
      var alvo = usuarios.filter(function (u) { return u.email === pedido.email; })[0];
      if (alvo) {
        var mudancas = { segmentos: pedido.segmentos.join(', '), liberado_por: eu.email, liberado_em: agora };
        if (pedido.tipo === 'papel') mudancas.papel = pedido.papel;
        atualizar_('Usuarios', alvo.linha, mudancas);
      }
    }
    return apiEstado();
  });
}

// ---------- Usuários (admin) ----------

/** dados: { nome, email, papel, segmentos: [], admin } */
function apiCriarUsuario(dados) {
  return comTrava_(function () {
    var usuarios = lerUsuarios_();
    var eu = exigirUsuario_(usuarios);
    if (!podeGerenciarUsuarios_(eu)) throw new Error('Só admin cria usuários.');
    dados = dados || {};
    var nome = String(dados.nome || '').trim();
    var email = String(dados.email || '').trim().toLowerCase();
    var segmentos = lerSegmentos_(dados.segmentos || []);
    if (!nome) throw new Error('Informe o nome.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('E-mail inválido.');
    var erro = validarLiberacao_(dados.papel, segmentos);
    if (erro) throw new Error(erro);
    if (usuarios.some(function (u) { return u.email === email; })) throw new Error('Já existe um usuário com esse e-mail.');
    inserir_('Usuarios', {
      email: email, nome: nome, papel: dados.papel, segmentos: segmentos.join(', '), admin: dados.admin === true,
      liberado_por: eu.email, liberado_em: new Date().toISOString(), confirmado_em: ''
    });
    return apiEstado();
  });
}

// ---------- Orientações ----------

/** dados: { titulo, descricao, escopo, segmento?, cliente?, etapa?, refManual, prioridade } */
function apiCriarOrientacao(dados) {
  return comTrava_(function () {
    var usuarios = lerUsuarios_();
    var eu = exigirUsuario_(usuarios);
    dados = dados || {};
    var o = {
      titulo: String(dados.titulo || '').trim().slice(0, 140),
      descricao: String(dados.descricao || '').trim().slice(0, 1000),
      escopo: String(dados.escopo || ''),
      segmento: lerSegmentos_([dados.segmento || ''])[0] || '',
      cliente: String(dados.cliente || '').trim(),
      etapa: dados.etapa ? lerEtapa_(dados.etapa) : '',
      refManual: String(dados.refManual || '').trim().slice(0, 80),
      prioridade: Math.min(9, Math.max(1, parseInt(dados.prioridade, 10) || 3))
    };
    if (!o.titulo) throw new Error('Informe o título.');
    if (ESCOPOS.indexOf(o.escopo) < 0) throw new Error('Escolha para quem vale a orientação.');
    if (dados.etapa && !o.etapa) throw new Error('Etapa inválida.');
    var cliente = null;
    if (o.escopo === 'segmento' && !o.segmento) throw new Error('Escolha o segmento.');
    if (o.escopo === 'cliente') {
      cliente = lerClientes_(usuarios).clientes.filter(function (c) { return c.id === o.cliente; })[0];
      if (!cliente) throw new Error('Cliente não encontrado.');
    }
    if (!podeCriarOrientacao_(eu, o, cliente)) throw new Error('Você não pode criar esta orientação.');
    inserir_('Orientacoes', {
      id: Utilities.getUuid(), titulo: o.titulo, descricao: o.descricao, escopo: o.escopo,
      segmento: o.escopo === 'segmento' ? o.segmento : '', cliente: o.escopo === 'cliente' ? o.cliente : '',
      etapa: o.etapa || '', ref_manual: o.refManual, prioridade: o.prioridade, origem: 'lideranca',
      status: 'ativa', criado_por: eu.email, criado_em: new Date().toISOString()
    });
    return apiEstado();
  });
}

function apiConcluirOrientacao(id) {
  return comTrava_(function () {
    var usuarios = lerUsuarios_();
    var eu = exigirUsuario_(usuarios);
    var o = lerOrientacoes_().filter(function (x) { return x.id === String(id); })[0];
    if (!o) throw new Error('Orientação não encontrada.');
    var cliente = lerClientes_(usuarios).clientes.filter(function (c) { return c.id === o.cliente; })[0];
    if (!podeConcluir_(eu, o, cliente)) throw new Error('Você não pode concluir esta orientação.');
    atualizar_('Orientacoes', o.linha, {
      status: 'concluida', concluida_por: eu.email, concluida_em: new Date().toISOString()
    });
    return apiEstado();
  });
}
