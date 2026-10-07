"use client";

import { useActionState } from "react";
import { ROLES, ROLE_LABEL, SEGMENTS } from "@/lib/domain";
import { createUser } from "@/app/actions";
import styles from "@/components/app/app.module.css";

export function CreateUserForm() {
  const [state, action, pending] = useActionState(createUser, undefined);
  const v = state?.values; // preenchido só quando a última tentativa deu erro

  return (
    // key por tentativa: remonta o formulário com os valores de `v` (erro) ou vazio (sucesso),
    // em vez do reset automático do React, que apagaria o que foi digitado.
    <form key={state?.attempt ?? 0} action={action} className={styles.form}>
      <div className={styles.field}>
        <label htmlFor="name">Nome</label>
        <input id="name" name="name" required defaultValue={v?.name} className={styles.input} />
      </div>
      <div className={styles.field}>
        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          defaultValue={v?.email}
          className={styles.input}
        />
      </div>

      <fieldset className={styles.fieldset}>
        <legend>Papel</legend>
        {ROLES.map((r, i) => (
          <label key={r} className={styles.check}>
            <input type="radio" name="role" value={r} defaultChecked={v ? v.role === r : i === 0} />
            {ROLE_LABEL[r]}
          </label>
        ))}
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Segmentação</legend>
        {SEGMENTS.map((s) => (
          <label key={s.code} className={styles.check}>
            <input
              type="checkbox"
              name="segments"
              value={s.code}
              defaultChecked={v?.segments.includes(s.code)}
            />
            {s.code} <span className={styles.muted}>{s.levels}</span>
          </label>
        ))}
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Permissões</legend>
        <label className={styles.check}>
          <input type="checkbox" name="isAdmin" defaultChecked={v?.isAdmin} />
          Admin (cria usuários e decide qualquer pedido)
        </label>
      </fieldset>

      <div className={`${styles.formFull} ${styles.actions}`}>
        <button type="submit" className={styles.primary} disabled={pending}>
          Criar e enviar convite
        </button>
      </div>

      {state?.error && (
        <p className={`${styles.formFull} ${styles.error}`} role="alert">
          {state.error}
        </p>
      )}
      {state?.created && (
        <p className={`${styles.formFull} ${styles.success}`} role="status">
          {state.created} foi criado. O convite por e-mail entra junto com o banco de dados.
        </p>
      )}
    </form>
  );
}
