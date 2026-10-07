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
