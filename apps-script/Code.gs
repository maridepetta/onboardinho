/**
 * Onboardinho — Google Apps Script.
 *
 * Instalação: veja apps-script/README.md.
 * Toda função "api*" é chamada pela tela (google.script.run). Cada uma:
 *  1. descobre quem é a pessoa pela conta Google (nunca pelo que a tela manda);
 *  2. checa a permissão aqui no servidor;
 *  3. devolve o "estado" já filtrado para essa pessoa.
 */

function doGet(e) {
  if (e && e.parameter && e.parameter.diagnostico !== undefined) return paginaDiagnostico_();
  var pagina = HtmlService.createHtmlOutputFromFile('Index');
  // Index.html colado pela metade deixa a página em branco, sem erro nenhum. Avisa em vez disso.
  if (!indexCompleto_(pagina.getContent())) {
    return HtmlService.createHtmlOutput(
      '<div style="max-width:640px;margin:48px auto;font:16px/1.5 system-ui,sans-serif;color:#201e1d">' +
      '<h1 style="font-size:24px">O arquivo Index.html está incompleto.</h1>' +
      '<p>Ele foi colado pela metade no editor do Apps Script. Cole de novo o Index.html inteiro, ' +
      'role até o fim e confira se a última linha é <code>&lt;/html&gt;</code>. Salve e recarregue esta página.</p></div>'
    ).setTitle('Onboardinho: instalação incompleta');
  }
  return pagina
    .setTitle('Onboardinho')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function indexCompleto_(conteudo) {
  return /<\/html>\s*$/i.test(conteudo);
}

function escaparHtml_(t) {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Link do app com ?diagnostico no fim: mostra o que está instalado (versão, se o Index.html está
 * inteiro) e se o servidor responde. Sem JavaScript, para funcionar mesmo quando a tela fica em branco.
 * Detalhes só para o admin.
 */
function paginaDiagnostico_() {
  var linhas = [];
  function item(rotulo, valor, ok) {
    linhas.push('<tr><th style="text-align:left;padding:6px 16px 6px 0;vertical-align:top">' + escaparHtml_(rotulo) +
      '</th><td style="padding:6px 0">' + (ok === false ? '❌ ' : ok === true ? '✅ ' : '') + escaparHtml_(valor) + '</td></tr>');
  }
  var eu = null;
  try { eu = usuarioAtual_(); } catch (err) { item('Usuários', 'erro ao ler: ' + err.message, false); }
  item('Sua conta', emailAtual_() || '(não identificada)', !!emailAtual_());
  if (!eu || !eu.admin) {
    item('Acesso', 'o diagnóstico completo é só para o admin', eu ? null : false);
  } else {
    item('Versão do código', typeof VERSAO_ONBOARDINHO === 'undefined' ? 'arquivos separados (sem versão)' : VERSAO_ONBOARDINHO);
    try {
      var index = HtmlService.createHtmlOutputFromFile('Index').getContent();
      item('Index.html', index.split('\n').length + ' linhas, ' + index.length + ' caracteres', null);
      item('Index.html termina em </html>', indexCompleto_(index) ? 'sim' : 'NÃO: foi colado pela metade', indexCompleto_(index));
      item('Index.html é a versão nova', index.indexOf('FIM DO INDEX') >= 0 ? 'sim' : 'não (é uma versão anterior)', null);
      item('Final do Index.html', '…' + index.slice(-120), null);
    } catch (err) { item('Index.html', 'erro: ' + err.message, false); }
    try {
      var estado = apiEstado();
      item('Servidor (apiEstado)', 'responde: tela "' + estado.tela + '", ' + (estado.clientes ? estado.clientes.length : 0) + ' clientes', true);
    } catch (err) { item('Servidor (apiEstado)', 'ERRO: ' + err.message + (err.stack ? '\n' + err.stack : ''), false); }
  }
  return HtmlService.createHtmlOutput(
    '<div style="max-width:760px;margin:40px auto;font:15px/1.5 system-ui,sans-serif;color:#201e1d">' +
    '<h1 style="font-size:24px">Onboardinho: diagnóstico</h1>' +
    '<table style="border-collapse:collapse;white-space:pre-wrap">' + linhas.join('') + '</table>' +
    '<p style="color:#605d5d">Tire um print desta página e mande para quem cuida do app.</p></div>'
  ).setTitle('Onboardinho: diagnóstico');
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

/**
 * Admin edita nome, papel, segmentação e admin de alguém. E-mail não muda (é a identidade:
 * para trocar, remova e cadastre de novo). Se papel ou segmentação mudam, a pessoa confirma
 * o novo perfil no próximo acesso, como no primeiro.
 * dados: { nome, papel, segmentos, admin }
 */
function apiEditarUsuario(email, dados) {
  return comTrava_(function () {
    var usuarios = lerUsuarios_();
    var eu = exigirUsuario_(usuarios);
    if (!podeGerenciarUsuarios_(eu)) throw new Error('Só admin edita usuários.');
    var alvo = usuarios.filter(function (u) { return u.email === String(email || '').trim().toLowerCase(); })[0];
    if (!alvo) throw new Error('Usuário não encontrado.');
    dados = dados || {};
    var nome = String(dados.nome || '').trim();
    var segmentos = lerSegmentos_(dados.segmentos || []);
    var admin = dados.admin === true;
    if (!nome) throw new Error('Informe o nome.');
    var erro = validarLiberacao_(dados.papel, segmentos);
    if (erro) throw new Error(erro);
    if (alvo.email === eu.email && !admin) throw new Error('Você não pode tirar o seu próprio acesso de admin.');
    var mudancas = { nome: nome, admin: admin };
    var perfilMudou = dados.papel !== alvo.papel || segmentos.join(',') !== alvo.segmentos.join(',');
    if (perfilMudou) {
      mudancas.papel = dados.papel;
      mudancas.segmentos = segmentos.join(', ');
      mudancas.liberado_por = eu.email;
      mudancas.liberado_em = new Date().toISOString();
      mudancas.confirmado_em = alvo.email === eu.email ? alvo.confirmadoEm : ''; // confirma de novo (menos você mesma)
    }
    atualizar_('Usuarios', alvo.linha, mudancas);
    return apiEstado();
  });
}

/** Admin tira o acesso de alguém (apaga da aba Usuarios). Os clientes dessa pessoa ficam para reatribuir. */
function apiRemoverUsuario(email) {
  return comTrava_(function () {
    var usuarios = lerUsuarios_();
    var eu = exigirUsuario_(usuarios);
    if (!podeGerenciarUsuarios_(eu)) throw new Error('Só admin remove usuários.');
    var alvo = usuarios.filter(function (u) { return u.email === String(email || '').trim().toLowerCase(); })[0];
    if (!alvo) throw new Error('Usuário não encontrado.');
    if (alvo.email === eu.email) throw new Error('Você não pode remover o seu próprio acesso.');
    removerLinha_('Usuarios', alvo.linha);
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

/** Índice da linha de cabeçalho (a que reconhece mais colunas, entre as 20 primeiras), ou -1. */
function acharCabecalho_(linhas) {
  var melhor = -1;
  var pontos = 0;
  for (var i = 0; i < Math.min(linhas.length, 20); i++) {
    var mapa = mapearColunas_(linhas[i].map(function (h) { return String(h == null ? '' : h).trim(); }));
    if (mapa.nome === undefined && mapa.idExterno === undefined) continue;
    var n = Object.keys(mapa).length;
    if (n > pontos) { melhor = i; pontos = n; }
  }
  return melhor;
}

/** Linhas de total/rodapé dos relatórios: não são clientes. */
function linhaDeRodape_(l) {
  var preenchidas = l.filter(function (c) { return c !== '' && c != null; });
  if (!preenchidas.length) return true;
  var primeira = normalizarTexto_(preenchidas[0]);
  return /^(total|subtotal|grand total|totais|confidential information|copyright|generated by|gerado por|filtered by|filtrado por|\(?\d+ (records|registros))/.test(primeira);
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
  if (!linhas.length) throw new Error('Cole o cabeçalho e pelo menos uma linha de cliente.');
  // Relatórios do Salesforce vêm com título e filtros acima do cabeçalho: procura a linha que
  // mais parece cabeçalho entre as primeiras e ignora o que está acima.
  var inicio = acharCabecalho_(linhas);
  if (inicio < 0) {
    var primeira = linhas[0].filter(function (c) { return c !== '' && c != null; }).slice(0, 4).join(' | ');
    throw new Error('Não achei a linha de cabeçalho (com uma coluna "Name", "Cliente", "Empresa" ou "Hotmart ID"). ' +
      'A primeira linha tem: "' + String(primeira).slice(0, 120) + '".');
  }
  var cab = linhas[inicio].map(function (h) { return String(h == null ? '' : h).trim(); });
  var col = mapearColunas_(cab);
  var rotulos = rotulosImportacao_();
  // Rodapé do Salesforce ("Grand Totals", "Confidential Information", "Copyright"…) não é cliente.
  var dados = [];
  linhas.slice(inicio + 1).forEach(function (l, i) {
    if (!linhaDeRodape_(l)) dados.push({ valores: l, numero: inicio + i + 2 });
  });
  if (!dados.length) throw new Error('Achei o cabeçalho, mas nenhuma linha de cliente abaixo dele.');
  if (dados.length > MAX_LINHAS_IMPORTACAO) throw new Error('No máximo ' + MAX_LINHAS_IMPORTACAO + ' clientes por vez.');
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

  var saida = dados.map(function (d) {
    var l = d.valores;
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
      else vistos[chave] = d.numero;
    }
    return {
      linha: d.numero, acao: acao, motivo: erros.concat(avisos).join('; '), comAviso: !erros.length && avisos.length > 0,
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
