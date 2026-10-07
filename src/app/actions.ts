"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  isRole,
  isSegment,
  normalizeSegments,
  validateGrant,
  type RequestKind,
} from "@/lib/domain";
import { canDecide, canImportClients, canManageUsers } from "@/lib/permissions";
import { validateImport } from "@/lib/clientImport";
import { SESSION_COOKIE, getCurrentUser } from "@/lib/session";
import * as store from "@/lib/store";

// ---------- Sessão (simulada) ----------

export async function signInAs(formData: FormData) {
  const id = String(formData.get("userId") ?? "");
  if (!(await store.getUser(id))) return;
  (await cookies()).set(SESSION_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/" });
  revalidatePath("/", "layout"); // descarta telas em cache de outra sessão
  redirect("/");
}

export async function signOut() {
  (await cookies()).delete(SESSION_COOKIE);
  revalidatePath("/", "layout");
  redirect("/entrar");
}

// ---------- Primeiro acesso ----------

export async function confirmAccess() {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  await store.confirmUser(user.id);
  // Sem isso o /inicio em cache (de antes da confirmação) manda de volta ao primeiro acesso.
  revalidatePath("/", "layout");
  redirect("/inicio");
}

export type RequestChangeInput = {
  kind: RequestKind;
  role?: string;
  segments?: string[];
  note: string;
};

export async function requestChange(
  input: RequestChangeInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sessão expirada. Entre de novo." };

  const pending = (await store.listRequests()).some(
    (r) => r.userId === user.id && r.status === "pendente",
  );
  if (pending) return { ok: false, error: "Você já tem um pedido aguardando resposta." };

  const note = input.note.trim().slice(0, 500);

  const wantedSegments = normalizeSegments((input.segments ?? []).filter(isSegment));

  if (input.kind === "papel") {
    if (!isRole(input.role) || input.role === user.role) {
      return { ok: false, error: "Escolha um papel diferente do atual." };
    }
    // Com o papel novo, as segmentações precisam continuar válidas (onboarder: só 1).
    const segments = wantedSegments.length ? wantedSegments : user.segments;
    const invalid = validateGrant(input.role, segments);
    if (invalid) return { ok: false, error: invalid };
    await store.createRequest({ userId: user.id, kind: "papel", role: input.role, segments, note });
    return { ok: true };
  }

  if (input.kind === "segmentacao") {
    const invalid = validateGrant(user.role, wantedSegments);
    if (invalid) return { ok: false, error: invalid };
    if (wantedSegments.join() === user.segments.join()) {
      return { ok: false, error: "Essas já são as suas segmentações." };
    }
    await store.createRequest({
      userId: user.id,
      kind: "segmentacao",
      segments: wantedSegments,
      note,
    });
    return { ok: true };
  }

  return { ok: false, error: "Pedido inválido." };
}

// ---------- Pedidos ----------

export async function decide(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  const request = await store.getRequest(String(formData.get("requestId") ?? ""));
  if (!request || !canDecide(user, request)) return;
  await store.decideRequest(request.id, formData.get("decision") === "aprovar", user);
  revalidatePath("/", "layout");
}

// ---------- Usuários (admin) ----------

export type CreateUserValues = {
  name: string;
  email: string;
  role: string;
  segments: string[];
  isAdmin: boolean;
};

// `values` volta para o formulário reexibir o que foi digitado quando há erro.
export type CreateUserState =
  | { error?: string; created?: string; values?: CreateUserValues; attempt: number }
  | undefined;

export async function createUser(
  _prev: CreateUserState,
  formData: FormData,
): Promise<CreateUserState> {
  const admin = await getCurrentUser();
  const attempt = (_prev?.attempt ?? 0) + 1;
  if (!admin || !canManageUsers(admin)) return { error: "Só admin pode criar usuários.", attempt };

  const values: CreateUserValues = {
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    role: String(formData.get("role") ?? ""),
    segments: formData.getAll("segments").map(String),
    isAdmin: formData.get("isAdmin") === "on",
  };
  const fail = (error: string) => ({ error, values, attempt });

  const role = values.role;
  const segments = normalizeSegments(values.segments.filter(isSegment));
  if (!values.name) return fail("Informe o nome.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) return fail("E-mail inválido.");
  if (!isRole(role)) return fail("Escolha o papel.");
  const invalid = validateGrant(role, segments);
  if (invalid) return fail(invalid);

  try {
    await store.createUser({
      name: values.name,
      email: values.email,
      role,
      segments,
      isAdmin: values.isAdmin,
      grantedBy: admin.name,
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Não foi possível criar.");
  }
  revalidatePath("/", "layout");
  // TODO: com o Supabase, aqui sai o convite por e-mail para a pessoa criar a senha.
  return { created: values.name, attempt };
}

// ---------- Clientes (planilha) ----------

const MAX_CSV_BYTES = 1_000_000;

export type ImportState =
  | { errors?: string[]; created?: number; updated?: number; attempt: number }
  | undefined;

export async function importClients(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const attempt = (_prev?.attempt ?? 0) + 1;
  const user = await getCurrentUser();
  if (!user || !canImportClients(user)) {
    return { errors: ["Só admin e liderança importam clientes."], attempt };
  }

  const file = formData.get("arquivo");
  if (!(file instanceof File) || file.size === 0) return { errors: ["Escolha um arquivo .csv."], attempt };
  if (file.size > MAX_CSV_BYTES) return { errors: ["Arquivo maior que 1 MB."], attempt };

  const { rows, errors } = validateImport(await file.text(), await store.listUsers(), user);
  if (errors.length) return { errors, attempt };

  const { created, updated } = await store.upsertClients(rows);
  revalidatePath("/", "layout");
  return { created, updated, attempt };
}
