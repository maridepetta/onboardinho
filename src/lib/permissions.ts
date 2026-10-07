import type { AccessRequest, User } from "./domain";

// Regras de quem pode o quê. Ficam aqui, isoladas e testadas,
// porque um erro nelas vaza acesso a clientes.

export function canManageUsers(user: User): boolean {
  return user.isAdmin;
}

export function canReviewRequests(user: User): boolean {
  return user.isAdmin || user.role === "lideranca";
}

// - Ninguém decide o próprio pedido.
// - Admin decide qualquer pedido.
// - Liderança decide só pedidos de segmentação, e só se todas as
//   segmentações pedidas estiverem entre as dela.
// - Mudança de papel: só admin.
export function canDecide(approver: User, request: AccessRequest): boolean {
  if (request.status !== "pendente") return false;
  if (approver.id === request.userId) return false;
  if (approver.isAdmin) return true;
  if (approver.role !== "lideranca") return false;
  if (request.kind !== "segmentacao" || !request.segments) return false;
  return request.segments.every((s) => approver.segments.includes(s));
}
