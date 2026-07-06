import {
  assertValidTransition,
  canTransition,
  getNextPossibleStatuses,
  InvalidBookingTransitionError,
  isFinalStatus,
} from './booking-status.util';

describe('booking status state machine', () => {
  it('worker bisa accept/reject booking pending', () => {
    expect(canTransition('pending', 'accepted', 'WORKER')).toBe(true);
    expect(canTransition('pending', 'rejected', 'WORKER')).toBe(true);
  });

  it('owner tidak bisa accept booking sendiri', () => {
    expect(canTransition('pending', 'accepted', 'OWNER')).toBe(false);
  });

  it('owner (atau admin) bisa cancel booking pending', () => {
    expect(canTransition('pending', 'cancelled', 'OWNER')).toBe(true);
    expect(canTransition('pending', 'cancelled', 'ADMIN')).toBe(true);
    expect(canTransition('pending', 'cancelled', 'WORKER')).toBe(false);
  });

  it('worker mulai & selesaikan sesi', () => {
    expect(canTransition('accepted', 'in_progress', 'WORKER')).toBe(true);
    expect(canTransition('in_progress', 'completed', 'WORKER')).toBe(true);
  });

  it('owner tidak bisa langsung selesaikan sesi', () => {
    expect(canTransition('in_progress', 'completed', 'OWNER')).toBe(false);
  });

  it('tidak ada transisi dari status final (completed/rejected/cancelled)', () => {
    expect(isFinalStatus('completed')).toBe(true);
    expect(isFinalStatus('rejected')).toBe(true);
    expect(isFinalStatus('cancelled')).toBe(true);
    expect(getNextPossibleStatuses('completed')).toEqual([]);
  });

  it('assertValidTransition throw untuk transisi ilegal', () => {
    expect(() => assertValidTransition('completed', 'in_progress', 'WORKER')).toThrow(
      InvalidBookingTransitionError,
    );
  });

  it('assertValidTransition tidak throw untuk transisi legal', () => {
    expect(() => assertValidTransition('pending', 'accepted', 'WORKER')).not.toThrow();
  });

  it('getNextPossibleStatuses("accepted") mengembalikan in_progress & cancelled', () => {
    expect(getNextPossibleStatuses('accepted').sort()).toEqual(['cancelled', 'in_progress']);
  });
});
