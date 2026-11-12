import type { Allocation, Machine, ManualLock } from '@/domain/types';

export class DuplicateMachineAllocationError extends Error {
  readonly code = 'UNIQUE_MACHINE_PER_SHIFT';
  readonly machineId: string;
  readonly shiftId: string;

  constructor(shiftId: string, machineId: string) {
    super(
      `Violação RN10: a máquina '${machineId}' já está alocada em outro consultório no turno '${shiftId}'.`,
    );
    this.name = 'DuplicateMachineAllocationError';
    this.shiftId = shiftId;
    this.machineId = machineId;
  }
}

export class DuplicateRoomAllocationError extends Error {
  readonly code = 'UNIQUE_ROOM_PER_SHIFT';
  readonly roomId: string;
  readonly shiftId: string;

  constructor(shiftId: string, roomId: string) {
    super(
      `Violação de unicidade: o consultório '${roomId}' já possui máquina alocada no turno '${shiftId}'.`,
    );
    this.name = 'DuplicateRoomAllocationError';
    this.shiftId = shiftId;
    this.roomId = roomId;
  }
}

export class MachineInMaintenanceError extends Error {
  readonly code = 'MACHINE_IN_MAINTENANCE';
  readonly machineId: string;

  constructor(machineId: string) {
    super(
      `Violação de integridade: a máquina '${machineId}' está em manutenção e não pode ser alocada ou travada.`,
    );
    this.name = 'MachineInMaintenanceError';
    this.machineId = machineId;
  }
}

export class OptimisticConcurrencyError extends Error {
  readonly code = 'OPTIMISTIC_CONCURRENCY_CONFLICT';
  readonly status = 409;
  readonly shiftId: string;
  readonly expectedVersion: number;
  readonly currentVersion: number;

  constructor(shiftId: string, expectedVersion: number, currentVersion: number) {
    super(
      `Conflito de versão no turno '${shiftId}': esperado v${expectedVersion}, mas a versão atual é v${currentVersion}. Outro operador salvou alterações antes.`,
    );
    this.name = 'OptimisticConcurrencyError';
    this.shiftId = shiftId;
    this.expectedVersion = expectedVersion;
    this.currentVersion = currentVersion;
  }
}

/**
 * Valida que um conjunto de alocações (ou travas) de um turno respeita:
 * 1. Nenhuma máquina em manutenção (`status === 'MAINTENANCE'`);
 * 2. `UNIQUE (shift_id, machine_id)` (RN10 / RNF02);
 * 3. `UNIQUE (shift_id, room_id)`.
 */
export function assertShiftIntegrity(
  shiftId: string,
  items: ReadonlyArray<Pick<Allocation | ManualLock, 'machineId' | 'roomId'>>,
  machinesById: ReadonlyMap<string, Machine>,
): void {
  const usedMachines = new Set<string>();
  const usedRooms = new Set<string>();

  for (const item of items) {
    const machine = machinesById.get(item.machineId);
    if (!machine) {
      throw new Error(`Máquina '${item.machineId}' não encontrada no inventário.`);
    }
    if (machine.status === 'MAINTENANCE') {
      throw new MachineInMaintenanceError(item.machineId);
    }
    if (usedMachines.has(item.machineId)) {
      throw new DuplicateMachineAllocationError(shiftId, item.machineId);
    }
    if (usedRooms.has(item.roomId)) {
      throw new DuplicateRoomAllocationError(shiftId, item.roomId);
    }
    usedMachines.add(item.machineId);
    usedRooms.add(item.roomId);
  }
}

