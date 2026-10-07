# Onboardinho

Assistente para o time de onboarding acompanhar cada cliente com orientações e sugestões baseadas no manual do time.
Segmentações: **6D** (clientes N2/N3), **7D** (N4/N5) e **8D** (N6+). Usuários: onboarders e lideranças.

## Como o acesso funciona

- **O admin cria cada usuário** já com papel (onboarder/liderança) e segmentações. A pessoa recebe convite, cria a senha e confirma o acesso.
- **Ninguém escolhe o próprio acesso.** Se algo estiver errado, a pessoa pede ajuste.
- **Quem decide os pedidos** (`src/lib/permissions.ts`, com testes):
  - Admin decide qualquer pedido.
  - Liderança decide só pedidos de segmentação, e só dentro das segmentações dela.
  - Mudança de papel: só admin.
  - Ninguém decide o próprio pedido.

## Telas

| Rota | Quem | O quê |
| --- | --- | --- |
| `/entrar` | todos | Login com e-mail e senha (design 2c, sem SSO) |
| `/primeiro-acesso` | quem acabou de ser criado | Criar senha → confirmar acesso (ou pedir ajuste) → início |
| `/inicio` | todos | Design 2b: fila de orientações priorizada (Minha carteira · Time · Geral) |
| `/clientes` | liderança e admin | Importar clientes por planilha e ver a lista |
| `/meu-acesso` | todos | Ver o acesso e pedir ajuste |
| `/pedidos` | liderança e admin | Aprovar/recusar pedidos |
| `/admin/usuarios` | admin | Criar usuários |

## Stack

- [Next.js](https://nextjs.org) 16 (App Router) + TypeScript
- CSS Modules + variáveis CSS — **a paleta inteira fica em `src/app/globals.css`**
- Design system **Modernist** (handoff do Claude Design em `docs/design/`): Archivo, raio 0, vermelho `#ec3013`
  - Ajuste de acessibilidade: botões usam `#d02a11` (texto claro sobre `#ec3013` tem contraste 3.76, abaixo do mínimo 4.5)

## Rodando

```bash
npm install
npm run dev   # http://localhost:3000
npm test      # permissões, regra de segmento, fila e importação
npm run lint
```

## Clientes por planilha

Até a integração com o Astrobox, os clientes entram por CSV em `/clientes` (modelo em `/clientes/modelo`):

`id_externo ; nome ; segmento ; responsavel_email ; etapa ; desde`

- Separador `;` ou `,`; datas `dd/mm/aaaa`; etapa e segmento sem diferenciar maiúsculas/acentos.
- Tudo ou nada: se uma linha tiver erro, nada é importado e cada erro diz a linha.
- Cria os novos e atualiza os existentes (por `id_externo`, ou nome + segmento). Ninguém é apagado.
- Liderança só importa clientes dos próprios segmentos.
- **Use o id do Astrobox em `id_externo`**: é a chave que vai permitir trocar a planilha pela integração sem duplicar clientes.

Regras em `src/lib/clientImport.ts`, com testes.

## Login

- E-mail + senha. A senha é criada no primeiro acesso e guardada com hash (scrypt).
- A sessão é um cookie httpOnly **assinado** (HMAC), válido por 12h: não dá para trocar o id no cookie e virar outra pessoa.
- Mesma mensagem para e-mail inexistente e senha errada.
- Variáveis de ambiente em produção:
  - `SESSION_SECRET` (obrigatória): texto aleatório longo.
  - `ADMIN_INITIAL_PASSWORD`: senha inicial do admin.
- Em desenvolvimento: usuários de exemplo entram com `onboardinho123`, e há um atalho "entrar como" na tela de login (some em produção).

## O que ainda é simulado

- **Banco**: `src/lib/store.ts` guarda tudo em memória e **zera quando o servidor reinicia**.
- **Senhas e usuários** ficam em memória: reiniciar o servidor apaga as senhas criadas.
- **Falta**: limite de tentativas de login, "esqueci minha senha" e o link de convite por e-mail.
- **Convite por e-mail**: não é enviado.
- **Orientações**: as de exemplo vêm do design; ainda não há tela para a liderança cadastrar nem IA gerando sugestões.

Plano: trocar os três pelo [Supabase](https://supabase.com) (banco Postgres + login por e-mail/senha + convite pelo admin).
As telas não mudam; só `store.ts` e `session.ts`.

## Próximos passos

1. Supabase (precisa de uma conta e das chaves do projeto).
2. Tela principal (design `docs/design/handoff.md`, direções 2a/2b/2c): pipeline por etapa e orientações do manual.
