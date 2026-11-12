import type {
  Allocation,
  ConsultingRoom,
  Course,
  FloorTransportMove,
  Machine,
  Shift,
  ShiftDemand,
  ShiftTransitionReport,
} from '@/domain/types';

export interface FormatShiftWhatsAppInput {
  shift: Shift;
  demands: ReadonlyArray<ShiftDemand>;
  allocations: ReadonlyArray<Allocation>;
  courses: ReadonlyArray<Course>;
  rooms: ReadonlyArray<ConsultingRoom>;
  machines: ReadonlyArray<Machine>;
}

/**
 * RF07 / DEC-04 — Gera o texto oficial do turno no padrão de WhatsApp da Nexus:
 * - Agrupa as salas por curso;
 * - Adiciona `*2° ANDAR*` automaticamente quando o curso utiliza salas do 2º pavimento (§2.1);
 * - Exibe o código limpo do equipamento (`V6`, `V7`, `SIGNATURE`) sem o sufixo interno (`#01`).
 */
export function formatShiftWhatsAppText(input: FormatShiftWhatsAppInput): string {
  const coursesById = new Map(input.courses.map((c) => [c.id, c]));
  const roomsById = new Map(input.rooms.map((r) => [r.id, r]));
  const machinesById = new Map(input.machines.map((m) => [m.id, m]));

  const lines: string[] = [`*=== ${input.shift.label} ===*`];

  if (input.allocations.length === 0) {
    lines.push('_Nenhuma alocação registrada neste turno._');
    return lines.join('\n');
  }

  for (const demand of input.demands) {
    const courseAllocations = input.allocations
      .filter((a) => a.demandId === demand.id)
      .sort((a, b) => {
        const rA = roomsById.get(a.roomId);
        const rB = roomsById.get(b.roomId);
        if ((rA?.floor ?? 1) !== (rB?.floor ?? 1)) return (rA?.floor ?? 1) - (rB?.floor ?? 1);
        return (rA?.roomNumber ?? 0) - (rB?.roomNumber ?? 0);
      });

    if (courseAllocations.length === 0) continue;

    const course = coursesById.get(demand.courseId);
    const usesSecondFloor = courseAllocations.some(
      (a) => roomsById.get(a.roomId)?.floor === 2,
    );
    const floorTag = usesSecondFloor ? ' *2° ANDAR*' : '';

    lines.push('');
    lines.push(`*${course?.shortName ?? demand.courseId}*${floorTag}`);

    for (const alloc of courseAllocations) {
      const room = roomsById.get(alloc.roomId);
      const machine = machinesById.get(alloc.machineId);
      const roomNumLabel = room ? `SALA ${String(room.roomNumber).padStart(2, '0')}` : alloc.roomId;
      const machineCode = machine?.code ?? alloc.machineId.toUpperCase();
      lines.push(`${roomNumLabel}: ${machineCode}`);
    }
  }

  return lines.join('\n');
}

export interface FormatWeekWhatsAppInput {
  title: string;
  shifts: ReadonlyArray<FormatShiftWhatsAppInput>;
  footerNote?: string;
}

export function formatWeekWhatsAppText(input: FormatWeekWhatsAppInput): string {
  const activeBlocks = input.shifts
    .filter((s) => s.allocations.length > 0)
    .map((s) => formatShiftWhatsAppText(s));

  const parts: string[] = [`*ESCALA NEXUS — ${input.title.toUpperCase()}*`];
  if (activeBlocks.length === 0) {
    parts.push('\n_Nenhuma sala alocada na escala._');
  } else {
    parts.push('', activeBlocks.join('\n\n'));
  }

  if (input.footerNote && input.footerNote.trim()) {
    parts.push('', input.footerNote.trim());
  }

  return parts.join('\n');
}

/**
 * RF06 — Gera o Relatório de Logística (Transição entre Turnos) comparando
 * onde cada aparelho estava no Turno A e para onde vai no Turno B.
 */
export function buildShiftTransitionReport(params: {
  fromShift: Shift;
  toShift: Shift;
  fromAllocations: ReadonlyArray<Allocation>;
  toAllocations: ReadonlyArray<Allocation>;
  toDemands: ReadonlyArray<ShiftDemand>;
  machines: ReadonlyArray<Machine>;
  rooms: ReadonlyArray<ConsultingRoom>;
  courses: ReadonlyArray<Course>;
}): ShiftTransitionReport {
  const machinesById = new Map(params.machines.map((m) => [m.id, m]));
  const roomsById = new Map(params.rooms.map((r) => [r.id, r]));
  const coursesById = new Map(params.courses.map((c) => [c.id, c]));
  const demandsById = new Map(params.toDemands.map((d) => [d.id, d]));

  const prevAllocByMachine = new Map<string, Allocation>();
  for (const prev of params.fromAllocations) {
    prevAllocByMachine.set(prev.machineId, prev);
  }

  const stayingInSameRoom: ShiftTransitionReport['stayingInSameRoom'] = [];
  const movingWithinSameFloor: ShiftTransitionReport['movingWithinSameFloor'] = [];
  const movingBetweenFloors: FloorTransportMove[] = [];

  for (const next of params.toAllocations) {
    const machine = machinesById.get(next.machineId);
    const toRoom = roomsById.get(next.roomId);
    const demand = demandsById.get(next.demandId);
    const course = demand ? coursesById.get(demand.courseId) : undefined;
    if (!machine || !toRoom) continue;

    const courseShortName = course?.shortName ?? demand?.courseId ?? '';
    const prev = prevAllocByMachine.get(next.machineId);
    if (!prev) continue;

    const fromRoom = roomsById.get(prev.roomId);
    if (!fromRoom) continue;

    if (fromRoom.id === toRoom.id) {
      stayingInSameRoom.push({
        roomId: toRoom.id,
        machineId: machine.id,
        machineLabel: machine.internalLabel,
        courseShortName,
      });
    } else if (fromRoom.floor === toRoom.floor) {
      movingWithinSameFloor.push({
        fromRoomId: fromRoom.id,
        toRoomId: toRoom.id,
        floor: toRoom.floor,
        machineId: machine.id,
        machineLabel: machine.internalLabel,
        courseShortName,
      });
    } else {
      movingBetweenFloors.push({
        machineId: machine.id,
        machineLabel: machine.internalLabel,
        machineCode: machine.code,
        mobility: machine.mobility,
        fromFloor: fromRoom.floor,
        toFloor: toRoom.floor,
        fromRoomId: fromRoom.id,
        toRoomId: toRoom.id,
        courseShortName,
      });
    }
  }

  return {
    fromShiftLabel: params.fromShift.label,
    toShiftLabel: params.toShift.label,
    stayingInSameRoom,
    movingWithinSameFloor,
    movingBetweenFloors,
  };
}

export interface SwapOrAssignOutcome {
  mode: 'DIRECT' | 'SWAP_REQUIRED';
  conflictRoomId?: string;
  conflictMachineId?: string;
  directAllocations?: Allocation[];
  swappedAllocations: Allocation[];
}

/**
 * RN10 — Avalia a troca manual de uma máquina em um consultório:
 * - Se a máquina está livre no turno, aplica diretamente (`mode: 'DIRECT'`);
 * - Se a máquina já está alocada em outra sala do mesmo turno, retorna
 *   `mode: 'SWAP_REQUIRED'` com a permuta pronta (`swappedAllocations`).
 */
export function evaluateManualMachineChange(
  allocations: ReadonlyArray<Allocation>,
  targetRoomId: string,
  newMachineId: string,
): SwapOrAssignOutcome {
  const targetAlloc = allocations.find((a) => a.roomId === targetRoomId);
  if (!targetAlloc) {
    throw new Error(`Consultório '${targetRoomId}' não possui alocação ativa neste turno.`);
  }

  const existingHolder = allocations.find(
    (a) => a.machineId === newMachineId && a.roomId !== targetRoomId,
  );

  if (!existingHolder) {
    const updated = allocations.map((a) =>
      a.roomId === targetRoomId
        ? {
            ...a,
            machineId: newMachineId,
            matchQuality: 'MANUAL' as const,
            isPinned: true,
            inherited: false,
          }
        : a,
    );
    return {
      mode: 'DIRECT',
      directAllocations: updated,
      swappedAllocations: updated,
    };
  }

  const oldMachineInTarget = targetAlloc.machineId;
  const swapped = allocations.map((a) => {
    if (a.roomId === targetRoomId) {
      return {
        ...a,
        machineId: newMachineId,
        matchQuality: 'MANUAL' as const,
        isPinned: true,
        inherited: false,
      };
    }
    if (a.roomId === existingHolder.roomId) {
      return {
        ...a,
        machineId: oldMachineInTarget,
        matchQuality: 'MANUAL' as const,
        isPinned: true,
        inherited: false,
      };
    }
    return a;
  });

  return {
    mode: 'SWAP_REQUIRED',
    conflictRoomId: existingHolder.roomId,
    conflictMachineId: oldMachineInTarget,
    swappedAllocations: swapped,
  };
}

