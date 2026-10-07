import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { STAGES } from "@/lib/domain";
import { CSV_COLUMNS } from "@/lib/clientImport";
import { canImportClients } from "@/lib/permissions";
import { daysSince, visibleClients } from "@/lib/queue";
import { requireUser } from "@/lib/session";
import { listClients, listUsers } from "@/lib/store";
import { AppShell } from "@/components/app/AppShell";
import { ImportForm } from "./ImportForm";
import styles from "@/components/app/app.module.css";

export const metadata: Metadata = { title: "Clientes · Onboardinho" };

export default function ClientesPage() {
  return (
    <Suspense fallback={null}>
      <Clientes />
    </Suspense>
  );
}

async function Clientes() {
  const user = await requireUser();
  if (!canImportClients(user)) redirect("/inicio");
  await connection(); // usa a data de hoje: sempre renderiza na hora do pedido

  const [clients, users] = await Promise.all([listClients(), listUsers()]);
  const names = new Map(users.map((u) => [u.id, u.name]));
  // Admin vê todos; liderança, os dos seus segmentos.
  const visible = (user.isAdmin ? clients : visibleClients(user, clients)).sort(
    (a, b) =>
      STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage) || a.name.localeCompare(b.name, "pt-BR"),
  );

  return (
    <AppShell user={user} current="clientes">
      <div className={styles.stack}>
        <p className={styles.kicker}>
          {user.isAdmin ? "Todos os segmentos" : `Segmentos ${user.segments.join(" + ")}`}
        </p>
        <h1 className={styles.title}>Clientes</h1>
        <p className={styles.lead}>
          Por enquanto os clientes entram por planilha. Cada importação cria os novos e atualiza os
          que já existem (pelo id_externo, ou por nome + segmento). Ninguém é apagado.
        </p>
      </div>

      <section className={styles.panel} aria-labelledby="importar">
        <h2 id="importar" className={styles.h2}>
          Importar planilha
        </h2>
        <p className={styles.lead}>
          Colunas: <code>{CSV_COLUMNS.join(" ; ")}</code>. O <code>id_externo</code> é opcional
          agora, mas use o id do Astrobox se tiver: é o que vai ligar a planilha à integração
          depois. Datas em dd/mm/aaaa. Etapas: {STAGES.join(", ")}.
        </p>
        <ImportForm />
      </section>

      <section className={styles.stack} aria-labelledby="lista">
        <h2 id="lista" className={styles.h2}>
          {visible.length} {visible.length === 1 ? "cliente" : "clientes"}
        </h2>
        {visible.length === 0 ? (
          <p className={styles.empty}>Nenhum cliente ainda. Importe a primeira planilha.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Segmento</th>
                  <th>Responsável</th>
                  <th>Etapa</th>
                  <th>Na etapa</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => {
                  const days = daysSince(c.stageSince);
                  return (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.name}</strong>
                        {c.externalId && (
                          <>
                            <br />
                            <span className={styles.muted}>{c.externalId}</span>
                          </>
                        )}
                      </td>
                      <td>{c.segment}</td>
                      <td className={styles.muted}>{names.get(c.ownerId) ?? "—"}</td>
                      <td>{c.stage}</td>
                      <td className={days > 10 ? styles.late : undefined}>
                        {days} {days === 1 ? "dia" : "dias"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}
