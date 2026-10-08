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
