"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  ROLES,
  ROLE_LABEL,
  SEGMENTS,
  validateGrant,
  type RequestKind,
  type Role,
  type Segment,
} from "@/lib/domain";
import { confirmAccess, requestChange } from "@/app/actions";
import { ArrowIcon, LockIcon } from "@/components/icons";
import styles from "./OnboardingFlow.module.css";

// "primeiro-acesso": criar senha → confirmar acesso → início.
// "meu-acesso": ver o acesso e pedir ajuste depois do primeiro acesso.
type Mode = "primeiro-acesso" | "meu-acesso";
type Screen = "senha" | "access" | "adjust" | "sent";

export type FlowUser = {
  name: string;
  email: string;
  role: Role;
  segments: Segment[];
  grantedBy: string;
  grantedAt: string;
};

const MIN_PASSWORD = 8;

export function OnboardingFlow({
  mode,
  user,
  pendingRequest,
}: {
  mode: Mode;
  user: FlowUser;
  pendingRequest: string | null;
}) {
  const [screen, setScreen] = useState<Screen>(mode === "primeiro-acesso" ? "senha" : "access");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [kind, setKind] = useState<RequestKind>("segmentacao");
  const [wantedRole, setWantedRole] = useState<Role>(
    ROLES.find((r) => r !== user.role) ?? user.role,
  );
  const [wantedSegments, setWantedSegments] = useState<Segment[]>(user.segments);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const firstName = user.name.split(" ")[0];
  const grantedAt = new Date(user.grantedAt).toLocaleDateString("pt-BR");
  const passwordOk = password.length >= MIN_PASSWORD && password === password2;
  // Papel que valeria depois do ajuste: define se a escolha de segmento é única (onboarder).
  const targetRole = kind === "papel" ? wantedRole : user.role;
  const singleSegment = targetRole === "onboarder";
  // Virar onboarder tendo vários segmentos: precisa escolher com qual fica.
  const pickSegmentForRole = kind === "papel" && singleSegment && user.segments.length > 1;
  const sentSegments = kind === "papel" && !pickSegmentForRole ? user.segments : wantedSegments;
  const changed =
    kind === "papel" ? wantedRole !== user.role : wantedSegments.join() !== user.segments.join();
  const canSend = changed && validateGrant(targetRole, sentSegments) === null;

  function toggleSegment(code: Segment) {
    setWantedSegments((cur) =>
      singleSegment
        ? [code]
        : SEGMENTS.map((s) => s.code).filter((c) => (c === code ? !cur.includes(c) : cur.includes(c))),
    );
  }

  function chooseKind(next: RequestKind) {
    setKind(next);
    setWantedSegments(user.segments);
  }

  function confirm() {
    startTransition(() => confirmAccess());
  }

  function send() {
    setError(null);
    startTransition(async () => {
      const result = await requestChange({
        kind,
        role: wantedRole,
        segments: sentSegments,
        note,
      });
      if (result.ok) setScreen("sent");
      else setError(result.error);
    });
  }

  const steps = mode === "primeiro-acesso" ? ["senha", "access"] : [];
  const step = screen === "senha" ? 0 : 1;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.brand}>Assistente de Onboarding</span>
        <div className={styles.headerMeta}>
          <span>{mode === "primeiro-acesso" ? "Primeiro acesso" : "Meu acesso"}</span>
          <span>{user.email}</span>
        </div>
      </header>

      {steps.length > 0 && (
        <div className={styles.progress} aria-hidden="true">
          {steps.map((s, i) => (
            <div key={s} className={i <= step ? styles.barOn : styles.bar} />
          ))}
        </div>
      )}

      <main className={styles.main}>
        {screen === "senha" && (
          <section className={styles.block}>
            <Heading kicker={`Oi, ${firstName}`} title="Crie sua senha.">
              Seu usuário já foi criado. Falta só a senha para entrar.
            </Heading>
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label htmlFor="senha">Senha</label>
                <input
                  id="senha"
                  type="password"
                  autoComplete="new-password"
                  className={styles.input}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <span className={styles.hint}>Mínimo de {MIN_PASSWORD} caracteres.</span>
              </div>
              <div className={styles.field}>
                <label htmlFor="senha2">Repita a senha</label>
                <input
                  id="senha2"
                  type="password"
                  autoComplete="new-password"
                  className={styles.input}
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                />
                {password2 !== "" && password !== password2 && (
                  <span className={styles.hintError}>As senhas não são iguais.</span>
                )}
              </div>
            </div>
          </section>
        )}

        {screen === "access" && (
          <section className={styles.block}>
            <Heading
              kicker={`Oi, ${firstName}`}
              title={mode === "primeiro-acesso" ? "Seu acesso já está liberado." : "Seu acesso."}
            >
              Papel e segmentação vêm da sua liberação. Se algo estiver errado, peça ajuste: o
              pedido vai para a liderança.
            </Heading>

            <ul className={styles.grantGrid}>
              <li className={styles.cardOn}>
                <span className={styles.cardTop}>
                  PAPEL
                  <LockIcon />
                </span>
                <span className={styles.roleValue}>{ROLE_LABEL[user.role]}</span>
              </li>
              {SEGMENTS.map((s) => {
                const granted = user.segments.includes(s.code);
                return (
                  <li key={s.code} className={granted ? styles.cardOn : styles.cardOff}>
                    <span className={styles.cardTop}>
                      {granted ? "LIBERADO" : "SEM ACESSO"}
                      <LockIcon />
                    </span>
                    <span className={styles.segCode}>{s.code}</span>
                    <span className={styles.levels}>{s.levels}</span>
                  </li>
                );
              })}
            </ul>

            <p className={styles.kickerSmall}>
              Liberado por {user.grantedBy} · {grantedAt}
            </p>
            {pendingRequest && (
              <p className={styles.notice}>Pedido aguardando resposta: {pendingRequest}</p>
            )}
          </section>
        )}

        {screen === "adjust" && (
          <section className={styles.block}>
            <Heading kicker="Pedir ajuste" title="O que está diferente?" />
            <div className={styles.choiceGrid} role="group" aria-label="O que mudar">
              <Tile on={kind === "segmentacao"} k="A" onClick={() => chooseKind("segmentacao")}>
                Segmentação
              </Tile>
              <Tile on={kind === "papel"} k="B" onClick={() => chooseKind("papel")}>
                Papel
              </Tile>
            </div>

            {kind === "segmentacao" ? (
              <SegmentPicker
                legend={
                  singleSegment
                    ? "Qual deveria ser a sua segmentação? (onboarder tem uma)"
                    : "Quais segmentações você deveria ter?"
                }
                selected={wantedSegments}
                onToggle={toggleSegment}
              />
            ) : (
              <>
                <fieldset className={styles.fieldset}>
                  <legend>Qual deveria ser o seu papel?</legend>
                  <div className={styles.choiceGrid}>
                    {ROLES.map((r) => (
                      <Tile
                        key={r}
                        on={wantedRole === r}
                        k={r === user.role ? "Atual" : "Novo"}
                        onClick={() => setWantedRole(r)}
                      >
                        {ROLE_LABEL[r]}
                      </Tile>
                    ))}
                  </div>
                </fieldset>
                {pickSegmentForRole && (
                  <SegmentPicker
                    legend="Como onboarder, com qual segmentação você fica?"
                    selected={wantedSegments.length === 1 ? wantedSegments : []}
                    onToggle={toggleSegment}
                  />
                )}
              </>
            )}

            <div className={styles.field}>
              <label htmlFor="nota">Quer explicar? (opcional)</label>
              <textarea
                id="nota"
                rows={2}
                maxLength={500}
                className={styles.textarea}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
          </section>
        )}

        {screen === "sent" && (
          <section className={styles.block}>
            <Heading kicker="Pedido enviado" title="Enviado para a liderança.">
              Enquanto o ajuste não sai, você segue com o acesso atual.
            </Heading>
          </section>
        )}
      </main>

      <footer className={styles.footer}>
        <div>
          {screen === "adjust" && (
            <button type="button" className={styles.ghost} onClick={() => setScreen("access")}>
              <ArrowIcon flip />
              Voltar
            </button>
          )}
          {mode === "meu-acesso" && screen !== "adjust" && (
            <Link href="/inicio" className={styles.ghost}>
              <ArrowIcon flip />
              Início
            </Link>
          )}
        </div>
        <div className={styles.actions}>
          {screen === "senha" && (
            <Primary onClick={() => setScreen("access")} disabled={!passwordOk}>
              Continuar
            </Primary>
          )}
          {screen === "access" && !pendingRequest && (
            <button type="button" className={styles.ghost} onClick={() => setScreen("adjust")}>
              Algo está errado
            </button>
          )}
          {screen === "access" && mode === "primeiro-acesso" && (
            <Primary onClick={confirm} disabled={pending}>
              Está certo, entrar
            </Primary>
          )}
          {screen === "adjust" && (
            <Primary onClick={send} disabled={pending || !canSend}>
              Enviar pedido
            </Primary>
          )}
          {screen === "sent" && mode === "primeiro-acesso" && (
            <Primary onClick={confirm} disabled={pending}>
              Entrar com o acesso atual
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

function SegmentPicker({
  legend,
  selected,
  onToggle,
}: {
  legend: string;
  selected: Segment[];
  onToggle: (code: Segment) => void;
}) {
  return (
    <fieldset className={styles.fieldset}>
      <legend>{legend}</legend>
      <div className={styles.choiceGrid}>
        {SEGMENTS.map((s) => (
          <Tile key={s.code} on={selected.includes(s.code)} k={s.code} onClick={() => onToggle(s.code)}>
            {s.levels}
          </Tile>
        ))}
      </div>
    </fieldset>
  );
}

function Tile({
  on,
  k,
  onClick,
  children,
}: {
  on: boolean;
  k: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      className={on ? styles.tileOn : styles.tile}
      onClick={onClick}
    >
      <span className={styles.keyCap}>{k}</span>
      <span className={styles.tileLabel}>{children}</span>
    </button>
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
