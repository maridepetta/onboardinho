# Trilho — assistente do time de onboarding

Assistente para o time de onboarding acompanhar cada cliente com orientações e sugestões baseadas no manual do time.
Segmentações: **6D** (clientes N2/N3), **7D** (N4/N5) e **8D** (N6+). Usuários: onboarders e lideranças.

## O que já existe

**Cadastro · passo 1 — Seu acesso** (`/onboarding`). Papel e segmentação **vêm da liberação**; o usuário só confirma.

- Liberação ok → confirma e escolhe o nome de exibição.
- Algo errado → pede ajuste (papel, segmentação ou outro) para quem libera e segue com o acesso atual.
- Sem liberação → pede liberação e não avança.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript
- CSS Modules + variáveis CSS (`src/app/globals.css`)
- Fontes: Archivo, IBM Plex Sans, IBM Plex Mono (via `next/font`)

## Rodando

```bash
npm install
npm run dev
```

Abra http://localhost:3000.

## Dados simulados

Ainda não há login nem banco. O acesso vem de `src/lib/access.ts` (mock) e os pedidos/perfil de
`src/app/onboarding/actions.ts` (só registram no console).

Em desenvolvimento, uma barra no topo troca o cenário (ou use `?cenario=`):

- `/onboarding?cenario=onboarder` — Onboarder, 7D
- `/onboarding?cenario=lideranca` — Liderança, 6D + 7D
- `/onboarding?cenario=sem-liberacao`

## Próximos passos (decisões em aberto)

1. **Login**: entrar com a conta da empresa (Google/Microsoft)? Se sim, nome e e-mail vêm do login.
2. **Quem recebe o pedido de ajuste/liberação** e em quanto tempo responde.
3. **Banco + permissões**: liberação (papel + segmentações) guardada no banco, restringindo o que cada pessoa vê.
4. Passos 2 (Carteira) e 3 (Preferências).
