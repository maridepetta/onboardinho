import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "./domain";
import { getUser } from "./store";

// Sessão SIMULADA: um cookie com o id do usuário, escolhido em /entrar.
// Será trocada pelo login de verdade (e-mail + senha via Supabase).

export const SESSION_COOKIE = "trilho_uid";

export async function getCurrentUser(): Promise<User | null> {
  const id = (await cookies()).get(SESSION_COOKIE)?.value;
  return id ? ((await getUser(id)) ?? null) : null;
}

// Para páginas do app: sem sessão → /entrar; primeiro acesso pendente → /primeiro-acesso.
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  if (!user.confirmedAt) redirect("/primeiro-acesso");
  return user;
}
