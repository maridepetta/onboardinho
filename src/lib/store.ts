import type { AccessRequest, Role, Segment, User } from "./domain";

// Banco SIMULADO, em memória: zera toda vez que o servidor reinicia.
// Será trocado pelo Supabase; as funções abaixo são o contrato que as telas usam.

type Db = { users: User[]; requests: AccessRequest[]; seq: number };

const SEED_DATE = "2026-10-01T12:00:00.000Z";

function seed(): Db {
  return {
    seq: 100,
    users: [
      {
        id: "u-admin",
        name: "Admin",
        email: "admin@empresa.com",
        role: "lideranca",
        segments: ["6D", "7D", "8D"],
        isAdmin: true,
        grantedBy: "Sistema",
        grantedAt: SEED_DATE,
        confirmedAt: SEED_DATE,
      },
      {
        id: "u-lider",
        name: "Liderança 6D/7D",
        email: "lider@empresa.com",
        role: "lideranca",
        segments: ["6D", "7D"],
        isAdmin: false,
        grantedBy: "Admin",
        grantedAt: SEED_DATE,
        confirmedAt: SEED_DATE,
      },
      {
        id: "u-onb-7d",
        name: "Onboarder 7D",
        email: "onboarder7d@empresa.com",
        role: "onboarder",
        segments: ["7D"],
        isAdmin: false,
        grantedBy: "Admin",
        grantedAt: SEED_DATE,
        confirmedAt: null,
      },
      {
        id: "u-onb-8d",
        name: "Onboarder 8D",
        email: "onboarder8d@empresa.com",
        role: "onboarder",
        segments: ["8D"],
        isAdmin: false,
        grantedBy: "Admin",
        grantedAt: SEED_DATE,
        confirmedAt: SEED_DATE,
      },
    ],
    requests: [],
  };
}

const globalForDb = globalThis as unknown as { __trilhoDb?: Db };
const db = (globalForDb.__trilhoDb ??= seed());

function nextId(prefix: string) {
  db.seq += 1;
  return `${prefix}-${db.seq}`;
}

export async function listUsers(): Promise<User[]> {
  return [...db.users];
}

export async function getUser(id: string): Promise<User | undefined> {
  return db.users.find((u) => u.id === id);
}

export async function createUser(input: {
  name: string;
  email: string;
  role: Role;
  segments: Segment[];
  isAdmin: boolean;
  grantedBy: string;
}): Promise<User> {
  if (db.users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) {
    throw new Error("Já existe um usuário com esse e-mail.");
  }
  const user: User = {
    ...input,
    id: nextId("u"),
    grantedAt: new Date().toISOString(),
    confirmedAt: null,
  };
  db.users.push(user);
  return user;
}

export async function confirmUser(id: string): Promise<void> {
  const user = db.users.find((u) => u.id === id);
  if (user && !user.confirmedAt) user.confirmedAt = new Date().toISOString();
}

export async function listRequests(): Promise<AccessRequest[]> {
  return [...db.requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getRequest(id: string): Promise<AccessRequest | undefined> {
  return db.requests.find((r) => r.id === id);
}

export async function createRequest(
  input: Pick<AccessRequest, "userId" | "kind" | "role" | "segments" | "note">,
): Promise<AccessRequest> {
  const request: AccessRequest = {
    ...input,
    id: nextId("r"),
    status: "pendente",
    createdAt: new Date().toISOString(),
  };
  db.requests.push(request);
  return request;
}

// Aprovar aplica a mudança no usuário. A checagem de permissão é de quem chama.
export async function decideRequest(
  id: string,
  approve: boolean,
  approver: Pick<User, "id" | "name">,
): Promise<void> {
  const request = db.requests.find((r) => r.id === id);
  if (!request || request.status !== "pendente") return;
  const now = new Date().toISOString();
  request.status = approve ? "aprovado" : "recusado";
  request.decidedBy = approver.name;
  request.decidedById = approver.id;
  request.decidedAt = now;
  if (!approve) return;

  const user = db.users.find((u) => u.id === request.userId);
  if (!user) return;
  if (request.kind === "papel" && request.role) user.role = request.role;
  if (request.kind === "segmentacao" && request.segments) user.segments = request.segments;
  user.grantedBy = approver.name;
  user.grantedAt = now;
}
