import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ROLE_LABEL, describeRequest } from "@/lib/domain";
import { requireUser } from "@/lib/session";
import { listRequests } from "@/lib/store";
import { AppShell } from "@/components/app/AppShell";
import styles from "@/components/app/app.module.css";

export const metadata: Metadata = { title: "Início · Trilho" };

export default function InicioPage() {
  return (
    <Suspense fallback={null}>
      <Inicio />
    </Suspense>
  );
}

async function Inicio() {
  const user = await requireUser();
  const mine = (await listRequests()).filter((r) => r.userId === user.id);
  const pending = mine.find((r) => r.status === "pendente");
  const lastDecided = mine.find((r) => r.status !== "pendente");
  const lead = user.role === "lideranca";

  return (
    <AppShell user={user} current="inicio">
      <div className={styles.stack}>
        <p className={styles.kicker}>
          {ROLE_LABEL[user.role].toUpperCase()}
          {user.isAdmin ? " · ADMIN" : ""}
        </p>
        <h1 className={styles.title}>Oi, {user.name.split(" ")[0]}.</h1>
        <div className={styles.chips} aria-label="Suas segmentações">
          {user.segments.map((s) => (
            <span key={s} className={styles.chip}>
              {s}
            </span>
          ))}
        </div>
      </div>

      {pending && (
        <p className={styles.banner}>
          Seu pedido de ajuste está aguardando resposta: {describeRequest(pending)}.
        </p>
      )}
      {!pending && lastDecided && (
        <p className={lastDecided.status === "aprovado" ? styles.success : styles.banner}>
          Seu último pedido ({describeRequest(lastDecided)}) foi{" "}
          {lastDecided.status === "aprovado" ? "aprovado" : "recusado"} por{" "}
          {lastDecided.decidedBy}.
        </p>
      )}

      <section className={styles.stack} aria-labelledby="carteira">
        <h2 id="carteira" className={styles.h2}>
          {lead ? "Carteira do time" : "Meus clientes"}
        </h2>
        <div className={styles.empty}>
          A lista de clientes, com etapa e próxima ação sugerida pelo manual, é a próxima tela a
          ser construída.{" "}
          {user.segments.length > 0 && <>Ela vai mostrar só clientes {user.segments.join(", ")}.</>}{" "}
          <Link href="/meu-acesso">Ver meu acesso</Link>
        </div>
      </section>
    </AppShell>
  );
}
