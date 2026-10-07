"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ROLE_LABEL, SCENARIOS, SEGMENTS, type Access } from "@/lib/access";
import {
  createProfile,
  requestAccessChange,
  type AdjustReason,
} from "@/app/onboarding/actions";
import styles from "./OnboardingFlow.module.css";

type Screen = "access" | "adjust" | "sent" | "name" | "done";

const REASONS: { id: AdjustReason; key: string; label: string }[] = [
  { id: "papel", key: "A", label: "Papel" },
  { id: "segmentacao", key: "B", label: "Segmentação" },
  { id: "outro", key: "C", label: "Outra coisa" },
];

export function OnboardingFlow({
  access,
  showScenarioSwitcher,
}: {
  access: Access;
  showScenarioSwitcher: boolean;
}) {
  const { user, grant } = access;
  const [screen, setScreen] = useState<Screen>("access");
  const [reason, setReason] = useState<AdjustReason>("segmentacao");
  const [details, setDetails] = useState("");
  const [displayName, setDisplayName] = useState(user.name);
  const [pending, startTransition] = useTransition();

  const step = screen === "name" || screen === "done" ? 1 : 0;

  function sendRequest() {
    startTransition(async () => {
      await requestAccessChange({ reason: grant ? reason : "sem-liberacao", details });
      setScreen("sent");
    });
  }

  function submitProfile() {
    startTransition(async () => {
      await createProfile({ displayName: displayName.trim() });
      setScreen("done");
    });
  }

  return (
    <div className={styles.page}>
      {showScenarioSwitcher && (
        <nav className={styles.devBar} aria-label="Cenários simulados">
          <span>DADOS SIMULADOS ·</span>
          {SCENARIOS.map((s) => (
            <Link key={s} href={`/onboarding?cenario=${s}`}>
              {s}
            </Link>
          ))}
        </nav>
      )}

      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            <TrendIcon />
          </span>
          <span className={styles.brandName}>Trilho</span>
        </div>
        <div className={styles.headerMeta}>
          <span className={styles.mono}>PASSO 1 DE 3 · SEU ACESSO</span>
          <span className={styles.emailTag}>{user.email}</span>
        </div>
      </header>

      <div className={styles.progress} aria-hidden="true">
        {[0, 1].map((i) => (
          <div key={i} className={i <= step ? styles.barOn : styles.bar} />
        ))}
      </div>

      <main className={styles.main}>
        {screen === "access" && grant && (
          <section className={styles.block}>
            <Heading kicker={`OI, ${user.name.toUpperCase()}`} title="Seu acesso já está liberado.">
              Confira se está certo. Papel e segmentação vêm da sua liberação e só quem libera
              pode alterar.
            </Heading>

            <ul className={styles.grantGrid}>
              <li className={styles.cardOn}>
                <span className={styles.cardTop}>
                  PAPEL
                  <LockIcon />
                </span>
                <span className={styles.roleValue}>{ROLE_LABEL[grant.role]}</span>
              </li>
              {SEGMENTS.map((s) => {
                const granted = grant.segments.includes(s.code);
                return (
                  <li key={s.code} className={granted ? styles.cardOn : styles.cardOff}>
                    <span className={styles.cardTop}>
                      {granted ? "LIBERADO" : "SEM ACESSO"}
                      <LockIcon />
                    </span>
                    <span className={styles.segCode}>{s.code}</span>
                    <span className={styles.mono}>{s.levels.toUpperCase()}</span>
                  </li>
                );
              })}
            </ul>

            <p className={styles.mono}>
              LIBERADO POR {grant.grantedBy.toUpperCase()} · {grant.grantedAt.toUpperCase()}
            </p>
          </section>
        )}

        {screen === "access" && !grant && (
          <section className={styles.block}>
            <Heading
              kicker={`OI, ${user.name.toUpperCase()}`}
              title="Seu acesso ainda não foi liberado."
            >
              Sem liberação, não dá para ver clientes nem orientações. Peça agora e avisamos por
              e-mail quando estiver pronto.
            </Heading>
          </section>
        )}

        {screen === "adjust" && (
          <section className={styles.block}>
            <Heading kicker="PEDIR AJUSTE" title="O que está diferente?" />
            <div className={styles.reasonGrid} role="group" aria-label="Motivo do ajuste">
              {REASONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  aria-pressed={reason === r.id}
                  className={reason === r.id ? styles.tileOn : styles.tile}
                  onClick={() => setReason(r.id)}
                >
                  <span className={styles.keyCap}>{r.key}</span>
                  <span className={styles.tileLabel}>{r.label}</span>
                </button>
              ))}
            </div>
            <div className={styles.field}>
              <label htmlFor="detalhes">Conte o que precisa mudar</label>
              <textarea
                id="detalhes"
                rows={3}
                placeholder="Ex.: atendo clientes 7D e 8D"
                className={styles.textarea}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
              />
            </div>
          </section>
        )}

        {screen === "sent" && (
          <section className={styles.block}>
            <Heading kicker="PEDIDO ENVIADO" title="Enviado para [responsável pela liberação].">
              {grant
                ? "Enquanto o ajuste não sai, você segue com o acesso atual."
                : "Avisaremos por e-mail assim que seu acesso for liberado."}
            </Heading>
          </section>
        )}

        {screen === "name" && grant && (
          <section className={styles.block}>
            <Heading
              kicker={`${ROLE_LABEL[grant.role].toUpperCase()} · ${grant.segments.join(" + ")}`}
              title="Como você quer ser chamado?"
            />
            <div className={styles.field}>
              <label htmlFor="nome">Nome de exibição</label>
              <input
                id="nome"
                type="text"
                className={styles.bigInput}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
          </section>
        )}

        {screen === "done" && (
          <section className={styles.block}>
            <Heading kicker="PERFIL CRIADO" title={`Tudo certo, ${displayName.trim()}.`}>
              Próximo passo: sua carteira de clientes.
            </Heading>
          </section>
        )}
      </main>

      <footer className={styles.footer}>
        <div>
          {(screen === "adjust" || screen === "name") && (
            <button type="button" className={styles.ghost} onClick={() => setScreen("access")}>
              <ArrowIcon flip />
              Voltar
            </button>
          )}
        </div>
        <div className={styles.actions}>
          {screen === "access" && grant && (
            <>
              <button type="button" className={styles.ghost} onClick={() => setScreen("adjust")}>
                Algo está errado
              </button>
              <Primary onClick={() => setScreen("name")}>Está certo, continuar</Primary>
            </>
          )}
          {screen === "access" && !grant && (
            <Primary onClick={sendRequest} disabled={pending}>
              Pedir liberação
            </Primary>
          )}
          {screen === "adjust" && (
            <Primary onClick={sendRequest} disabled={pending || details.trim() === ""}>
              Enviar pedido
            </Primary>
          )}
          {screen === "sent" && grant && (
            <Primary onClick={() => setScreen("name")}>Continuar com o acesso atual</Primary>
          )}
          {screen === "name" && (
            <Primary onClick={submitProfile} disabled={pending || displayName.trim() === ""}>
              Criar perfil
            </Primary>
          )}
        </div>
      </footer>
    </div>
  );
}

function Heading({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={styles.heading}>
      <span className={styles.kicker}>{kicker}</span>
      <h1 className={styles.title}>{title}</h1>
      {children && <p className={styles.lead}>{children}</p>}
    </div>
  );
}

function Primary({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" className={styles.primary} onClick={onClick} disabled={disabled}>
      {children}
      <ArrowIcon />
    </button>
  );
}

function ArrowIcon({ flip }: { flip?: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="square"
      aria-hidden="true"
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      <path d="M5 12 H19" />
      <path d="M13 6 L19 12 L13 18" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="square"
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="10" />
      <path d="M8 11 V7 A4 4 0 0 1 16 7 V11" />
    </svg>
  );
}

function TrendIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="square"
    >
      <path d="M4 18 L10 12 L14 15 L20 6" />
      <path d="M15 6 H20 V11" />
    </svg>
  );
}
