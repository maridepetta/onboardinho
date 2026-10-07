import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ROLE_LABEL } from "@/lib/domain";
import { canManageUsers } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { listUsers } from "@/lib/store";
import { AppShell } from "@/components/app/AppShell";
import { CreateUserForm } from "./CreateUserForm";
import styles from "@/components/app/app.module.css";

export const metadata: Metadata = { title: "Usuários · Assistente de Onboarding" };

export default function UsuariosPage() {
  return (
    <Suspense fallback={null}>
      <Usuarios />
    </Suspense>
  );
}

async function Usuarios() {
  const user = await requireUser();
  if (!canManageUsers(user)) redirect("/inicio");
  const users = await listUsers();

  return (
    <AppShell user={user} current="usuarios">
      <div className={styles.stack}>
        <p className={styles.kicker}>ADMIN</p>
        <h1 className={styles.title}>Usuários</h1>
        <p className={styles.lead}>
          Quem você cria aqui já entra com papel e segmentação definidos. A pessoa recebe um
          convite por e-mail para criar a senha.
        </p>
      </div>

      <section className={styles.panel} aria-labelledby="novo">
        <h2 id="novo" className={styles.h2}>
          Novo usuário
        </h2>
        <CreateUserForm />
      </section>

      <section className={styles.stack} aria-labelledby="todos">
        <h2 id="todos" className={styles.h2}>
          Todos ({users.length})
        </h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>NOME</th>
                <th>PAPEL</th>
                <th>SEGMENTAÇÃO</th>
                <th>LIBERADO POR</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.name}</strong>
                    <br />
                    <span className={styles.muted}>{u.email}</span>
                  </td>
                  <td>
                    {ROLE_LABEL[u.role]}
                    {u.isAdmin ? " · Admin" : ""}
                  </td>
                  <td>{u.segments.join(" + ")}</td>
                  <td className={styles.muted}>{u.grantedBy}</td>
                  <td className={styles.status}>
                    {u.confirmedAt ? "ATIVO" : "CONVITE ENVIADO"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
