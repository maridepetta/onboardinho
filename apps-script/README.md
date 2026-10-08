# Onboardinho no Google Apps Script

O app roda no Google: login pela conta Google da empresa, dados numa planilha só sua.

## Como funciona

- **Login:** a conta Google de quem abre o link. Sem senha. Só entra quem está na aba `Usuarios`.
- **Banco:** uma planilha com 4 abas (`Usuarios`, `Clientes`, `Orientacoes`, `Pedidos`).
  **Não compartilhe a planilha com o time**: o app roda com a sua permissão e mostra a cada
  pessoa só o que ela pode ver (o segmento dela). Quem tiver a planilha vê tudo.
- **Clientes:** na tela **Clientes → Colar da planilha**, copie o relatório do Salesforce (ou qualquer
  planilha) com o cabeçalho e cole. O app reconhece as colunas pelo nome — inclusive as do relatório de
  onboarding (Name, Hotmart ID, Closed Date, Onboarding Status, Opportunity: Owner Name, GMV, Health,
  Amount 1-3/12 months, Strategy…) — mostra uma prévia e só grava quando você clica em **Importar**.
  - Cliente que já existe (mesmo **Hotmart ID**) é **atualizado**, não duplicado.
  - Etapa e responsável só mudam quando mudaram na origem: o que o time muda no app não é desfeito
    pela próxima colagem.
  - Valores desconhecidos (ex.: uma etapa "Kickoff") você traduz na própria prévia; "Billing" já vira Faturamento.
  - O relatório não tem segmento: ele vem do **owner**, se o owner estiver em Usuários como onboarder
    (cadastre com o **mesmo nome** do Salesforce), ou do "segmento padrão" escolhido na prévia.
- **Automático:** crie uma aba **`Salesforce`** na planilha e deixe o complemento *Data connector for
  Salesforce* atualizá-la (ou cole o relatório nela). No editor, rode **`ativarSincronizacao`** uma vez:
  o app lê essa aba de hora em hora. A situação aparece em **Clientes → Automático (Salesforce)**.
- **Página do cliente:** clique no nome. Mostra negócio (GMV × previsto), saúde, origem, estratégia,
  jornada (cada mudança de etapa fica na aba `Historico`) e orientações.
- **Análise do cliente:** na tela Clientes, coluna **Análise → + Link**, cole o link do
  notebook do NotebookLM (ou Doc/Drive/Gemini) do cliente. Só aceita `https://…google.com`.
  O link aparece também no Início, ao lado do cliente. **O link não dá acesso:** compartilhe
  o notebook no NotebookLM com quem precisa abrir. O app guarda só o link, nunca a conversa.

## Instalação (uma vez, ~10 minutos)

1. Crie uma planilha nova no Google Sheets (ex.: "Onboardinho — dados").
2. Na planilha: **Extensões → Apps Script**.
3. No editor, em **Configurações do projeto** (engrenagem), marque
   **"Mostrar arquivo de manifesto appsscript.json no editor"**.
4. São só 3 arquivos no editor:
   - `appsscript.json` (substitua o que existe)
   - `Código.gs`: cole **todo** o conteúdo de **`Onboardinho.gs`** (o código do servidor num arquivo só)
   - `Index.html`: botão **+ → HTML**, com o nome `Index`
   Se existirem `Dados.gs` ou `Regras.gs` de versões antigas, **apague** (eles já estão dentro do Onboardinho.gs).
5. Salve. (Opcional) Escolha a função **`configurar`** e clique em **Executar** para autorizar e
   ver o link da planilha no registro. Se pular, o app se prepara sozinho na primeira vez que
   o link for aberto: usa a planilha ligada ao projeto ou, se o projeto foi criado em
   script.google.com, cria uma planilha "Onboardinho – dados" no seu Drive. Quem publicou vira admin.
6. **Implantar → Nova implantação → engrenagem → App da Web**:
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa em <sua empresa>**
7. Copie o link que termina em `/exec`. É esse link que você manda para o time.

Depois de mudar o código: se o `appsscript.json` mudou (permissões novas), rode **`configurar`** no editor
uma vez para autorizar. Depois: **Implantar → Gerenciar implantações → editar (lápis) → Versão: Nova versão**.
Sem isso, o link continua com a versão antiga.

**Testar antes de liberar para o time:** **Implantar → Testar implantações** dá um link que termina
em `/dev`. Ele roda o código salvo mais recente e só abre para quem edita o script; o link `/exec`
do time continua na versão antiga. Atenção: o `/dev` usa **a mesma planilha**. O que você importar
no teste aparece para o time. A prévia não grava nada.

## Uso

- Cadastre as pessoas em **Usuários** (dentro do app). Elas entram pelo link com a conta Google.
- **Início:** o dia numa tela só: clientes por etapa e orientações em três colunas (gerais,
  time, clientes). Clicar numa orientação abre o **Resumo do dia** nela.
- **Resumo do dia:** a fila completa em ordem de urgência, com **Feito**/**Arquivar**.
- No primeiro acesso, a pessoa confirma o papel e o segmento ou pede ajuste.
- Liderança e admin publicam orientações em **Nova orientação**.
- O onboarder marca a orientação do cliente como **Feito**.
- Quando um cliente muda de etapa, o responsável (ou a liderança) troca a etapa na tela **Clientes**;
  a data "desde" vira hoje.

## Regras de acesso

| Quem | Vê | Pode |
| --- | --- | --- |
| Onboarder (1 segmento) | os próprios clientes, avisos do seu segmento e gerais | concluir orientações dos seus clientes, mudar etapa e link da análise deles, pedir ajuste |
| Liderança (1+ segmentos) | clientes dos seus segmentos | importar/adicionar clientes e escolher o responsável nos seus segmentos, criar orientações de segmento/cliente nos seus segmentos, decidir pedidos de segmentação dentro deles |
| Admin | tudo | cadastrar usuários, orientações gerais, decidir qualquer pedido |

Ninguém decide o próprio pedido. Mudança de papel: só admin.

## Para quem mexe no código

`Regras.gs`, `Dados.gs` e `Code.gs` são as fontes (separadas para testar). Depois de mudar qualquer um,
rode `npm run montar`, que gera o `Onboardinho.gs` (arquivo único que vai para o editor) com uma
versão nova; o admin vê a versão na tela Clientes. O teste falha se o `Onboardinho.gs` estiver desatualizado.

## Testes (fora do Google)

`npm test` na raiz roda estes arquivos `.gs` contra uma planilha de mentira
(`tests/apps-script/googleFakes.js`): regras, permissões, planilha de clientes e
proteção contra texto que viraria fórmula.

## Limites conhecidos

- O e-mail de quem acessa só chega se a pessoa for do mesmo domínio Google Workspace.
  Com várias contas Google abertas no navegador, o Google pode não identificar a pessoa.
- Apps Script é mais lento que um servidor próprio (cada ação leva ~1–2 s) e tem cotas diárias.
- Ainda não há: edição/remoção de usuário pela tela (faça na aba `Usuarios`), e-mail de aviso
  para pedidos novos, sugestões automáticas por IA.
