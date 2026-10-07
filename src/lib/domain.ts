// Modelo do produto: quem é cada pessoa, o que ela pode ver e os pedidos de ajuste.

export type Role = "onboarder" | "lideranca";
export type Segment = "6D" | "7D" | "8D";

export const ROLES: Role[] = ["onboarder", "lideranca"];

export const ROLE_LABEL: Record<Role, string> = {
  onboarder: "Onboarder",
  lideranca: "Liderança",
};

export const SEGMENTS: { code: Segment; levels: string }[] = [
  { code: "6D", levels: "Clientes N2 · N3" },
  { code: "7D", levels: "Clientes N4 · N5" },
  { code: "8D", levels: "Clientes N6+" },
];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as string[]).includes(value);
}

export function isSegment(value: unknown): value is Segment {
  return typeof value === "string" && SEGMENTS.some((s) => s.code === value);
}

// Ordem fixa 6D → 8D, sem repetição.
export function normalizeSegments(values: unknown[]): Segment[] {
  return SEGMENTS.map((s) => s.code).filter((code) => values.includes(code));
}

// Regra de acesso: onboarder tem exatamente 1 segmento; liderança, 1 ou mais.
// Devolve a mensagem de erro, ou null se a combinação é válida.
export function validateGrant(role: Role, segments: Segment[]): string | null {
  if (segments.length === 0) return "Escolha ao menos uma segmentação.";
  if (role === "onboarder" && segments.length !== 1) return "Onboarder tem uma segmentação só.";
  return null;
}

export function describeRequest(request: Pick<AccessRequest, "kind" | "role" | "segments">): string {
  const segs = (request.segments ?? []).join(" + ");
  if (request.kind === "papel" && request.role) {
    return `Papel → ${ROLE_LABEL[request.role]}${segs ? ` (${segs})` : ""}`;
  }
  return `Segmentação → ${segs}`;
}

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  segments: Segment[];
  isAdmin: boolean;
  grantedBy: string; // nome de quem liberou
  grantedAt: string; // ISO
  confirmedAt: string | null; // null = ainda não fez o primeiro acesso
};

export type RequestKind = "papel" | "segmentacao";
export type RequestStatus = "pendente" | "aprovado" | "recusado";

export type AccessRequest = {
  id: string;
  userId: string;
  kind: RequestKind;
  role?: Role; // papel pedido (kind = papel)
  segments?: Segment[]; // segmentações pedidas; em mudança de papel, as que valem com o papel novo
  note: string;
  status: RequestStatus;
  createdAt: string;
  decidedBy?: string; // nome, para exibir
  decidedById?: string;
  decidedAt?: string;
};

// ---------- Clientes e orientações ----------

export const STAGES = [
  "Pre Onboarding",
  "Welcome",
  "Product Migration",
  "Ready for Activation",
  "Activation & Monitoring",
  "Accomplished",
  "Unaccomplished",
] as const;
export type Stage = (typeof STAGES)[number];

export type Client = {
  id: string;
  externalId?: string; // id no sistema de origem (planilha / Astrobox)
  name: string;
  segment: Segment;
  ownerId: string; // onboarder responsável
  stage: Stage;
  stageSince: string; // ISO — base para "dias na etapa"
};

// Orientação baseada no manual.
// - geral: vale para todos os times
// - segmento: vale para um segmento
// - cliente: ação concreta para um cliente
// `source` diz quem criou: a liderança (a partir do manual) ou uma sugestão da IA.
export type OrientationScope = "geral" | "segmento" | "cliente";

export type Orientation = {
  id: string;
  title: string;
  description: string;
  scope: OrientationScope;
  segment?: Segment; // scope = segmento
  clientId?: string; // scope = cliente
  stage?: Stage;
  manualRef: string; // ex.: "Manual 7D §5.1"
  priority: number; // 1 = mais urgente
  source: "lideranca" | "ia";
};
