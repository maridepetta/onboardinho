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

export function describeRequest(request: Pick<AccessRequest, "kind" | "role" | "segments">): string {
  if (request.kind === "papel" && request.role) return `Papel → ${ROLE_LABEL[request.role]}`;
  return `Segmentação → ${(request.segments ?? []).join(" + ")}`;
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
  segments?: Segment[]; // segmentações pedidas (kind = segmentacao)
  note: string;
  status: RequestStatus;
  createdAt: string;
  decidedBy?: string; // nome, para exibir
  decidedById?: string;
  decidedAt?: string;
};
