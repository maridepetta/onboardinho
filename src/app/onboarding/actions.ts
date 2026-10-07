"use server";

export type AdjustReason = "papel" | "segmentacao" | "outro";

// TODO: gravar o pedido e notificar quem libera (dono do pedido ainda a definir).
export async function requestAccessChange(input: {
  reason: AdjustReason | "sem-liberacao";
  details: string;
}): Promise<{ ok: true }> {
  console.info("[onboarding] pedido de acesso", input);
  return { ok: true };
}

// TODO: salvar o nome de exibição no perfil do usuário.
export async function createProfile(input: { displayName: string }): Promise<{ ok: true }> {
  console.info("[onboarding] perfil criado", input);
  return { ok: true };
}
