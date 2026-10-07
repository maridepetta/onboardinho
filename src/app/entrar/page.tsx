import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ROLE_LABEL, SEGMENTS } from "@/lib/domain";
import { getCurrentUser } from "@/lib/session";
import { DEV_PASSWORD, listUsers } from "@/lib/store";
import { signInAs } from "@/app/actions";
import { LoginForm } from "./LoginForm";
import styles from "./login.module.css";

export const metadata: Metadata = { title: "Entrar · Onboardinho" };

// Login (design 2c, sem SSO): e-mail e senha à esquerda; frase e segmentos à direita.
export default function EntrarPage() {
  return (
    <div className={styles.page}>
      <section className={styles.formSide}>
        <span className={styles.brand}>Onboardinho</span>
        <div className={styles.formBlock}>
          <h1 className={styles.title}>Entrar</h1>
          <LoginForm />
          <p className={styles.note}>
            Primeiro acesso? Use o link do convite que chegou no seu e-mail.
          </p>
        </div>
        <p className={styles.note}>Acesso para onboarders e liderança dos segmentos 6D, 7D e 8D.</p>
        <Suspense fallback={null}>
          <AlreadyIn />
          {process.env.NODE_ENV !== "production" && <DevUsers />}
        </Suspense>
      </section>

      <section className={styles.pitch} aria-label="Sobre o Onboardinho">
        <p className={styles.pitchText}>O manual do time, no momento certo de cada cliente.</p>
        <dl className={styles.segments}>
          {SEGMENTS.map((s) => (
            <div key={s.code}>
              <dt>{s.code}</dt>
              <dd>{s.levels}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

// Quem já tem sessão não precisa ver o login.
async function AlreadyIn() {
  if (await getCurrentUser()) redirect("/inicio");
  return null;
}

// Só em desenvolvimento: atalho para testar com cada perfil (ainda não há convite por e-mail).
async function DevUsers() {
  await connection();
  const users = await listUsers();
  return (
    <details className={styles.dev}>
      <summary>Desenvolvimento: entrar como usuário de teste</summary>
      <p>
        Quem já acessou entra com a senha <code>{DEV_PASSWORD}</code>. Quem ainda não acessou só
        entra por aqui (no lugar do link do convite).
      </p>
      <ul>
        {users.map((u) => (
          <li key={u.id}>
            <form action={signInAs}>
              <input type="hidden" name="userId" value={u.id} />
              <button type="submit">
                {u.name} · {u.isAdmin ? "Admin" : ROLE_LABEL[u.role]} · {u.segments.join("+")}
                {u.confirmedAt ? "" : " · primeiro acesso"}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </details>
  );
}
