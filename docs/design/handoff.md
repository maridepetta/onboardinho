# Handoff: Onboardinho — Login + boas-vindas com orientações do dia

## Visão geral
Onboardinho é um assistente interno para o time de onboarding. Ele acompanha cada cliente pelas etapas do pipeline e mostra orientações e sugestões baseadas no manual do time. Algumas orientações valem para todos; outras são específicas de um segmento.

- **Usuários:** onboarders e lideranças. Os dois veem a **mesma tela**; a liderança vê os números do time inteiro.
- **Segmentos:** 6D (clientes N2/N3), 7D (N4/N5), 8D (N6+).
- **Etapas do cliente (nesta ordem):** Pre Onboarding → Welcome → Product Migration → Ready for Activation → Activation & Monitoring → Accomplished / Unaccomplished.
- **Esta entrega:** a primeira tela, ou seja, login + boas-vindas com as orientações do dia. Plataforma: desktop web.

## Sobre os arquivos de design
Os arquivos deste pacote são **referências de design feitas em HTML**: protótipos que mostram o visual e o comportamento esperados. **Não são código de produção para copiar.** A tarefa é **recriar estes designs no ambiente do projeto** (React, Vue etc.), usando os padrões e bibliotecas que ele já tem. Se ainda não houver um ambiente, escolha o framework mais adequado.

- `First Screen.dc.html`: fonte do design. Cada tela é marcada como `id="2a"`, `id="2b"` e `id="2c"`, dentro de `<section id="t2">`. A seção `t1` contém explorações antigas, de outro produto; **ignore**.
- `Onboardinho.html`: o mesmo design num único arquivo que abre offline no navegador, para visualizar.
- `ds/styles.css`: tokens do design system **Modernist** (cores, fonte, rampas, componentes).
- `support.js`: runtime para abrir o `.dc.html` localmente. Não faz parte do produto.

## Fidelidade
**Alta fidelidade (hi-fi).** Cores, tipografia, espaçamento e interações são finais. Recrie fiel ao design, usando as bibliotecas do projeto. Todos os textos e dados são **exemplos** (nomes de clientes, seções do manual, contagens). Na implementação, eles vêm da API ou do manual real.

## Três direções (o time escolhe uma ou combina)
Todas foram desenhadas em 1280×800 px. Na implementação, o layout deve se adaptar à largura: use os grids com `minmax(0,1fr)`.

### 2a — Briefing em grid
**Propósito:** visão geral do dia numa só tela.

**Layout (coluna, de cima para baixo):**
1. **Nav:** padding 16px 40px; borda inferior de 2px `--color-divider`. À esquerda, a marca "Assistente de Onboarding" (Archivo 800, 18px). À direita, os links Início (ativo, `--color-accent`), Clientes, Manual e Time, em 14px com gap de 32px. Depois, "Marina Costa · Onboarder" (13px), separado por borda esquerda de 2px.
2. **Saudação:** grid de 12 colunas, gap 24px, padding 36px 40px 28px, alinhado na base.
   - Colunas 1–8: data como kicker ("Quarta, 7 de outubro"; 12px, uppercase, letter-spacing 0.1em, `--color-accent-700`). Abaixo, o H1 "Bom dia, Marina.\n8 orientações para hoje." em 64px/1, peso 800, letter-spacing −0.035em.
   - Colunas 9–12: tag sólida "Segmento 6D" (fundo accent, texto bg), tag com contorno "Clientes N2–N3" e um parágrafo de 14px.
3. **Faixa do pipeline:** grid de 7 colunas iguais; margem horizontal 40px; borda superior de 2px `--color-text` e inferior de 2px `--color-divider`. Cada célula tem padding 12px 14px, o nome da etapa em 12px e a contagem em 30px/800. Divisor de 1px entre células. A etapa em destaque (Activation & Monitoring) tem fundo `--color-accent` e texto `--color-bg`. Contagem 0 aparece em `--color-neutral-500`.
4. **Três colunas de orientações** (flex: 1), separadas por bordas esquerdas de 2px: "Gerais · todos os times", "Time 6D · N2–N3" e "Seus clientes hoje" (este cabeçalho em `--color-accent-700`).
   - Cabeçalho: 11px, uppercase, 0.1em, com a contagem alinhada à direita.
   - Cada item: título em 17px/800 e meta em 13px `--color-neutral-700`. Itens separados por 1px `--color-divider`.
   - Última linha da terceira coluna: "+ 2 clientes →".
5. **Rodapé:** borda superior de 2px; padding 16px 40px. Botão primário "Começar pelos clientes →" com 260px de largura e label alinhado à esquerda, seguido de uma nota em 13px.

### 2b — Pôster + fila priorizada
**Propósito:** dizer ao onboarder exatamente por onde começar.

**Layout:** grid de 2 colunas, proporção 5fr / 7fr.
- **Esquerda: campo vermelho.** Fundo `--color-accent`, texto `--color-bg`, padding 36px 40px, conteúdo distribuído com space-between.
  - Topo: marca (800, 16px).
  - Meio: data (13px uppercase), H1 "Bom dia, Marina." (88px/0.92, 800, letter-spacing −0.045em) e a frase "4 clientes precisam de você hoje. Comece pelo 01." (26px/1.2, 600).
  - Base: grid de 2 colunas com borda superior de 2px na cor bg: "Onboarder / Segmento 6D" e "Clientes / N2 – N3".
- **Direita: fila.**
  - Cabeçalho: padding 28px 40px 20px; borda inferior de 2px. Controle segmentado com as abas **Minha carteira | Time 6D | Geral**: borda de 1px, cada opção com padding 9px 16px e 13px; a ativa tem fundo accent e texto bg. À direita, uma nota contextual em 13px.
  - Lista: cada item é um grid `72px | 1fr | 140px`, gap 20px, padding 20px 0, borda inferior de 1px.
    - Número "01", "02"… em 40px/800. O primeiro em accent, os outros em `--color-neutral-400`.
    - Título em 19px/800. Descrição em 14px/1.45 `--color-neutral-800`.
    - Duas tags: a etapa (`--color-accent-100` / `--color-accent-800`) e a fonte no manual (`--color-neutral-200` / `--color-neutral-800`).
    - Link "Ver orientação →" (13px, 600, `--color-accent-700`).
  - Rodapé: borda superior de 2px. Botão primário "Começar pelo 01 →" (240px) e botão secundário "Abrir o manual".

### 2c — Login → manual por etapa
**Propósito:** fluxo de login seguido da exploração das orientações etapa por etapa.

**Estado deslogado:** grid de 12 colunas.
- **Colunas 1–5:** padding 40px; borda direita de 2px. Contém:
  - a marca;
  - o H2 "Entrar" (36px/800);
  - os campos "E-mail corporativo" e "Senha": label em 12px `--color-neutral-700`, input com altura mínima de 44px, fundo `--color-surface`, borda de 1px `--color-divider` (em foco: `--color-accent`), raio 0;
  - o botão primário "Entrar →" ocupando toda a largura, com label à esquerda;
  - o botão secundário "Entrar com SSO da empresa";
  - a nota de rodapé "Acesso para onboarders e liderança dos segmentos 6D, 7D e 8D."
- **Colunas 6–12:** fundo `--color-text`, texto `--color-bg`. Frase "O manual do time, no momento certo de cada cliente." em 72px/0.95, 800. Abaixo, um grid de 3 colunas com borda superior de 2px accent: 6D / 7D / 8D, cada rótulo em `--color-accent-400`, com a faixa de clientes.

**Estado logado:**
- Nav: marca, tag "6D · N2–N3", nome do usuário e "Sair".
- H1 "Bom dia, Marina. Por onde começamos?" (48px/800).
- **Trilha de etapas:** grid de 7 colunas, gap 4px. Cada célula tem borda superior de 6px (ativa: accent; inativa: `--color-neutral-300`), o número "01"–"07" (11px), o nome (13px/600) e a contagem (26px/800). A célula ativa tem fundo `--color-surface` e contagem em `--color-accent-700`. Hover: `--color-neutral-200`.
- **Painel de detalhe:** borda superior de 2px `--color-text`; grid de 12 colunas.
  - Colunas 1–6: kicker "Orientação do manual · {etapa}", orientação em 30px/1.15/800, nota em 14px e a fonte no manual (12px).
  - Colunas 7–12, com borda esquerda de 2px: tabela com as colunas Cliente | Na etapa | Próximo passo. Cabeçalho em 11px uppercase com borda de 2px; linhas com 1px. Mais de 10 dias na etapa aparece em `--color-accent-700`. Sem clientes: "Nenhum cliente seu nesta etapa agora."

## Interações e comportamento
- **2b:** clicar numa aba troca a lista (`minha` | `time` | `geral`). A etapa ativa padrão é `minha`. O primeiro item sempre recebe o número em vermelho.
- **2c:** "Entrar" leva ao estado logado e "Sair" volta ao deslogado. Clicar numa etapa atualiza o painel de orientação e a tabela de clientes. A etapa padrão é Activation & Monitoring (índice 4).
- **Hovers:** botão primário `--color-accent-600`, pressionado `--color-accent-700`. Botão secundário e células: `--color-neutral-200`. Foco: `outline: 2px solid var(--color-accent); outline-offset: 2px`.
- **Sem animações**, exceto as transições de hover nativas.
- **Login real:** implemente a validação e os erros com o padrão do projeto. O design não define estados de erro; use texto em `--color-accent-700` abaixo do campo.

## Estado e dados
- `user`: `{ nome, papel: 'onboarder' | 'lideranca', segmento: '6D' | '7D' | '8D' }`
- `pipeline`: `[{ etapa, count }]`, na ordem acima. Para a liderança, as contagens são do time inteiro.
- `orientacoes`: `[{ titulo, descricao, escopo: 'geral' | 'segmento' | 'cliente', segmento?, clienteId?, etapa, fonteManual, prioridade }]`. A fila é ordenada por prioridade.
- `clientes`: `[{ nome, etapa, diasNaEtapa, proximoPasso }]`.
- UI: `abaAtiva` (2b), `etapaSelecionada` e `logado` (2c).

## Design tokens (Modernist, em `ds/styles.css`)
- **Cores:**
  - bg `#f3f2f2`, surface `#eae9e9`, texto `#201e1d`, accent `#ec3013`
  - divider: `#201e1d` a 40%
  - rampa accent: 100 `#fff2ef` · 400 `#ff9783` · 600 `#dd2b0f` · 700 `#ae1800` · 800 `#7c1405`
  - rampa neutral: 200 `#eae7e7` · 300 `#d7d3d3` · 400 `#bab6b6` · 500 `#9b9797` · 700 `#605d5d` · 800 `#444141`
- **Fonte:** Archivo (Google Fonts), pesos 400, 600 e 800. Títulos em 800 com letter-spacing negativo.
- **Raio:** 0 em tudo. Nenhum canto arredondado.
- **Linhas:** 2px entre seções principais, 1px entre itens.
- **Espaçamento:** 4, 8, 12, 16, 24, 32px (as margens das telas usam 40px).
- **Sombras:** não usadas nestas telas.
- **Regras do sistema:** labels de botão sempre alinhados à esquerda; nada centralizado; vermelho só na ação principal, em pequenos destaques e no campo-pôster (2b). Texto de parágrafo em vermelho usa `--color-accent-700`.

## Assets
Nenhuma imagem. Os ícones são apenas "→" em texto; se o projeto usar ícones, use **Lucide** (padrão do design system).

## Arquivos
- `First Screen.dc.html`: fonte (seção `t2`, opções `2a`, `2b`, `2c`). A lógica de dados de exemplo fica no método `v2()` do script.
- `Onboardinho.html`: visualização offline.
- `ds/styles.css`: tokens e componentes.
- `support.js`: runtime de visualização (não implementar).
