import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSessionToken, readSessionToken } from "./auth";
import type { User } from "./domain";
import { getUser } from "./store";

// Sessão: cookie httpOnly assinado com SESSION_SECRET.
// Em produção o segredo é obrigatório; em desenvolvimento há um padrão.

export const SESSION_COOKIE = "onboardinho_session";
const MAX_AGE = 60 * 60 * 12; // 12 horas

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("Defina SESSION_SECRET (texto aleatório longo) no ambiente de produção.");
  }
  return "dev-only-secret-troque-em-producao";
}

export async function startSession(userId: string) {
  (await cookies()).set(SESSION_COOKIE, createSessionToken(userId, secret()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
  const id = readSessionToken((await cookies()).get(SESSION_COOKIE)?.value, secret());
  return id ? ((await getUser(id)) ?? null) : null;
}

// Para páginas do app: sem sessão → /entrar; primeiro acesso pendente → /primeiro-acesso.
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  if (!user.confirmedAt) redirect("/primeiro-acesso");
  return user;
}
