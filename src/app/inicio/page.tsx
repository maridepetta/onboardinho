import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ROLE_LABEL, SEGMENTS, describeRequest } from "@/lib/domain";
import {
  TABS,
  buildQueue,
  clientsNeedingAction,
  daysSince,
  isTab,
  tabLabel,
  type QueueItem,
  type Tab,
} from "@/lib/queue";
import { requireUser } from "@/lib/session";
import { listClients, listOrientations, listRequests } from "@/lib/store";
import { AppShell } from "@/components/app/AppShell";
import { ArrowIcon } from "@/components/icons";
import styles from "./home.module.css";

export const metadata: Metadata = { title: "Início · Onboardinho" };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const TZ = "America/Sao_Paulo";
const LONG_IN_STAGE = 10; // dias; acima disso o tempo na etapa aparece em destaque

export default function InicioPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={null}>
      <Inicio searchParams={searchParams} />
    </Suspense>
  );
}

function greeting(now: Date) {
  const hour = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", timeZone: TZ }).format(now));
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

async function Inicio({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const { aba } = await searchParams;
  await connection(); // usa a data de hoje: sempre renderiza na hora do pedido
  const tab: Tab = isTab(aba) ? aba : "carteira";

  const [clients, orientations, requests] = await Promise.all([
    listClients(),
    listOrientations(),
    listRequests(),
  ]);
  const portfolio = buildQueue(user, "carteira", clients, orientations);
  const queue = tab === "carteira" ? portfolio : buildQueue(user, tab, clients, orientations);
  const needing = clientsNeedingAction(portfolio);

  const mine = requests.filter((r) => r.userId === user.id);
  const pending = mine.find((r) => r.status === "pendente");

  const now = new Date();
  const date = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: TZ,
  }).format(now);
  const firstName = user.name.split(" ")[0];
  const lead = user.role === "lideranca";
  const levels = user.segments
    .map((code) => SEGMENTS.find((s) => s.code === code)?.levels.replace("Clientes ", ""))
    .join(" · ");

  let headline: string;
  if (needing === 0) headline = lead ? "Nenhum cliente do time com ação hoje." : "Nenhum cliente seu precisa de ação hoje.";
  else if (lead) headline = `${needing} ${needing === 1 ? "cliente do time precisa" : "clientes do time precisam"} de ação hoje.`;
  else headline = `${needing} ${needing === 1 ? "cliente precisa" : "clientes precisam"} de você hoje. Comece pelo 01.`;

  return (
    <AppShell user={user} current="inicio" bleed>
      <div className={styles.split}>
        <section className={styles.poster} aria-labelledby="saudacao">
          <div className={styles.posterMain}>
            <p className={styles.date}>{date}</p>
            <h1 id="saudacao" className={styles.hello}>
              {greeting(now)}, {firstName}.
            </h1>
            <p className={styles.headline}>{headline}</p>
          </div>
          <dl className={styles.posterFacts}>
            <div>
              <dt>{ROLE_LABEL[user.role]}</dt>
              <dd>
                {user.segments.length > 1 ? "Segmentos" : "Segmento"} {user.segments.join(" + ")}
              </dd>
            </div>
            <div>
              <dt>Clientes</dt>
              <dd>{levels}</dd>
            </div>
          </dl>
        </section>

        <section className={styles.queue} aria-label="Orientações priorizadas">
          <header className={styles.queueHeader}>
            <nav className={styles.tabs} aria-label="Escopo">
              {TABS.map((t) => (
                <Link
                  key={t}
                  href={t === "carteira" ? "/inicio" : `/inicio?aba=${t}`}
                  aria-current={t === tab ? "page" : undefined}
                  className={t === tab ? styles.tabOn : styles.tab}
                >
                  {tabLabel(t, user)}
                </Link>
              ))}
            </nav>
            <p className={styles.queueNote}>
              {queue.length} {queue.length === 1 ? "orientação" : "orientações"} · ordenadas por
              urgência
            </p>
          </header>

          {pending && (
            <p className={styles.notice}>
              Seu pedido de ajuste está aguardando resposta: {describeRequest(pending)}.{" "}
              <Link href="/meu-acesso">Meu acesso</Link>
            </p>
          )}

          {queue.length === 0 ? (
            <p className={styles.empty}>
              {tab === "carteira"
                ? "Nenhuma orientação para os seus clientes agora."
                : "Nenhuma orientação nesta aba agora."}
            </p>
          ) : (
            <ol className={styles.list}>
              {queue.map((item, i) => (
                <QueueRow key={item.id} item={item} index={i} now={now} />
              ))}
            </ol>
          )}

          {queue.length > 0 && (
            <footer className={styles.queueFooter}>
              <a href="#item-1" className={styles.primary}>
                Começar pelo 01
                <ArrowIcon />
              </a>
            </footer>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function QueueRow({ item, index, now }: { item: QueueItem; index: number; now: Date }) {
  const days = item.client ? daysSince(item.client.stageSince, now) : null;
  const stage = item.client?.stage ?? item.stage;
  return (
    <li id={`item-${index + 1}`} tabIndex={-1} className={styles.item}>
      <span className={index === 0 ? styles.numFirst : styles.num} aria-hidden="true">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className={styles.itemBody}>
        <h2 className={styles.itemTitle}>{item.title}</h2>
        <p className={styles.itemText}>{item.description}</p>
        <div className={styles.tags}>
          {stage && <span className={styles.tagStage}>{stage}</span>}
          <span className={styles.tagManual}>{item.manualRef}</span>
          {item.source === "ia" && <span className={styles.tagAi}>Sugestão da IA · revisar</span>}
        </div>
      </div>
      <div className={styles.itemSide}>
        {item.client && (
          <>
            <span>{item.client.name}</span>
            <span className={days !== null && days > LONG_IN_STAGE ? styles.late : undefined}>
              {days} {days === 1 ? "dia" : "dias"} na etapa
            </span>
          </>
        )}
        {!item.client && item.segment && <span>Segmento {item.segment}</span>}
        {!item.client && !item.segment && <span>Todos os times</span>}
      </div>
    </li>
  );
}
