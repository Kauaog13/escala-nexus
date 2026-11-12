import type {
  Allocation,
  ConsultingRoom,
  CourseMachineRule,
  Machine,
  RuleQuality,
} from '@/domain/types';

export interface EligibleMachineCandidate {
  machine: Machine;
  quality: RuleQuality;
}

const QUALITY_PRIORITY: Record<RuleQuality, number> = {
  IDEAL: 1,
  SECONDARY: 2,
  CONTINGENCY: 3,
};

/**
 * Tarefa 2.2 — Filtro rígido (Hard Constraints):
 * - Máquina ativa (`ACTIVE` ou `LOANED_TEMP`, nunca `MAINTENANCE`);
 * - Máquina ainda não utilizada no turno (`usedMachineIds`);
 * - Máquina presente na matriz de regras do curso (`courseRules`).
 * Ordenação de saída determinística: `quality` (IDEAL > SECONDARY > CONTINGENCY),
 * `tier` (1 > 2 > 3) e `id` em ordem alfabética.
 */
export function filterEligibleMachinesForCourse(
  courseId: string,
  machines: ReadonlyArray<Machine>,
  courseRules: ReadonlyArray<CourseMachineRule>,
  usedMachineIds: ReadonlySet<string>,
): EligibleMachineCandidate[] {
  const rulesByMachine = new Map<string, RuleQuality>();
  for (const r of courseRules) {
    if (r.courseId === courseId) {
      rulesByMachine.set(r.machineId, r.quality);
    }
  }

  const candidates: EligibleMachineCandidate[] = [];
  for (const machine of machines) {
    if (machine.status === 'MAINTENANCE') continue;
    if (usedMachineIds.has(machine.id)) continue;

    const quality = rulesByMachine.get(machine.id);
    if (!quality) continue;

    candidates.push({ machine, quality });
  }

  return candidates.sort((a, b) => {
    const qDiff = QUALITY_PRIORITY[a.quality] - QUALITY_PRIORITY[b.quality];
    if (qDiff !== 0) return qDiff;
    if (a.machine.tier !== b.machine.tier) return a.machine.tier - b.machine.tier;
    return a.machine.id.localeCompare(b.machine.id);
  });
}

export interface SuggestRoomBlockInput {
  courseId: string;
  roomsRequired: number;
  rooms: ReadonlyArray<ConsultingRoom>;
  usedRoomIds: ReadonlySet<string>;
  disabledRoomIds?: ReadonlySet<string>;
  previousCourseRoomIds?: ReadonlyArray<string>;
  preferSecondFloor?: boolean;
}

/**
 * Tarefa 2.8 — Sugestão automática de bloco de salas (DEC-B):
 * 1. Mantém salas herdadas do turno anterior para o mesmo curso (RN06), se livres;
 * 2. Prioriza salas com maior proximidade aos PCs de laudo (Zona 1 > Zona 2 > Zona 3),
 *    ou o 2º andar quando `preferSecondFloor` é solicitado (ex.: conflito triplo RN03);
 * 3. Desempata por andar e número da sala.
 */
export function suggestRoomBlockForCourse(input: SuggestRoomBlockInput): string[] {
  if (input.roomsRequired <= 0) return [];

  const disabled = input.disabledRoomIds ?? new Set<string>();
  const availableRooms = input.rooms.filter(
    (r) => r.defaultEnabled && !disabled.has(r.id) && !input.usedRoomIds.has(r.id),
  );
  const availableById = new Map(availableRooms.map((r) => [r.id, r]));

  const chosen: string[] = [];
  const chosenSet = new Set<string>();

  // 1. Herança de sala do mesmo curso no turno anterior (RN06)
  for (const prevRoomId of input.previousCourseRoomIds ?? []) {
    if (chosen.length >= input.roomsRequired) break;
    const room = availableById.get(prevRoomId);
    if (room && (!input.preferSecondFloor || room.floor === 2)) {
      chosen.push(room.id);
      chosenSet.add(room.id);
    }
  }

  // 2. Ordenação pelas Zonas Radiais (reportProximity DESC) e pavimento
  const remaining = availableRooms
    .filter((r) => !chosenSet.has(r.id))
    .sort((a, b) => {
      if (input.preferSecondFloor && a.floor !== b.floor) {
        return b.floor - a.floor; // 2º andar primeiro
      }
      if (!input.preferSecondFloor && a.reportProximity !== b.reportProximity) {
        return b.reportProximity - a.reportProximity; // Zona 1 (30) > Zona 2 (10) > Zona 3 (0)
      }
      if (a.floor !== b.floor) return a.floor - b.floor;
      return a.roomNumber - b.roomNumber;
    });

  for (const room of remaining) {
    if (chosen.length >= input.roomsRequired) break;
    chosen.push(room.id);
  }

  return chosen;
}

/**
 * Extrai um mapa `machineId -> roomId` das alocações do turno anterior.
 */
export function buildPreviousMachineRoomMap(
  previousAllocations: ReadonlyArray<Allocation> | undefined,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const alloc of previousAllocations ?? []) {
    map.set(alloc.machineId, alloc.roomId);
  }
  return map;
}

