// Acesso do usuário: papel e segmentação vêm da liberação, nunca do próprio usuário.
// Hoje os dados são simulados (mock). Quando login e banco entrarem,
// só `getCurrentAccess` muda — as telas continuam iguais.

export type Role = "onboarder" | "lideranca";
export type Segment = "6D" | "7D" | "8D";

export const ROLE_LABEL: Record<Role, string> = {
  onboarder: "Onboarder",
  lideranca: "Liderança",
};

export const SEGMENTS: { code: Segment; levels: string }[] = [
  { code: "6D", levels: "Clientes N2 · N3" },
  { code: "7D", levels: "Clientes N4 · N5" },
  { code: "8D", levels: "Clientes N6+" },
];

export type Grant = {
  role: Role;
  segments: Segment[];
  grantedBy: string;
  grantedAt: string;
};

export type Access = {
  user: { name: string; email: string };
  grant: Grant | null; // null = ainda sem liberação
};

export const SCENARIOS = ["onboarder", "lideranca", "sem-liberacao"] as const;
export type Scenario = (typeof SCENARIOS)[number];

export function isScenario(value: unknown): value is Scenario {
  return typeof value === "string" && (SCENARIOS as readonly string[]).includes(value);
}

const MOCK_USER = { name: "[Nome]", email: "[email@empresa.com]" };

const MOCK_GRANTS: Record<Scenario, Grant | null> = {
  onboarder: {
    role: "onboarder",
    segments: ["7D"],
    grantedBy: "[Nome do responsável]",
    grantedAt: "[Data]",
  },
  lideranca: {
    role: "lideranca",
    segments: ["6D", "7D"],
    grantedBy: "[Nome do responsável]",
    grantedAt: "[Data]",
  },
  "sem-liberacao": null,
};

// TODO: trocar pelo usuário da sessão (login pela conta da empresa) + liberação do banco.
export async function getCurrentAccess(scenario: Scenario = "onboarder"): Promise<Access> {
  return { user: MOCK_USER, grant: MOCK_GRANTS[scenario] };
}
