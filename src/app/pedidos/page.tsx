import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ROLE_LABEL, describeRequest } from "@/lib/domain";
import { canDecide, canReviewRequests } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { listRequests, listUsers } from "@/lib/store";
import { decide } from "@/app/actions";
import { AppShell } from "@/components/app/AppShell";
import styles from "@/components/app/app.module.css";

export const metadata: Metadata = { title: "Pedidos · Trilho" };

const STATUS_LABEL = { pendente: "PENDENTE", aprovado: "APROVADO", recusado: "RECUSADO" };

export default function PedidosPage() {
  return (
    <Suspense fallback={null}>
      <Pedidos />
    </Suspense>
  );
}

async function Pedidos() {
  const user = await requireUser();
  if (!canReviewRequests(user)) redirect("/inicio");

  const [requests, users] = await Promise.all([listRequests(), listUsers()]);
  const byId = new Map(users.map((u) => [u.id, u]));

  // Admin vê tudo; liderança vê o que pode decidir e o histórico do que já decidiu.
  const visible = requests.filter(
    (r) => user.isAdmin || canDecide(user, r) || r.decidedById === user.id,
  );
  const toDecide = visible.filter((r) => r.status === "pendente");
  const history = visible.filter((r) => r.status !== "pendente");

  return (
    <AppShell user={user} current="pedidos">
      <div className={styles.stack}>
        <p className={styles.kicker}>PEDIDOS DE AJUSTE DE ACESSO</p>
        <h1 className={styles.title}>Pedidos</h1>
        <p className={styles.lead}>
          {user.isAdmin
            ? "Como admin, você decide qualquer pedido, inclusive mudança de papel."
            : `Você decide pedidos de segmentação dentro de ${user.segments.join(", ")}. Mudança de papel fica com o admin.`}
        </p>
      </div>

      <section className={styles.stack} aria-labelledby="aguardando">
        <h2 id="aguardando" className={styles.h2}>
          Aguardando ({toDecide.length})
        </h2>
        {toDecide.length === 0 ? (
          <p className={styles.empty}>Nenhum pedido aguardando você.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>QUEM</th>
                  <th>HOJE</th>
                  <th>PEDE</th>
                  <th>MOTIVO</th>
                  <th>DECISÃO</th>
                </tr>
              </thead>
              <tbody>
                {toDecide.map((r) => {
                  const who = byId.get(r.userId);
                  const allowed = canDecide(user, r);
                  return (
                    <tr key={r.id}>
                      <td>
                        <strong>{who?.name ?? "—"}</strong>
                        <br />
                        <span className={styles.muted}>{who?.email}</span>
                      </td>
                      <td className={styles.muted}>
                        {who ? `${ROLE_LABEL[who.role]} · ${who.segments.join(" + ")}` : "—"}
                      </td>
                      <td>
                        <strong>{describeRequest(r)}</strong>
                      </td>
                      <td className={styles.muted}>{r.note || "—"}</td>
                      <td>
                        {allowed ? (
                          <form action={decide} className={styles.actions}>
                            <input type="hidden" name="requestId" value={r.id} />
                            <button
                              type="submit"
                              name="decision"
                              value="aprovar"
                              className={styles.primary}
                            >
                              Aprovar
                            </button>
                            <button
                              type="submit"
                              name="decision"
                              value="recusar"
                              className={styles.secondary}
                            >
                              Recusar
                            </button>
                          </form>
                        ) : (
                          <span className={styles.muted}>Fora da sua alçada</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {history.length > 0 && (
        <section className={styles.stack} aria-labelledby="historico">
          <h2 id="historico" className={styles.h2}>
            Histórico
          </h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>QUEM</th>
                  <th>PEDIU</th>
                  <th>STATUS</th>
                  <th>DECIDIDO POR</th>
                </tr>
              </thead>
              <tbody>
                {history.map((r) => (
                  <tr key={r.id}>
                    <td>{byId.get(r.userId)?.name ?? "—"}</td>
                    <td>{describeRequest(r)}</td>
                    <td className={styles.status}>{STATUS_LABEL[r.status]}</td>
                    <td className={styles.muted}>{r.decidedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </AppShell>
  );
}
