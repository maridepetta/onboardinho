"use client";

import { useActionState } from "react";
import { signIn } from "@/app/actions";
import { ArrowIcon } from "@/components/icons";
import styles from "./login.module.css";

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, undefined);

  return (
    <form action={action} className={styles.form}>
      <div className={styles.field}>
        <label htmlFor="email">E-mail corporativo</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={state?.email}
          className={styles.input}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="password">Senha</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-describedby={state?.error ? "login-error" : undefined}
          className={styles.input}
        />
        {state?.error && (
          <p id="login-error" className={styles.error} role="alert">
            {state.error}
          </p>
        )}
      </div>
      <button type="submit" className={styles.primary} disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
        <ArrowIcon />
      </button>
    </form>
  );
}
