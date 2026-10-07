import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ROLE_LABEL } from "@/lib/domain";
import { listUsers } from "@/lib/store";
import { signInAs } from "@/app/actions";
import styles from "@/components/app/app.module.css";

export const metadata: Metadata = { title: "Entrar · Trilho" };

// Login SIMULADO: escolha com quem entrar. Vira e-mail + senha com o Supabase.
export default function EntrarPage() {
  return (
    <main className={styles.content}>
      <div className={styles.stack}>
        <p className={styles.kicker}>LOGIN SIMULADO · SÓ ENQUANTO NÃO HÁ BANCO</p>
        <h1 className={styles.title}>Entrar como…</h1>
        <p className={styles.lead}>
          Usuários de teste. Quem ainda não fez o primeiro acesso cai na criação de senha.
        </p>
      </div>
      <Suspense fallback={null}>
        <UserList />
      </Suspense>
    </main>
  );
}

async function UserList() {
  await connection();
  const users = await listUsers();
  return (
    <ul className={styles.userList}>
      {users.map((u) => (
        <li key={u.id}>
          <form action={signInAs}>
            <input type="hidden" name="userId" value={u.id} />
            <button type="submit" className={styles.userButton}>
              <strong>{u.name}</strong>
              <span className={styles.muted}>
                {u.isAdmin ? "Admin · " : ""}
                {ROLE_LABEL[u.role]} · {u.segments.join(" + ")}
              </span>
              <span className={styles.status}>
                {u.confirmedAt ? "JÁ ACESSOU" : "PRIMEIRO ACESSO PENDENTE"}
              </span>
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}
