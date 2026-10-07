# Trilho — assistente do time de onboarding

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
| `/entrar` | todos | Login **simulado**: escolha com quem entrar |
| `/primeiro-acesso` | quem acabou de ser criado | Criar senha → confirmar acesso (ou pedir ajuste) → início |
| `/inicio` | todos | Página da pessoa (lista de clientes ainda por fazer) |
| `/meu-acesso` | todos | Ver o acesso e pedir ajuste |
| `/pedidos` | liderança e admin | Aprovar/recusar pedidos |
| `/admin/usuarios` | admin | Criar usuários |

## Stack

- [Next.js](https://nextjs.org) 16 (App Router) + TypeScript
- CSS Modules + variáveis CSS — **a paleta inteira fica em `src/app/globals.css`**
- Fontes: Archivo, IBM Plex Sans, IBM Plex Mono (via `next/font`)

## Rodando

```bash
npm install
npm run dev   # http://localhost:3000
npm test      # regras de permissão
npm run lint
```

## O que ainda é simulado

- **Banco**: `src/lib/store.ts` guarda tudo em memória e **zera quando o servidor reinicia**.
- **Login**: `src/lib/session.ts` usa um cookie com o id do usuário escolhido em `/entrar`. A senha do primeiro acesso não é salva.
- **Convite por e-mail**: não é enviado.

Plano: trocar os três pelo [Supabase](https://supabase.com) (banco Postgres + login por e-mail/senha + convite pelo admin).
As telas não mudam; só `store.ts` e `session.ts`.

## Próximos passos

1. Supabase (precisa de uma conta e das chaves do projeto).
2. Tela principal: lista de clientes com etapa e próxima ação sugerida pelo manual.
