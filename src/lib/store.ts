import type { AccessRequest, Client, Orientation, Role, Segment, User } from "./domain";

// Banco SIMULADO, em memória: zera toda vez que o servidor reinicia.
// Será trocado pelo Supabase; as funções abaixo são o contrato que as telas usam.

type Db = {
  users: User[];
  requests: AccessRequest[];
  clients: Client[];
  orientations: Orientation[];
  seq: number;
};

const SEED_DATE = "2026-10-01T12:00:00.000Z";

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

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

    // Dados de EXEMPLO (do handoff do design). Na versão real vêm do cadastro,
    // de planilha importada ou de integração com outro sistema.
    clients: [
      { id: "c-lumen", name: "Lumen Saúde", segment: "7D", ownerId: "u-onb-7d", stage: "Activation & Monitoring", stageSince: daysAgo(12) },
      { id: "c-vertice", name: "Vértice Log", segment: "7D", ownerId: "u-onb-7d", stage: "Ready for Activation", stageSince: daysAgo(4) },
      { id: "c-andrade", name: "Grupo Andrade", segment: "7D", ownerId: "u-onb-7d", stage: "Welcome", stageSince: daysAgo(3) },
      { id: "c-nobre", name: "Casa Nobre", segment: "7D", ownerId: "u-onb-7d", stage: "Pre Onboarding", stageSince: daysAgo(1) },
      { id: "c-orbita", name: "Órbita Pay", segment: "8D", ownerId: "u-onb-8d", stage: "Product Migration", stageSince: daysAgo(6) },
      { id: "c-ferraz", name: "Ferraz & Filhos", segment: "8D", ownerId: "u-onb-8d", stage: "Activation & Monitoring", stageSince: daysAgo(2) },
    ],
    orientations: [
      { id: "o-1", scope: "cliente", clientId: "c-lumen", stage: "Activation & Monitoring", priority: 1, source: "ia", manualRef: "Manual 7D §5.1",
        title: "Lumen Saúde: uso caiu para 32%", description: "Abaixo de 40% na primeira quinzena. O manual pede contato com o responsável em até 48h." },
      { id: "o-2", scope: "cliente", clientId: "c-vertice", stage: "Ready for Activation", priority: 2, source: "ia", manualRef: "Manual 7D §4.3",
        title: "Vértice Log: go-live em 2 dias", description: "Faça o teste final com o responsável técnico e peça o aceite formal por e-mail." },
      { id: "o-3", scope: "cliente", clientId: "c-andrade", stage: "Welcome", priority: 3, source: "lideranca", manualRef: "Manual 7D §2.2",
        title: "Grupo Andrade sem resposta há 3 dias", description: "Kit de boas-vindas enviado sem retorno. Reenvie e ligue antes de escalar." },
      { id: "o-4", scope: "cliente", clientId: "c-nobre", stage: "Pre Onboarding", priority: 4, source: "lideranca", manualRef: "Manual 7D §1.1",
        title: "Casa Nobre: agendar o kickoff", description: "Contrato assinado ontem. Kickoff até sexta, com o responsável técnico confirmado." },
      { id: "o-5", scope: "cliente", clientId: "c-orbita", stage: "Product Migration", priority: 2, source: "ia", manualRef: "Manual 8D §3.4",
        title: "Órbita Pay: migração parada há 6 dias", description: "Confirme com o time técnico do cliente se o acesso à base antiga foi liberado." },
      { id: "o-6", scope: "segmento", segment: "7D", priority: 1, source: "lideranca", manualRef: "Manual 7D §3.2",
        title: "Checklist de migração v3 publicado", description: "Substitui a v2 em todos os clientes N4 e N5." },
      { id: "o-7", scope: "segmento", segment: "7D", stage: "Activation & Monitoring", priority: 2, source: "lideranca", manualRef: "Manual 7D §5",
        title: "Revisão semanal de Activation & Monitoring", description: "Quinta, 10h, com a liderança." },
      { id: "o-8", scope: "segmento", segment: "8D", priority: 1, source: "lideranca", manualRef: "Manual 8D §1.3",
        title: "Kickoff 8D sempre com sponsor executivo", description: "Sem sponsor confirmado, remarque o kickoff." },
      { id: "o-9", scope: "geral", priority: 1, source: "lideranca", manualRef: "Manual §1.4",
        title: "Go-live só com aceite formal por e-mail", description: "Nova regra a partir de hoje." },
      { id: "o-10", scope: "geral", priority: 2, source: "lideranca", manualRef: "Manual §2",
        title: "Treinamento do novo fluxo de migração", description: "Sexta, 15h · obrigatório para N2+." },
    ],
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

export async function listClients(): Promise<Client[]> {
  return [...db.clients];
}

// Cria ou atualiza clientes vindos da planilha. Chave: id_externo, se houver;
// senão, nome + segmento. Clientes que não estão na planilha ficam como estão.
export async function upsertClients(
  rows: Omit<Client, "id">[],
): Promise<{ created: number; updated: number }> {
  const key = (c: Pick<Client, "externalId" | "name" | "segment">) =>
    c.externalId ? `ext:${c.externalId}` : `nome:${c.name.trim().toLowerCase()}|${c.segment}`;
  const index = new Map(db.clients.map((c) => [key(c), c]));
  let created = 0;
  let updated = 0;
  for (const row of rows) {
    const existing = index.get(key(row));
    if (existing) {
      Object.assign(existing, row);
      updated += 1;
    } else {
      const client = { ...row, id: nextId("c") };
      db.clients.push(client);
      index.set(key(client), client);
      created += 1;
    }
  }
  return { created, updated };
}

export async function listOrientations(): Promise<Orientation[]> {
  return [...db.orientations];
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
  if (request.segments?.length) user.segments = request.segments;
  user.grantedBy = approver.name;
  user.grantedAt = now;
}
