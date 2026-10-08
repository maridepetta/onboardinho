/**
 * Acesso à planilha. Cada aba é uma "tabela": linha 1 = cabeçalho, uma linha por registro.
 * A planilha fica só com o dono do script; o time acessa pelo app, nunca pela planilha.
 */

var ABAS = {
  Usuarios: ['email', 'nome', 'papel', 'segmentos', 'admin', 'liberado_por', 'liberado_em', 'confirmado_em'],
  // hotmart_id se chamava id_externo: planilhas antigas continuam valendo (veja APELIDOS_COLUNA).
  // etapa_origem / owner_origem: último valor que veio do Salesforce, para a importação não desfazer
  // o que foi mudado no app (só aplica quando o Salesforce muda).
  // Escrito por extenso (sem usar CAMPOS_INFO do Regras.gs): no carregamento, a ordem dos arquivos
  // não é garantida. O meio da lista são as colunas de CAMPOS_INFO (um teste confere).
  Clientes: ['hotmart_id', 'nome', 'segmento', 'responsavel_email', 'etapa', 'desde', 'link_analise',
    'closed_date', 'onboarding_health', 'health_reason', 'welcome_status', 'gmv_pos_fechamento',
    'valor_1_3_meses', 'valor_12_meses', 'plataforma_atual', 'taxa_atual', 'criado_por', 'hotmart_event',
    'inbound_campaign', 'lead_flow', 'estrategia',
    'etapa_origem', 'owner_origem', 'atualizado_em'],
  Historico: ['quando', 'hotmart_id', 'cliente', 'de', 'para', 'por', 'origem'],
  Orientacoes: ['id', 'titulo', 'descricao', 'escopo', 'segmento', 'cliente', 'etapa', 'ref_manual',
    'prioridade', 'origem', 'status', 'criado_por', 'criado_em', 'concluida_por', 'concluida_em'],
  Pedidos: ['id', 'email', 'tipo', 'papel', 'segmentos', 'nota', 'status', 'criado_em', 'decidido_por', 'decidido_em']
};

var PROP_PLANILHA = 'PLANILHA_ID';

/** Nomes antigos de coluna que continuam sendo lidos. */
var APELIDOS_COLUNA = { id_externo: 'hotmart_id' };

function nomeColuna_(c) {
  var n = normalizarTexto_(c);
  return APELIDOS_COLUNA[n] || n;
}

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
  var ss = planilha_();
  var sh = ss.getSheetByName(nome);
  if (!sh && ABAS[nome]) { prepararAbas_(ss); sh = ss.getSheetByName(nome); } // aba nova numa versão nova
  if (!sh) throw new Error('Aba "' + nome + '" não encontrada.');
  return sh;
}

/** Lê a aba como lista de objetos { coluna: valor, _linha: n }. Ignora linhas totalmente vazias. */
function lerTabela_(nome) {
  var valores = aba_(nome).getDataRange().getValues();
  if (valores.length < 2) return [];
  var cab = valores[0].map(nomeColuna_);
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

/**
 * Cabeçalho real da aba. Grava pelo nome da coluna, não pela posição: a exportação colada
 * pode vir em outra ordem, e planilhas antigas não têm as colunas novas (ex.: link_analise).
 * Coluna que falta é criada no fim.
 */
function cabecalho_(sh, nome) {
  var largura = sh.getLastColumn();
  var cab = largura ? sh.getRange(1, 1, 1, largura).getValues()[0].map(nomeColuna_) : [];
  var faltam = ABAS[nome].filter(function (c) { return cab.indexOf(c) < 0; });
  if (faltam.length) {
    sh.getRange(1, cab.length + 1, 1, faltam.length).setValues([faltam]).setFontWeight('bold');
    cab = cab.concat(faltam);
  }
  return cab;
}

function inserir_(nome, obj) {
  var sh = aba_(nome);
  sh.appendRow(cabecalho_(sh, nome).map(function (c) {
    return ABAS[nome].indexOf(c) >= 0 && obj[c] != null ? celulaSegura_(obj[c]) : '';
  }));
}

/** Várias linhas de uma vez (importação): uma escrita só, em vez de uma por linha. */
function inserirVarios_(nome, objs) {
  if (!objs.length) return;
  var sh = aba_(nome);
  var cab = cabecalho_(sh, nome);
  var linhas = objs.map(function (obj) {
    return cab.map(function (c) { return ABAS[nome].indexOf(c) >= 0 && obj[c] != null ? celulaSegura_(obj[c]) : ''; });
  });
  sh.getRange(sh.getLastRow() + 1, 1, linhas.length, cab.length).setValues(linhas);
}

/**
 * Várias atualizações de uma vez (importação): lê a aba, muda em memória e grava tudo numa
 * escrita só. Reaplica a proteção contra fórmula em todas as células, porque um texto salvo
 * como "'=..." volta da leitura sem o apóstrofo.
 * lista: [{ linha, mudancas: { coluna: valor } }]
 */
function atualizarVarios_(nome, lista) {
  if (!lista.length) return;
  var sh = aba_(nome);
  var cab = cabecalho_(sh, nome);
  var ultima = sh.getLastRow();
  var faixa = sh.getRange(2, 1, ultima - 1, cab.length);
  var dados = faixa.getValues();
  lista.forEach(function (it) {
    Object.keys(it.mudancas).forEach(function (col) {
      var j = cab.indexOf(col);
      if (j < 0 || ABAS[nome].indexOf(col) < 0) throw new Error('Coluna desconhecida: ' + col);
      dados[it.linha - 2][j] = it.mudancas[col];
    });
  });
  faixa.setValues(dados.map(function (linha) { return linha.map(celulaSegura_); }));
}

/** Atualiza só as colunas informadas da linha `linha`. */
function atualizar_(nome, linha, mudancas) {
  var sh = aba_(nome);
  var cab = cabecalho_(sh, nome);
  Object.keys(mudancas).forEach(function (col) {
    if (ABAS[nome].indexOf(col) < 0) throw new Error('Coluna desconhecida: ' + col);
    sh.getRange(linha, cab.indexOf(col) + 1).setValue(celulaSegura_(mudancas[col]));
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
 * Clientes da aba "Clientes" (colada da exportação ou importada pelo app).
 * - `problemas`: linhas que não dá para usar (sem nome, segmento/etapa/data inválidos).
 *   Não entram na tela.
 * - `avisos`: linhas usáveis mas que precisam de atenção (responsável que não está em
 *   Usuarios ou mudou de segmento). O cliente aparece para a liderança e o admin, que
 *   escolhem o responsável na tela Clientes.
 * - Cliente sem responsável é normal (acabou de chegar): vem com `semDono`, sem aviso.
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
    var segmento = lerSegmentoCliente_(r.segmento);
    var email = String(r.responsavel_email || '').trim().toLowerCase();
    var dono = porEmail[email];
    var etapa = lerEtapa_(r.etapa);
    var desde = lerData_(r.desde);
    if (!nome) erros.push('nome vazio');
    if (!segmento) erros.push('segmento "' + r.segmento + '" inválido');
    var aviso = '';
    if (email && !dono) {
      aviso = ('Linha ' + r._linha + ': ' + nome + ': o responsável ' + email + ' não está em Usuários. ' +
        'Cadastre a pessoa ou escolha outro responsável.');
    } else if (dono && segmento && (dono.papel !== 'onboarder' || dono.segmentos.indexOf(segmento) < 0)) {
      aviso = ('Linha ' + r._linha + ': ' + nome + ' é ' + segmento + ', mas ' + (dono.nome || email) +
        (dono.papel !== 'onboarder' ? ' não é onboarder' : ' agora é ' + dono.segmentos.join(' + ')) +
        '. Reatribua o responsável.');
    }
    if (!etapa) erros.push('etapa "' + r.etapa + '" não existe');
    if (!desde) erros.push('data "' + r.desde + '" inválida');
    if (erros.length) { problemas.push('Linha ' + r._linha + ': ' + erros.join('; ') + '.'); return; }
    if (aviso) avisos.push(aviso);
    var idExterno = String(r.hotmart_id || '').trim();
    var info = {};
    CAMPOS_INFO.forEach(function (c) {
      var v = r[c[1]];
      if (c[5] === 'data') info[c[0]] = v === '' || v == null ? '' : (lerData_(v) || '').slice(0, 10);
      else if (c[5] === 'numero') { var n = lerNumero_(v); info[c[0]] = n !== null ? n : String(v == null ? '' : v).trim(); }
      else info[c[0]] = String(v == null ? '' : v).trim();
    });
    clientes.push({
      linha: r._linha,
      id: idExterno || nome,
      idExterno: idExterno,
      nome: nome,
      segmento: segmento,
      responsavelEmail: email,
      etapa: etapa,
      desde: desde,
      linkAnalise: lerLinkAnalise_(r.link_analise) || '',
      semDono: !dono || dono.papel !== 'onboarder' || dono.segmentos.indexOf(segmento) < 0,
      info: info,
      etapaOrigem: lerEtapa_(r.etapa_origem) || '',
      ownerOrigem: String(r.owner_origem || '').trim(),
      atualizadoEm: iso_(r.atualizado_em)
    });
  });
  return { clientes: clientes, problemas: problemas, avisos: avisos, totalLinhas: linhas.length };
}

/** Histórico de etapas, mais recente primeiro. */
function lerHistorico_() {
  return lerTabela_('Historico').map(function (r) {
    return {
      quando: iso_(r.quando), hotmartId: String(r.hotmart_id || '').trim(), cliente: String(r.cliente || '').trim(),
      de: String(r.de || ''), para: String(r.para || ''), por: String(r.por || ''), origem: String(r.origem || '')
    };
  }).sort(function (a, b) { return a.quando < b.quando ? 1 : -1; });
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
