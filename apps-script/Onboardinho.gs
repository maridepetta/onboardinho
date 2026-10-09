/**
 * Onboardinho — código do servidor (arquivo único).
 * Gerado por scripts/montar-apps-script.js a partir de Regras.gs, Dados.gs e Code.gs.
 * No editor do Apps Script: cole TUDO isto no arquivo Código.gs e apague Dados.gs e Regras.gs.
 */

var VERSAO_ONBOARDINHO = '8c16dcf';

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
  'Faturamento',
  'Accomplished',
  'Unaccomplished'
];
/** Etapas em que o onboarding já acabou (não contam como "em andamento"). */
var ETAPAS_FINAIS = ['Accomplished', 'Unaccomplished'];
/** Outros nomes aceitos para uma etapa (ex.: como vem do Salesforce). */
var APELIDOS_ETAPA = { billing: 'Faturamento', faturando: 'Faturamento' };

/**
 * Informações extras do cliente (vêm do relatório do Salesforce).
 * [propriedade, coluna na aba Clientes, rótulo na tela, nomes de coluna aceitos na importação, grupo, tipo]
 * Os nomes aceitos estão "achatados": "Opportunity: Amount 1-3" → "opportunityamount13".
 */
var CAMPOS_INFO = [
  ['closedDate', 'closed_date', 'Fechamento (Closed Date)', ['closeddate', 'datadefechamento', 'fechamento'], 'negocio', 'data'],
  ['health', 'onboarding_health', 'Saúde do onboarding', ['onboardinghealth', 'health', 'saude'], 'saude', 'texto'],
  ['healthReason', 'health_reason', 'Motivo da saúde', ['onboardinghealthreason', 'healthreason', 'motivodasaude'], 'saude', 'texto'],
  ['welcomeStatus', 'welcome_status', 'Welcome status', ['welcomestatus', 'opportunitywelcomestatus'], 'saude', 'texto'],
  ['gmv', 'gmv_pos_fechamento', 'GMV após o fechamento (BRL)', ['gmvbrlafterclosedwon', 'gmvafterclosedwon', 'gmv', 'gmvbrl'], 'negocio', 'numero'],
  ['valor13', 'valor_1_3_meses', 'Previsto 1–3 meses', ['opportunityamount13', 'amount13'], 'negocio', 'numero'],
  ['valor12', 'valor_12_meses', 'Previsto 12 meses', ['opportunityamount12months', 'amount12months'], 'negocio', 'numero'],
  ['plataformaAtual', 'plataforma_atual', 'Plataforma atual', ['opportunitycurrentplatform', 'currentplatform', 'plataformaatual'], 'negocio', 'texto'],
  ['taxaAtual', 'taxa_atual', 'Taxa atual', ['currentfee', 'opportunitycurrentfee', 'taxaatual'], 'negocio', 'texto'],
  ['criadoPor', 'criado_por', 'Oportunidade criada por', ['opportunitycreatedby', 'createdby'], 'origem', 'texto'],
  ['hotmartEvent', 'hotmart_event', 'Evento Hotmart', ['opportunityhotmartevent', 'hotmartevent'], 'origem', 'texto'],
  ['inboundCampaign', 'inbound_campaign', 'Campanha inbound', ['opportunityinboundcampaign', 'inboundcampaign'], 'origem', 'texto'],
  ['leadFlow', 'lead_flow', 'Lead flow', ['opportunityleadflow', 'leadflow'], 'origem', 'texto'],
  ['estrategia', 'estrategia', 'Estratégia para atingir as metas', ['strategyforachievinggoals', 'estrategia'], 'estrategia', 'texto']
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

/** Texto só com letras e números, sem acento: "Nome do Cliente" → "nomedocliente". */
function chave_(valor) {
  return normalizarTexto_(valor).replace(/[^a-z0-9]/g, '');
}

/** Etapa tolerante: ignora maiúsculas, acentos, hífen e "&"/"and"/"e" ("Pré-onboarding", "activation and monitoring"). */
function lerEtapa_(valor) {
  function k(v) { return chave_(normalizarTexto_(v).replace(/&/g, ' ').replace(/\b(and|e)\b/g, ' ')); }
  var alvo = k(valor);
  if (!alvo) return null;
  if (APELIDOS_ETAPA[alvo]) return APELIDOS_ETAPA[alvo];
  for (var i = 0; i < ETAPAS.length; i++) if (k(ETAPAS[i]) === alvo) return ETAPAS[i];
  return null;
}

/**
 * Número de célula ou texto ("R$ 1.234,56", "1,234.56", "12000"). null se não for número.
 * Separador sozinho seguido de grupos de 3 dígitos ("1.234.567", "1,234") é milhar; senão é decimal.
 */
function lerNumero_(valor) {
  if (typeof valor === 'number') return isFinite(valor) ? valor : null;
  var v = String(valor == null ? '' : valor).replace(/R\$|BRL|\s/gi, '');
  if (!v || !/^-?[\d.,]+$/.test(v)) return null;
  var ponto = v.lastIndexOf('.');
  var virgula = v.lastIndexOf(',');
  if (ponto >= 0 && virgula >= 0) {
    v = ponto > virgula ? v.replace(/,/g, '') : v.replace(/\./g, '').replace(',', '.');
  } else if (virgula >= 0) {
    v = /^-?\d{1,3}(,\d{3})+$/.test(v) ? v.replace(/,/g, '') : v.replace(',', '.');
  } else if (ponto >= 0 && /^-?\d{1,3}(\.\d{3})+$/.test(v)) {
    v = v.replace(/\./g, '');
  }
  var n = Number(v);
  return isFinite(n) ? n : null;
}

/** Segmento de um cliente: "7D" ou o nível do cliente ("N4", "Nível 5", "N6+"). null se não der para saber. */
function lerSegmentoCliente_(valor) {
  var lista = lerSegmentos_(valor);
  if (lista.length === 1) return lista[0];
  if (lista.length > 1) return null;
  var m = normalizarTexto_(valor).match(/^(?:n|nivel)\s*(\d+)\s*\+?$/);
  if (!m) return null;
  var n = +m[1];
  return n >= 6 ? '8D' : n >= 4 ? '7D' : n >= 2 ? '6D' : null;
}

/** Data de célula (Date) ou texto dd/mm/aaaa | aaaa-mm-dd → ISO. null se inválida. */
function lerData_(valor) {
  if (valor instanceof Date) return isNaN(valor.getTime()) ? null : valor.toISOString();
  var v = String(valor == null ? '' : valor).trim();
  var br = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})(?:\s.*)?$/); // aceita "01/10/2026 00:00" e "01/10/26"
  var iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  var y, m, d;
  if (br) { d = +br[1]; m = +br[2]; y = br[3].length === 2 ? 2000 + +br[3] : +br[3]; }
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
function podeVerClientes_(u) { return !!u; }

/** Cadastrar cliente: admin (qualquer segmento) ou liderança (só nos seus segmentos). */
function podeCadastrarCliente_(u, segmento) {
  if (!u) return false;
  if (u.admin === true) return true;
  return u.papel === 'lideranca' && u.segmentos.indexOf(segmento) >= 0;
}

/**
 * Link da análise do cliente (NotebookLM, Docs, Drive, Gemini). Só https em domínio do
 * Google: o link vira um <a> na tela, e um "javascript:" ou um site qualquer ali seria
 * porta para golpe. '' = sem link; null = link recusado.
 */
function lerLinkAnalise_(valor) {
  var v = String(valor == null ? '' : valor).trim();
  if (!v) return '';
  if (v.length > 500) return null;
  return /^https:\/\/([a-z0-9-]+\.)*google\.com(\/[^\s]*)?$/i.test(v) ? v : null;
}

/** Mudar etapa e link da análise: o responsável pelo cliente, a liderança do segmento ou admin. */
function podeEditarCliente_(u, cliente) {
  if (!u || !cliente) return false;
  if (normalizarTexto_(cliente.responsavelEmail) === normalizarTexto_(u.email)) return true;
  return podeCadastrarCliente_(u, cliente.segmento);
}

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
  var versao = typeof VERSAO_ONBOARDINHO === 'undefined' ? '?' : VERSAO_ONBOARDINHO;
  var msg = 'Pronto. Versão ' + versao + ' · Planilha: ' + ss.getUrl() + ' · Admin: ' + Session.getEffectiveUser().getEmail();
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
  var pagina = HtmlService.createHtmlOutputFromFile('Index');
  // Index.html colado pela metade deixa a página em branco, sem erro nenhum. Avisa em vez disso.
  if (pagina.getContent().indexOf('FIM DO INDEX') < 0) {
    return HtmlService.createHtmlOutput(
      '<div style="max-width:640px;margin:48px auto;font:16px/1.5 system-ui,sans-serif;color:#201e1d">' +
      '<h1 style="font-size:24px">O arquivo Index.html está incompleto.</h1>' +
      '<p>Ele foi colado pela metade no editor do Apps Script. Cole de novo o Index.html inteiro, ' +
      'role até o fim e confira se as últimas linhas são <code>&lt;!-- FIM DO INDEX ... --&gt;</code>, ' +
      '<code>&lt;/body&gt;</code> e <code>&lt;/html&gt;</code>. Salve e recarregue esta página.</p></div>'
    ).setTitle('Onboardinho: instalação incompleta');
  }
  return pagina
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
  usuarios.forEach(function (u) {
    if (u.papel === 'onboarder' && u.segmentos.length === 1 && podeCadastrarCliente_(eu, u.segmentos[0])) precisa[u.email] = true;
  });
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
    clientes: clientes.map(function (c) {
      return Object.assign(semLinha_(c), { podeEditar: podeEditarCliente_(eu, c), podeAtribuir: podeCadastrarCliente_(eu, c.segmento) });
    }),
    // Segmentos em que a pessoa pode cadastrar/importar clientes.
    segmentosCadastro: ORDEM_SEGMENTOS.filter(function (sg) { return podeCadastrarCliente_(eu, sg); }),
    // Onboarders que podem ser responsáveis no formulário "Adicionar cliente".
    responsaveis: usuarios.filter(function (u) {
      return u.papel === 'onboarder' && u.segmentos.length === 1 && podeCadastrarCliente_(eu, u.segmentos[0]);
    }).map(function (u) { return { email: u.email, nome: u.nome || u.email, segmento: u.segmentos[0] }; }),
    totalLinhasClientes: eu.admin ? lidos.totalLinhas : 0,
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
    planilhaUrl: eu.admin ? urlPlanilha_() : '',
    sincronizacao: eu.admin ? estadoSincronizacao_() : null,
    versao: typeof VERSAO_ONBOARDINHO === 'undefined' ? '' : VERSAO_ONBOARDINHO,
    camposInfo: CAMPOS_INFO.map(function (c) { return { campo: c[0], rotulo: c[2], grupo: c[4], tipo: c[5] }; })
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

// ---------- Clientes ----------

/** dados: { idExterno?, nome, segmento, responsavelEmail? (vazio = sem responsável), etapa, desde (aaaa-mm-dd ou dd/mm/aaaa) } */
function apiAdicionarCliente(dados) {
  return comTrava_(function () {
    var usuarios = lerUsuarios_();
    var eu = exigirUsuario_(usuarios);
    dados = dados || {};
    var nome = String(dados.nome || '').trim().slice(0, 140);
    var idExterno = String(dados.idExterno || '').trim().slice(0, 60);
    var segmento = lerSegmentos_([dados.segmento || ''])[0];
    var email = String(dados.responsavelEmail || '').trim().toLowerCase();
    var etapa = lerEtapa_(dados.etapa);
    var desde = lerData_(dados.desde);
    if (!nome) throw new Error('Informe o nome do cliente.');
    if (!segmento) throw new Error('Escolha o segmento.');
    if (!podeCadastrarCliente_(eu, segmento)) throw new Error('Você não pode cadastrar clientes em ' + segmento + '.');
    if (email && !ehOnboarderDe_(usuarios, email, segmento)) {
      throw new Error('Escolha um onboarder do segmento ' + segmento + ' como responsável (ou deixe sem responsável).');
    }
    if (!etapa) throw new Error('Escolha a etapa.');
    if (!desde) throw new Error('Data inválida.');
    if (desde.slice(0, 10) > hoje_()) throw new Error('A data não pode ser no futuro.');
    var existentes = lerClientes_(usuarios).clientes;
    var repetido = existentes.some(function (c) {
      return idExterno ? c.idExterno === idExterno : (!c.idExterno && normalizarTexto_(c.nome) === normalizarTexto_(nome) && c.segmento === segmento);
    });
    if (repetido) throw new Error('Esse cliente já está cadastrado.');
    inserir_('Clientes', {
      hotmart_id: idExterno, nome: nome, segmento: segmento, responsavel_email: email,
      etapa: etapa, desde: desde.slice(0, 10), atualizado_em: new Date().toISOString()
    });
    registrarHistorico_([{ hotmartId: idExterno, cliente: nome, de: '', para: etapa }], eu.email, 'app');
    return apiEstado();
  });
}

function ehOnboarderDe_(usuarios, email, segmento) {
  return usuarios.some(function (u) { return u.email === email && u.papel === 'onboarder' && u.segmentos.indexOf(segmento) >= 0; });
}

/** Troca (ou tira, com email vazio) o responsável. Só liderança do segmento ou admin. */
function apiMudarResponsavel(idCliente, emailNovo) {
  return comTrava_(function () {
    var usuarios = lerUsuarios_();
    var eu = exigirUsuario_(usuarios);
    var cliente = lerClientes_(usuarios).clientes.filter(function (c) { return c.id === String(idCliente); })[0];
    if (!cliente) throw new Error('Cliente não encontrado.');
    if (!podeCadastrarCliente_(eu, cliente.segmento)) throw new Error('Só a liderança do segmento ou o admin escolhem o responsável.');
    var email = String(emailNovo || '').trim().toLowerCase();
    if (email && !ehOnboarderDe_(usuarios, email, cliente.segmento)) {
      throw new Error('O responsável precisa ser onboarder do segmento ' + cliente.segmento + '.');
    }
    atualizar_('Clientes', cliente.linha, { responsavel_email: email });
    return apiEstado();
  });
}

/** Muda a etapa do cliente e marca "desde" como hoje. */
function apiMudarEtapa(idCliente, etapaNova) {
  return comTrava_(function () {
    var usuarios = lerUsuarios_();
    var eu = exigirUsuario_(usuarios);
    var etapa = lerEtapa_(etapaNova);
    if (!etapa) throw new Error('Etapa inválida.');
    var cliente = lerClientes_(usuarios).clientes.filter(function (c) { return c.id === String(idCliente); })[0];
    if (!cliente) throw new Error('Cliente não encontrado.');
    if (!podeEditarCliente_(eu, cliente)) throw new Error('Você não pode mudar este cliente.');
    if (cliente.etapa === etapa) return apiEstado();
    atualizar_('Clientes', cliente.linha, { etapa: etapa, desde: hoje_(), atualizado_em: new Date().toISOString() });
    registrarHistorico_([{ hotmartId: cliente.idExterno, cliente: cliente.nome, de: cliente.etapa, para: etapa }], eu.email, 'app');
    return apiEstado();
  });
}

/** Guarda (ou apaga, com link vazio) o link da análise do cliente: notebook do NotebookLM, Doc etc. */
function apiDefinirLinkAnalise(idCliente, link) {
  return comTrava_(function () {
    var usuarios = lerUsuarios_();
    var eu = exigirUsuario_(usuarios);
    var valor = lerLinkAnalise_(link);
    if (valor === null) throw new Error('Use um link https do Google (NotebookLM, Docs, Drive ou Gemini).');
    var cliente = lerClientes_(usuarios).clientes.filter(function (c) { return c.id === String(idCliente); })[0];
    if (!cliente) throw new Error('Cliente não encontrado.');
    if (!podeEditarCliente_(eu, cliente)) throw new Error('Você não pode mudar este cliente.');
    atualizar_('Clientes', cliente.linha, { link_analise: valor });
    return apiEstado();
  });
}

/** Grava mudanças de etapa na aba Historico (base da linha do tempo do cliente). */
function registrarHistorico_(itens, por, origem) {
  var agora = new Date().toISOString();
  inserirVarios_('Historico', itens.map(function (h) {
    return { quando: agora, hotmart_id: h.hotmartId, cliente: h.cliente, de: h.de, para: h.para, por: por, origem: origem };
  }));
}

/** Página do cliente: dados extras que não vão no estado geral (histórico de etapas). */
function apiCliente(idCliente) {
  var usuarios = lerUsuarios_();
  var eu = exigirUsuario_(usuarios);
  var cliente = clientesVisiveis_(eu, lerClientes_(usuarios).clientes).filter(function (c) { return c.id === String(idCliente); })[0];
  if (!cliente) throw new Error('Cliente não encontrado.');
  var historico = lerHistorico_().filter(function (h) {
    return cliente.idExterno ? h.hotmartId === cliente.idExterno : (!h.hotmartId && h.cliente === cliente.nome);
  });
  var nomes = {};
  usuarios.forEach(function (u) { nomes[u.email] = u.nome || u.email; });
  return {
    historico: historico.slice(0, 100).map(function (h) { return Object.assign({}, h, { porNome: nomes[h.por] || h.por }); })
  };
}

// ---------- Importar clientes (colar da planilha ou relatório do Salesforce) ----------

var MAX_LINHAS_IMPORTACAO = 3000;
var ABA_SINCRONIZACAO = 'Salesforce';
var PROP_OPCOES_IMPORTACAO = 'OPCOES_IMPORTACAO';
var PROP_ULTIMA_SINCRONIZACAO = 'ULTIMA_SINCRONIZACAO';
var PROP_SINCRONIZACAO_ATIVA = 'SINCRONIZACAO_ATIVA';

/**
 * Quais colunas viram o quê. [campo, nomes exatos (achatados), pedaços para "contém"]
 * É função (e não uma lista pronta) porque usa CAMPOS_INFO, do Regras.gs: o Apps Script carrega
 * os arquivos na ordem em que foram criados, e no carregamento o Regras.gs pode ainda não existir.
 * Primeiro tenta o nome exato em todos os campos; depois "contém" (ex.: "E-mail do responsável").
 * A ordem importa: "Data da etapa" é data, não etapa.
 */
function colunasImportacao_() {
  return [
  ['responsavel', ['responsavel', 'responsavelemail', 'emailresponsavel', 'emaildoresponsavel', 'onboarder', 'owner', 'ownername', 'opportunityownername', 'csm', 'analista', 'email', 'dono'], ['responsavel', 'onboarder']],
  ['idExterno', ['hotmartid', 'idhotmart', 'hotmart', 'idexterno', 'id', 'codigo', 'cod', 'idcliente', 'iddocliente', 'codigocliente', 'codigodocliente'], ['hotmartid', 'codigo']],
  ['segmento', ['segmento', 'seg', 'segmentacao', 'nivel', 'tier', 'faixa'], ['segment', 'nivel']],
  ['desde', ['desde', 'data', 'datainicio', 'datadeinicio', 'inicio', 'dataetapa', 'dataentrada', 'entrada', 'desdequando'], ['data']],
  ['etapa', ['etapa', 'fase', 'status', 'stage', 'etapaatual', 'faseatual', 'onboardingstatus'], ['etapa', 'fase']],
  ['linkAnalise', ['link', 'linkanalise', 'linkdaanalise', 'analise', 'notebook'], ['link']],
  ['nome', ['nome', 'name', 'cliente', 'nomecliente', 'nomedocliente', 'empresa', 'razaosocial', 'conta', 'account', 'accountname', 'opportunityname', 'nomefantasia', 'nomedaempresa'], ['cliente', 'empresa', 'nome']]
  ].concat(CAMPOS_INFO.map(function (c) { return [c[0], c[3], []]; }));
}

function rotulosImportacao_() {
  var r = {
    nome: 'Nome', idExterno: 'Hotmart ID', segmento: 'Segmento', responsavel: 'Responsável',
    etapa: 'Etapa', desde: 'Na etapa desde', linkAnalise: 'Link da análise'
  };
  CAMPOS_INFO.forEach(function (c) { r[c[0]] = c[2]; });
  return r;
}

/** Texto colado (do Sheets/Excel: separado por tab; CSV: vírgula ou ponto e vírgula) → linhas. */
function lerTextoColado_(texto) {
  var t = String(texto || '').replace(/\r\n?/g, '\n');
  var primeira = t.split('\n')[0];
  var sep = primeira.indexOf('\t') >= 0 ? '\t' : (primeira.split(';').length > primeira.split(',').length ? ';' : ',');
  var linhas = [];
  var linha = [];
  var cel = '';
  var aspas = false;
  for (var i = 0; i < t.length; i++) {
    var ch = t.charAt(i);
    if (aspas) {
      if (ch === '"' && t.charAt(i + 1) === '"') { cel += '"'; i++; }
      else if (ch === '"') aspas = false;
      else cel += ch;
    } else if (ch === '"' && cel === '') aspas = true;
    else if (ch === sep) { linha.push(cel); cel = ''; }
    else if (ch === '\n') { linha.push(cel); linhas.push(linha); linha = []; cel = ''; }
    else cel += ch;
  }
  if (cel !== '' || linha.length) { linha.push(cel); linhas.push(linha); }
  return linhas.map(function (l) { return l.map(function (c) { return c.trim(); }); });
}

/** Cabeçalho → { campo: índice da coluna }. */
function mapearColunas_(cabecalho) {
  var mapa = {};
  var usadas = {};
  var chaves = cabecalho.map(chave_);
  [1, 2].forEach(function (passo) {
    colunasImportacao_().forEach(function (def) {
      if (mapa[def[0]] !== undefined) return;
      for (var j = 0; j < chaves.length; j++) {
        if (usadas[j] || !chaves[j]) continue;
        var bate = passo === 1
          ? def[1].indexOf(chaves[j]) >= 0
          : def[2].some(function (pedaco) { return chaves[j].indexOf(pedaco) >= 0; });
        if (bate) { mapa[def[0]] = j; usadas[j] = true; return; }
      }
    });
  });
  return mapa;
}

/** Valor de um campo extra como vai para a planilha (data aaaa-mm-dd, número, texto). */
function valorInfo_(def, bruto) {
  if (bruto === '' || bruto == null) return '';
  if (def[5] === 'data') return (lerData_(bruto) || '').slice(0, 10) || String(bruto).trim();
  if (def[5] === 'numero') { var n = lerNumero_(bruto); return n !== null ? n : String(bruto).trim(); }
  return String(bruto).trim().slice(0, 5000);
}

/**
 * Analisa as linhas (cabeçalho + clientes) sem gravar nada. Cada linha sai com uma ação:
 * novo | atualiza | igual (nada mudou) | repetido (aparece duas vezes na colagem) | erro.
 * Cliente que já existe (mesmo Hotmart ID; sem ID, mesmo nome) é ATUALIZADO, não duplicado.
 * Etapa e responsável só são trocados quando o valor de origem mudou desde a última importação:
 * assim, o que o time muda no app não é desfeito pela próxima colagem igual.
 * opcoes: { etapaPadrao, segmentoPadrao, mapas: { etapa: {texto: etapa}, segmento: {texto: seg} } }
 */
function analisarImportacao_(eu, usuarios, existentes, linhas, opcoes) {
  opcoes = opcoes || {};
  var mapas = opcoes.mapas || {};
  var mapaEtapa = mapas.etapa || {};
  var mapaSeg = mapas.segmento || {};
  linhas = linhas.filter(function (l) { return l.some(function (c) { return c !== '' && c != null; }); });
  if (linhas.length < 2) throw new Error('Cole o cabeçalho e pelo menos uma linha de cliente.');
  if (linhas.length - 1 > MAX_LINHAS_IMPORTACAO) throw new Error('No máximo ' + MAX_LINHAS_IMPORTACAO + ' clientes por vez.');
  var cab = linhas[0].map(function (h) { return String(h == null ? '' : h).trim(); });
  var col = mapearColunas_(cab);
  var rotulos = rotulosImportacao_();
  if (col.nome === undefined && col.idExterno === undefined) {
    throw new Error('Não achei a coluna com o nome do cliente. A primeira linha precisa ser o cabeçalho ' +
      '(ex.: "Name", "Cliente" ou "Empresa").');
  }
  var etapaPadrao = lerEtapa_(opcoes.etapaPadrao) || ETAPAS[0];
  var segPadrao = lerSegmentos_([opcoes.segmentoPadrao || ''])[0] || '';
  var hoje = hoje_();
  var porEmail = {};
  var porNome = {};
  usuarios.forEach(function (u) {
    porEmail[u.email] = u;
    var k = chave_(u.nome);
    if (k) porNome[k] = porNome[k] === undefined ? u : null; // null = nome repetido, não dá para saber quem é
  });
  var porId = {};
  var porNomeCliente = {};
  existentes.forEach(function (c) {
    if (c.idExterno) porId[c.idExterno] = c;
    else { var k = chave_(c.nome); porNomeCliente[k] = porNomeCliente[k] === undefined ? c : null; }
  });
  var vistos = {};
  var desconhecidos = { etapa: {}, segmento: {} };

  function bruto(l, campo) { return col[campo] === undefined ? '' : l[col[campo]]; }
  function texto(l, campo) { var v = bruto(l, campo); return v == null ? '' : String(v).trim(); }
  function temColuna(campo) { return col[campo] !== undefined; }

  var saida = linhas.slice(1).map(function (l, i) {
    var erros = [];
    var avisos = [];
    var mudancas = [];
    var nome = texto(l, 'nome').slice(0, 140);
    var idExterno = texto(l, 'idExterno').slice(0, 60);
    var existente = idExterno ? porId[idExterno] : (nome ? porNomeCliente[chave_(nome)] : null);
    if (!nome && !existente) erros.push('sem nome');

    // Responsável: e-mail ou nome de alguém em Usuários.
    var respTexto = texto(l, 'responsavel');
    var dono = null;
    if (respTexto) dono = respTexto.indexOf('@') >= 0 ? porEmail[respTexto.toLowerCase()] : porNome[chave_(respTexto)];

    // Segmento: da coluna, senão (cliente novo) do responsável ou o padrão escolhido.
    var segTexto = texto(l, 'segmento');
    var segmento = null;
    if (segTexto) {
      segmento = lerSegmentoCliente_(segTexto) || lerSegmentos_([mapaSeg[segTexto] || ''])[0] || null;
      if (!segmento) { desconhecidos.segmento[segTexto] = true; erros.push('segmento "' + segTexto + '" não reconhecido'); }
    } else if (existente) segmento = existente.segmento;
    else if (dono && dono.papel === 'onboarder' && dono.segmentos.length === 1) segmento = dono.segmentos[0];
    else if (segPadrao) segmento = segPadrao;
    else erros.push('sem segmento' + (respTexto ? ' ("' + respTexto + '" não é onboarder em Usuários)' : ''));
    if (segmento && !podeCadastrarCliente_(eu, segmento)) erros.push(segmento + ' não é um segmento seu');
    if (existente && !podeCadastrarCliente_(eu, existente.segmento)) erros.push(existente.segmento + ' não é um segmento seu');

    // Etapa da origem (tolerante) ou a padrão (só para cliente novo).
    var etapaTexto = texto(l, 'etapa');
    var etapaIn = etapaTexto ? (lerEtapa_(etapaTexto) || lerEtapa_(mapaEtapa[etapaTexto])) : null;
    if (etapaTexto && !etapaIn) { desconhecidos.etapa[etapaTexto] = true; erros.push('etapa "' + etapaTexto + '" não existe'); }

    var desdeBruto = bruto(l, 'desde');
    var desdeIn = desdeBruto !== '' && desdeBruto != null ? lerData_(desdeBruto) : null;
    if (desdeBruto !== '' && desdeBruto != null && !desdeIn) erros.push('data "' + desdeBruto + '" inválida');
    else if (desdeIn && desdeIn.slice(0, 10) > hoje) erros.push('data no futuro');

    var link = lerLinkAnalise_(texto(l, 'linkAnalise'));
    if (link === null) { avisos.push('link ignorado (só links do Google)'); link = ''; }

    var gravar = {};       // colunas a gravar
    var silencioso = {};   // controle interno, não conta como mudança
    var historico = null;
    var etapaFinal = etapaIn;
    var emailFinal = '';

    if (!existente) {
      etapaFinal = etapaIn || etapaPadrao;
      if (respTexto && !dono) {
        if (respTexto.indexOf('@') >= 0) { emailFinal = respTexto.toLowerCase(); avisos.push(emailFinal + ' não está em Usuários: entra sem responsável até você cadastrar a pessoa'); }
        else avisos.push('"' + respTexto + '" não está em Usuários: entra sem responsável');
      } else if (dono && segmento && (dono.papel !== 'onboarder' || dono.segmentos.indexOf(segmento) < 0)) {
        avisos.push((dono.nome || dono.email) + ' não é onboarder ' + segmento + ': entra sem responsável');
      } else if (dono) emailFinal = dono.email;
      if (!respTexto) avisos.push('sem responsável: escolha depois na tabela');
      gravar = {
        hotmart_id: idExterno, nome: nome, segmento: segmento || '', responsavel_email: emailFinal,
        etapa: etapaFinal, desde: (desdeIn || hoje).slice(0, 10), link_analise: link || '',
        etapa_origem: etapaIn || '', owner_origem: respTexto, atualizado_em: new Date().toISOString()
      };
      CAMPOS_INFO.forEach(function (d) { if (temColuna(d[0])) gravar[d[1]] = valorInfo_(d, bruto(l, d[0])); });
      historico = { de: '', para: etapaFinal };
    } else {
      emailFinal = existente.responsavelEmail;
      etapaFinal = existente.etapa;
      if (nome && nome !== existente.nome) { gravar.nome = nome; mudancas.push('nome'); }
      if (segmento && segmento !== existente.segmento) { gravar.segmento = segmento; mudancas.push('segmento ' + existente.segmento + ' → ' + segmento); }
      // Etapa: só quando a origem mudou desde a última importação.
      if (etapaIn && etapaIn !== existente.etapaOrigem) {
        silencioso.etapa_origem = etapaIn;
        if (etapaIn !== existente.etapa) {
          gravar.etapa = etapaIn;
          gravar.desde = (desdeIn || hoje).slice(0, 10);
          mudancas.push(existente.etapa + ' → ' + etapaIn);
          historico = { de: existente.etapa, para: etapaIn };
          etapaFinal = etapaIn;
        }
      }
      // Responsável: idem.
      if (temColuna('responsavel') && respTexto !== existente.ownerOrigem) {
        silencioso.owner_origem = respTexto;
        var segFinal = segmento || existente.segmento;
        if (dono && dono.papel === 'onboarder' && dono.segmentos.indexOf(segFinal) >= 0) {
          if (dono.email !== existente.responsavelEmail) { gravar.responsavel_email = dono.email; mudancas.push('responsável → ' + (dono.nome || dono.email)); emailFinal = dono.email; }
        } else if (respTexto) avisos.push('"' + respTexto + '" não é onboarder ' + segFinal + ' em Usuários: responsável mantido');
      }
      if (link && link !== existente.linkAnalise) { gravar.link_analise = link; mudancas.push('link'); }
      var infoMudou = [];
      CAMPOS_INFO.forEach(function (d) {
        if (!temColuna(d[0])) return;
        var v = valorInfo_(d, bruto(l, d[0]));
        if (String(v) !== String(existente.info[d[0]] == null ? '' : existente.info[d[0]])) { gravar[d[1]] = v; infoMudou.push(d[2]); }
      });
      if (infoMudou.length) mudancas.push(infoMudou.length === 1 ? infoMudou[0] : infoMudou.length + ' campos (' + infoMudou.slice(0, 3).join(', ') + (infoMudou.length > 3 ? '…' : '') + ')');
      if (mudancas.length) gravar.atualizado_em = new Date().toISOString();
    }

    var acao = erros.length ? 'erro' : existente ? (mudancas.length ? 'atualiza' : 'igual') : 'novo';
    if (!erros.length) {
      var chave = idExterno ? 'id:' + idExterno : 'nome:' + chave_(nome || existente.nome);
      if (vistos[chave]) { acao = 'repetido'; erros = ['aparece de novo na colagem (linha ' + vistos[chave] + ')']; avisos = []; }
      else vistos[chave] = i + 2;
    }
    return {
      linha: i + 2, acao: acao, motivo: erros.concat(avisos).join('; '), comAviso: !erros.length && avisos.length > 0,
      mudancas: mudancas.join(' · '),
      nome: nome || (existente ? existente.nome : ''), idExterno: idExterno || (existente ? existente.idExterno : ''),
      segmento: segmento || segTexto, responsavelTexto: respTexto, etapa: etapaFinal || etapaTexto,
      desde: gravar.desde || (existente ? existente.desde.slice(0, 10) : ''),
      _linhaPlanilha: existente ? existente.linha : 0,
      _gravar: Object.assign(gravar, silencioso), _historico: historico
    };
  });

  var contagem = { novo: 0, atualiza: 0, igual: 0, repetido: 0, erro: 0, comAviso: 0 };
  saida.forEach(function (r) { contagem[r.acao] += 1; if (r.comAviso) contagem.comAviso += 1; });
  return {
    colunas: cab.map(function (h, j) {
      var campo = Object.keys(col).filter(function (k) { return col[k] === j; })[0];
      return { cabecalho: h, campo: campo ? rotulos[campo] : '' };
    }),
    faltando: ['nome', 'idExterno', 'segmento', 'responsavel', 'etapa'].filter(function (k) { return col[k] === undefined; })
      .map(function (k) { return rotulos[k]; }),
    linhas: saida,
    contagem: contagem,
    desconhecidos: { etapa: Object.keys(desconhecidos.etapa), segmento: Object.keys(desconhecidos.segmento) }
  };
}

/** Grava o resultado de uma análise: novos de uma vez, atualizações de uma vez, histórico. */
function aplicarImportacao_(r, por, origem) {
  var novos = r.linhas.filter(function (l) { return l.acao === 'novo'; });
  var mudar = r.linhas.filter(function (l) {
    return (l.acao === 'atualiza' || l.acao === 'igual') && Object.keys(l._gravar).length;
  });
  inserirVarios_('Clientes', novos.map(function (l) { return l._gravar; }));
  atualizarVarios_('Clientes', mudar.map(function (l) { return { linha: l._linhaPlanilha, mudancas: l._gravar }; }));
  var hist = r.linhas.filter(function (l) { return (l.acao === 'novo' || l.acao === 'atualiza') && l._historico; })
    .map(function (l) { return { hotmartId: l.idExterno, cliente: l.nome, de: l._historico.de, para: l._historico.para }; });
  if (hist.length) registrarHistorico_(hist, por, origem);
  return { novos: novos.length, atualizados: r.contagem.atualiza, deFora: r.contagem.erro + r.contagem.repetido };
}

function semInterno_(r) {
  return Object.assign({}, r, {
    linhas: r.linhas.map(function (l) {
      var c = Object.assign({}, l);
      delete c._gravar; delete c._historico; delete c._linhaPlanilha;
      return c;
    })
  });
}

function exigirImportador_(eu) {
  if (!ORDEM_SEGMENTOS.some(function (sg) { return podeCadastrarCliente_(eu, sg); })) throw new Error('Você não pode importar clientes.');
}

/** Prévia: não grava nada. */
function apiPreverImportacao(texto, opcoes) {
  var usuarios = lerUsuarios_();
  var eu = exigirUsuario_(usuarios);
  exigirImportador_(eu);
  return semInterno_(analisarImportacao_(eu, usuarios, lerClientes_(usuarios).clientes, lerTextoColado_(texto), opcoes));
}

/** Grava. Analisa de novo aqui: nunca confia na prévia que a tela mandou. */
function apiImportarClientes(texto, opcoes) {
  return comTrava_(function () {
    var usuarios = lerUsuarios_();
    var eu = exigirUsuario_(usuarios);
    exigirImportador_(eu);
    var r = analisarImportacao_(eu, usuarios, lerClientes_(usuarios).clientes, lerTextoColado_(texto), opcoes);
    if (!r.contagem.novo && !r.contagem.atualiza) throw new Error('Nada para importar: nenhum cliente novo nem mudança. Veja os motivos na prévia.');
    var feito = aplicarImportacao_(r, eu.email, 'importação');
    // A sincronização automática usa as mesmas "traduções" (etapas/segmentos) da última importação do admin.
    if (eu.admin) PropertiesService.getScriptProperties().setProperty(PROP_OPCOES_IMPORTACAO, JSON.stringify(opcoes || {}));
    var estado = apiEstado();
    estado.importacao = feito;
    return estado;
  });
}

// ---------- Sincronização automática (aba "Salesforce") ----------

/**
 * Lê a aba "Salesforce" desta planilha (preenchida pelo conector do Salesforce para Sheets,
 * ou colada à mão) e atualiza os clientes. Roda sozinha de hora em hora depois de
 * ativarSincronizacao(); também pelo botão "Sincronizar agora" (admin).
 */
function sincronizar() {
  return comTrava_(function () {
    var props = PropertiesService.getScriptProperties();
    var sh = planilha_().getSheetByName(ABA_SINCRONIZACAO);
    var resultado;
    if (!sh || sh.getLastRow() < 2) {
      resultado = { quando: new Date().toISOString(), erro: 'A aba "' + ABA_SINCRONIZACAO + '" não existe ou está vazia.' };
    } else {
      try {
        var usuarios = lerUsuarios_();
        var sistema = { email: 'sincronização', nome: 'Sincronização', papel: 'lideranca', segmentos: ORDEM_SEGMENTOS.slice(), admin: true };
        var opcoes = JSON.parse(props.getProperty(PROP_OPCOES_IMPORTACAO) || '{}');
        var r = analisarImportacao_(sistema, usuarios, lerClientes_(usuarios).clientes, sh.getDataRange().getValues(), opcoes);
        var feito = aplicarImportacao_(r, 'sincronização', 'salesforce');
        resultado = {
          quando: new Date().toISOString(), novos: feito.novos, atualizados: feito.atualizados, erros: r.contagem.erro,
          problemas: r.linhas.filter(function (l) { return l.acao === 'erro'; }).slice(0, 20)
            .map(function (l) { return 'Linha ' + l.linha + ' (' + (l.nome || l.idExterno || '?') + '): ' + l.motivo; })
        };
      } catch (e) {
        resultado = { quando: new Date().toISOString(), erro: e.message };
      }
    }
    props.setProperty(PROP_ULTIMA_SINCRONIZACAO, JSON.stringify(resultado));
    return resultado;
  });
}

/** Rode UMA vez pelo editor (Executar → ativarSincronizacao). Pede a autorização de gatilhos. */
function ativarSincronizacao() {
  desativarSincronizacao();
  ScriptApp.newTrigger('sincronizar').timeBased().everyHours(1).create();
  PropertiesService.getScriptProperties().setProperty(PROP_SINCRONIZACAO_ATIVA, 'sim');
  var r = sincronizar();
  Logger.log('Sincronização ativada (a cada hora). Primeira rodada: ' + JSON.stringify(r));
  return r;
}

function desativarSincronizacao() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sincronizar') ScriptApp.deleteTrigger(t);
  });
  PropertiesService.getScriptProperties().deleteProperty(PROP_SINCRONIZACAO_ATIVA);
}

function apiSincronizarAgora() {
  var eu = exigirUsuario_();
  if (!eu.admin) throw new Error('Só o admin sincroniza.');
  sincronizar();
  return apiEstado();
}

/** Situação da sincronização para a tela do admin. */
function estadoSincronizacao_() {
  var props = PropertiesService.getScriptProperties();
  var aba = planilha_().getSheetByName(ABA_SINCRONIZACAO);
  return {
    aba: ABA_SINCRONIZACAO,
    abaExiste: !!aba,
    ativa: props.getProperty(PROP_SINCRONIZACAO_ATIVA) === 'sim',
    ultima: JSON.parse(props.getProperty(PROP_ULTIMA_SINCRONIZACAO) || 'null')
  };
}
