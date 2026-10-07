"use client";

import { useActionState } from "react";
import { importClients } from "@/app/actions";
import styles from "@/components/app/app.module.css";

export function ImportForm() {
  const [state, action, pending] = useActionState(importClients, undefined);

  return (
    <form key={state?.attempt ?? 0} action={action} className={styles.form}>
      <div className={styles.field}>
        <label htmlFor="arquivo">Planilha (.csv)</label>
        <input
          id="arquivo"
          name="arquivo"
          type="file"
          accept=".csv,text/csv"
          required
          className={styles.input}
        />
      </div>
      <div className={`${styles.formFull} ${styles.actions}`}>
        <button type="submit" className={styles.primary} disabled={pending}>
          {pending ? "Importando…" : "Importar"}
        </button>
        <a href="/clientes/modelo" className={styles.secondary} download>
          Baixar planilha modelo
        </a>
      </div>

      {state?.errors && (
        <div className={`${styles.formFull} ${styles.error}`} role="alert">
          <p className={styles.errorTitle}>Nada foi importado. Corrija e envie de novo:</p>
          <ul className={styles.errorList}>
            {state.errors.slice(0, 20).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          {state.errors.length > 20 && <p>…e mais {state.errors.length - 20} erros.</p>}
        </div>
      )}
      {state?.created !== undefined && (
        <p className={`${styles.formFull} ${styles.success}`} role="status">
          Importado: {state.created} {state.created === 1 ? "cliente novo" : "clientes novos"} e{" "}
          {state.updated} {state.updated === 1 ? "atualizado" : "atualizados"}.
        </p>
      )}
    </form>
  );
}
