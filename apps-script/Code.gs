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
      return Object.assign(semLinha_(c), { podeEditar: podeEditarCliente_(eu, c) });
    }),
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

// ---------- Clientes ----------

/** dados: { idExterno?, nome, segmento, responsavelEmail, etapa, desde (aaaa-mm-dd ou dd/mm/aaaa) } */
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
    var dono = usuarios.filter(function (u) { return u.email === email; })[0];
    if (!dono || dono.papel !== 'onboarder' || dono.segmentos.indexOf(segmento) < 0) {
      throw new Error('Escolha um onboarder do segmento ' + segmento + ' como responsável.');
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
      id_externo: idExterno, nome: nome, segmento: segmento, responsavel_email: email,
      etapa: etapa, desde: desde.slice(0, 10)
    });
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
    atualizar_('Clientes', cliente.linha, { etapa: etapa, desde: hoje_() });
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
