import { UserRole } from '../../../users/domain/value-objects/user-role.js';
import type { Event } from '../../domain/entities/event.js';
import { EventAccessDeniedError } from '../errors/event-access-denied.error.js';

/** Quem executa a ação. Compatível com o usuário autenticado da camada HTTP. */
export interface Actor {
  userId: string;
  role: UserRole;
}

const EVENT_MANAGER_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.ADMIN,
  UserRole.ORGANIZER,
]);

// Repete o @Roles() do controller: o caso de uso não pode depender de a rota estar certa.
export function assertCanCreateEvents(actor: Actor): void {
  if (!EVENT_MANAGER_ROLES.has(actor.role)) {
    throw new EventAccessDeniedError();
  }
}

/** Admin gerencia qualquer evento; organizador, só os que criou. */
export function assertCanManage(event: Event, actor: Actor): void {
  const isAdmin = actor.role === UserRole.ADMIN;
  const isOwner =
    actor.role === UserRole.ORGANIZER && event.organizerId === actor.userId;

  if (!isAdmin && !isOwner) {
    throw new EventAccessDeniedError();
  }
}
