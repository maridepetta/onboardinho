# Onboardinho no Google Apps Script

O app roda no Google: login pela conta Google da empresa, dados numa planilha só sua.

## Como funciona

- **Login:** a conta Google de quem abre o link. Sem senha. Só entra quem está na aba `Usuarios`.
- **Banco:** uma planilha com 4 abas (`Usuarios`, `Clientes`, `Orientacoes`, `Pedidos`).
  **Não compartilhe a planilha com o time**: o app roda com a sua permissão e mostra a cada
  pessoa só o que ela pode ver (o segmento dela). Quem tiver a planilha vê tudo.
- **Clientes:** cole a exportação na aba `Clientes` com as colunas
  `id_externo | nome | segmento | responsavel_email | etapa | desde`. Linhas com problema
  aparecem para o admin na tela Clientes. Use o id do Astrobox em `id_externo`.

## Instalação (uma vez, ~10 minutos)

1. Crie uma planilha nova no Google Sheets (ex.: "Onboardinho — dados").
2. Na planilha: **Extensões → Apps Script**.
3. No editor, em **Configurações do projeto** (engrenagem), marque
   **"Mostrar arquivo de manifesto appsscript.json no editor"**.
4. Crie os arquivos e cole o conteúdo desta pasta:
   - `appsscript.json` (substitua o que existe)
   - `Code.gs` (substitua o que existe)
   - `Regras.gs` e `Dados.gs`: botão **+ → Script**, com o nome sem o `.gs`
   - `Index.html`: botão **+ → HTML**, com o nome `Index`
5. Salve. (Opcional) Escolha a função **`configurar`** e clique em **Executar** para autorizar e
   ver o link da planilha no registro. Se pular, o app se prepara sozinho na primeira vez que
   o link for aberto: usa a planilha ligada ao projeto ou, se o projeto foi criado em
   script.google.com, cria uma planilha "Onboardinho – dados" no seu Drive. Quem publicou vira admin.
6. **Implantar → Nova implantação → engrenagem → App da Web**:
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa em <sua empresa>**
7. Copie o link que termina em `/exec`. É esse link que você manda para o time.

Depois de mudar o código: **Implantar → Gerenciar implantações → editar (lápis) → Versão: Nova versão**.
Sem isso, o link continua com a versão antiga.

## Uso

- Cadastre as pessoas em **Usuários** (dentro do app). Elas entram pelo link com a conta Google.
- No primeiro acesso, a pessoa confirma o papel e o segmento ou pede ajuste.
- Liderança e admin publicam orientações em **Nova orientação**.
- O onboarder marca a orientação do cliente como **Feito**.

## Regras de acesso

| Quem | Vê | Pode |
| --- | --- | --- |
| Onboarder (1 segmento) | os próprios clientes, avisos do seu segmento e gerais | concluir orientações dos seus clientes, pedir ajuste |
| Liderança (1+ segmentos) | clientes dos seus segmentos | criar orientações de segmento/cliente nos seus segmentos, decidir pedidos de segmentação dentro deles |
| Admin | tudo | cadastrar usuários, orientações gerais, decidir qualquer pedido |

Ninguém decide o próprio pedido. Mudança de papel: só admin.

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
