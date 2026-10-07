import type { Client, Orientation, Segment, User } from "./domain";

// Fila priorizada da página inicial (design 2b). Funções puras, testadas.

export type Tab = "carteira" | "time" | "geral";

export const TABS: Tab[] = ["carteira", "time", "geral"];

export function isTab(value: unknown): value is Tab {
  return typeof value === "string" && (TABS as string[]).includes(value);
}

export function tabLabel(tab: Tab, user: Pick<User, "role" | "segments">): string {
  if (tab === "geral") return "Geral";
  if (tab === "time") return `Time ${user.segments.join(" + ")}`;
  return user.role === "lideranca" ? "Clientes do time" : "Minha carteira";
}

// Clientes que a pessoa acompanha: onboarder vê os seus; liderança, todos dos seus segmentos.
export function visibleClients(user: Pick<User, "id" | "role" | "segments">, clients: Client[]) {
  return clients.filter((c) =>
    user.role === "lideranca" ? user.segments.includes(c.segment) : c.ownerId === user.id,
  );
}

export type QueueItem = Orientation & { client?: Client };

export function buildQueue(
  user: Pick<User, "id" | "role" | "segments">,
  tab: Tab,
  clients: Client[],
  orientations: Orientation[],
): QueueItem[] {
  const mine = new Map(visibleClients(user, clients).map((c) => [c.id, c]));
  const inSegments = (s?: Segment) => !!s && user.segments.includes(s);

  const items: QueueItem[] = orientations
    .filter((o) => {
      if (tab === "carteira") return o.scope === "cliente" && !!o.clientId && mine.has(o.clientId);
      if (tab === "time") return o.scope === "segmento" && inSegments(o.segment);
      return o.scope === "geral";
    })
    .map((o) => ({ ...o, client: o.clientId ? mine.get(o.clientId) : undefined }));

  return items.sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title, "pt-BR"));
}

// Quantos clientes diferentes têm alguma ação na carteira.
export function clientsNeedingAction(queue: QueueItem[]): number {
  return new Set(queue.map((i) => i.client?.id).filter(Boolean)).size;
}

export function daysSince(iso: string, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000));
}
