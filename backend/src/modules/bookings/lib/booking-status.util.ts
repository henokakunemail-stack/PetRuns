export type BookingStatus =
  'pending' | 'accepted' | 'rejected' | 'in_progress' | 'completed' | 'cancelled';

export type Actor = 'OWNER' | 'WORKER' | 'ADMIN';

interface Transition {
  from: BookingStatus;
  to: BookingStatus;
  allowedActors: Actor[];
}

/**
 * State machine status booking. Didefinisikan sebagai data supaya gampang dibaca & di-test,
 * bukan sebagai if/else bertingkat di service.
 */
const TRANSITIONS: Transition[] = [
  { from: 'pending', to: 'accepted', allowedActors: ['WORKER'] },
  { from: 'pending', to: 'rejected', allowedActors: ['WORKER'] },
  { from: 'pending', to: 'cancelled', allowedActors: ['OWNER', 'ADMIN'] },
  { from: 'accepted', to: 'in_progress', allowedActors: ['WORKER'] },
  { from: 'accepted', to: 'cancelled', allowedActors: ['OWNER', 'WORKER', 'ADMIN'] },
  { from: 'in_progress', to: 'completed', allowedActors: ['WORKER'] },
  { from: 'in_progress', to: 'cancelled', allowedActors: ['ADMIN'] },
];

export class InvalidBookingTransitionError extends Error {
  constructor(from: BookingStatus, to: BookingStatus, actor: Actor) {
    super(`Transisi status booking tidak valid: ${from} -> ${to} (actor: ${actor})`);
    this.name = 'InvalidBookingTransitionError';
  }
}

/** Cek apakah transisi status valid untuk actor tertentu. */
export function canTransition(from: BookingStatus, to: BookingStatus, actor: Actor): boolean {
  return TRANSITIONS.some((t) => t.from === from && t.to === to && t.allowedActors.includes(actor));
}

/** Lempar error kalau transisi tidak valid — dipakai di service sebelum update DB. */
export function assertValidTransition(from: BookingStatus, to: BookingStatus, actor: Actor): void {
  if (!canTransition(from, to, actor)) {
    throw new InvalidBookingTransitionError(from, to, actor);
  }
}

/** Daftar status berikutnya yang mungkin dari status saat ini (untuk UI). */
export function getNextPossibleStatuses(from: BookingStatus): BookingStatus[] {
  return TRANSITIONS.filter((t) => t.from === from).map((t) => t.to);
}

/** Status final — tidak bisa transisi lagi ke mana pun. */
export function isFinalStatus(status: BookingStatus): boolean {
  return getNextPossibleStatuses(status).length === 0;
}
