import { describe, expect, it } from 'vitest';
import {
  SEED_COURSES,
  SEED_COURSE_RULES,
  SEED_ENGINE_CONFIG,
  SEED_MACHINES,
  SEED_ROOMS,
} from '@/config/seedData';
import {
  allocateShift,
  allocateWeek,
  recalculateOnMachineMaintenance,
} from '@/domain/engine/allocate';
import { buildAllocationExplanation } from '@/domain/explain/buildExplanation';
import {
  filterEligibleMachinesForCourse,
  suggestRoomBlockForCourse,
} from '@/domain/rules/eligibility';
import {
  calculateClinicalFit,
  calculateFloorTransportPenalty,
  calculateProximityBonus,
  calculateStabilityBonus,
  evaluateCandidateScore,
} from '@/domain/scoring/terms';
import type { FloorNumber, Shift } from '@/domain/types';

function createInitialFloors(floor: FloorNumber = 1): Record<string, FloorNumber> {
  const map: Record<string, FloorNumber> = {};
  for (const m of SEED_MACHINES) {
    map[m.id] = floor;
  }
  return map;
}

const SAMPLE_SHIFT: Shift = {
  id: 'shift-sabado-manha',
  scheduleId: 'schedule-test',
  shiftKey: 'SABADO_MANHA',
  label: 'SÁBADO MANHÃ',
  version: 1,
};

describe('Sprint 2 — Termos do Score e Explicabilidade em PT-BR (Tarefas 2.3, 2.4 e 2.11)', () => {
  it('2.3 — calcula isoladamente Fit_Clinico (100/60/20), Bonus_PC_Laudo (30/10/0), Penalidade_Andar (5/3/2/1/0) e Bonus_Heranca (40/0)', () => {
    expect(calculateClinicalFit('IDEAL')).toBe(100);
    expect(calculateClinicalFit('SECONDARY')).toBe(60);
    expect(calculateClinicalFit('CONTINGENCY')).toBe(20);

    expect(calculateProximityBonus({ reportProximity: 30 })).toBe(30);
    expect(calculateProximityBonus({ reportProximity: 10 })).toBe(10);
    expect(calculateProximityBonus({ reportProximity: 0 })).toBe(0);

    expect(calculateFloorTransportPenalty('HEAVY', 1, 1)).toBe(0);
    expect(calculateFloorTransportPenalty('HEAVY', 2, 1)).toBe(5);
    expect(calculateFloorTransportPenalty('MEDIUM', 1, 2)).toBe(3);
    expect(calculateFloorTransportPenalty('LIGHT', 1, 2)).toBe(2);
    expect(calculateFloorTransportPenalty('PORTABLE', 1, 2)).toBe(1);

    expect(calculateStabilityBonus('1A-12', '1A-12')).toBe(40);
    expect(calculateStabilityBonus('1A-12', '1A-13')).toBe(0);
    expect(calculateStabilityBonus(undefined, '1A-12')).toBe(0);
  });

  it('2.11 — reproduz o padrão exato do few-shot reference de cálculo e justificativa em PT-BR', () => {
    const room = SEED_ROOMS.find((r) => r.id === '1A-12')!;
    const machine = SEED_MACHINES.find((m) => m.id === 'signature')!;
    const course = SEED_COURSES.find((c) => c.id === 'pg-us-ecof')!;

    const scoreResult = evaluateCandidateScore({
      quality: 'IDEAL',
      room,
      machineMobility: machine.mobility,
      currentMachineFloor: 1,
      config: SEED_ENGINE_CONFIG,
    });

    expect(scoreResult.totalScore).toBe(130);

    const exp = buildAllocationExplanation({
      allocationId: 'alloc-test',
      course,
      machine,
      room,
      quality: 'IDEAL',
      isPinned: false,
      inherited: false,
      fromFloor: 1,
      scoreResult,
    });

    expect(exp.formulaPt).toBe(
      'Score_Final = (w1 * Fit_Clinico [100]) + (w2 * Bonus_PC_Laudo [30]) - (w3 * Penalidade_Andar [0]) = 130 pts',
    );
    expect(exp.textPt).toContain('Alocado no Consultório 1A-12 (Score: 130)');
    expect(exp.textPt).toContain('Atende 100% dos requisitos de PG US ECOF');
    expect(exp.textPt).toContain('possui PC de laudo integrado (Zona 1)');
    expect(exp.textPt).toContain(
      'evita transporte entre andares (equipamento já se encontra no 1º andar)',
    );
  });

  it('2.4 — alterar os pesos em config muda a decisão do motor sem alterar o código', () => {
    const room = SEED_ROOMS.find((r) => r.id === '1A-06')!;
    // 'signature' é IDEAL (100 pts) mas digamos que está no 2º andar (HEAVY = penalidade 5);
    // 'v6-01' é SECONDARY (60 pts) mas já está no 1º andar (penalidade 0).
    const floors = createInitialFloors(1);
    floors['signature'] = 2;

    // Com w3Transport = 1 (padrão), signature (100 + 30 - 5 = 125) vence v6-01 (60 + 30 - 0 = 90)
    const resDefault = allocateShift({
      shift: SAMPLE_SHIFT,
      demands: [
        {
          id: 'dem-ecof',
          shiftId: SAMPLE_SHIFT.id,
          courseId: 'pg-us-ecof',
          studentsCount: 2,
          roomsRequired: 1,
          chosenRooms: [room.id],
          extraMachine: false,
        },
      ],
      machines: SEED_MACHINES.filter((m) => m.id === 'signature' || m.id === 'v6-01'),
      rooms: SEED_ROOMS,
      courses: SEED_COURSES,
      courseRules: SEED_COURSE_RULES,
      manualLocks: [],
      previousMachineFloors: floors,
      config: { ...SEED_ENGINE_CONFIG, w3Transport: 1 },
    });
    expect(resDefault.allocations[0]?.machineId).toBe('signature');

    // Com w3Transport = 15 (penalidade altíssima para escada), signature (100 + 30 - 75 = 55) perde para v6-01 (90)
    const resHighTransportPenalty = allocateShift({
      shift: SAMPLE_SHIFT,
      demands: [
        {
          id: 'dem-ecof',
          shiftId: SAMPLE_SHIFT.id,
          courseId: 'pg-us-ecof',
          studentsCount: 2,
          roomsRequired: 1,
          chosenRooms: [room.id],
          extraMachine: false,
        },
      ],
      machines: SEED_MACHINES.filter((m) => m.id === 'signature' || m.id === 'v6-01'),
      rooms: SEED_ROOMS,
      courses: SEED_COURSES,
      courseRules: SEED_COURSE_RULES,
      manualLocks: [],
      previousMachineFloors: floors,
      config: { ...SEED_ENGINE_CONFIG, w3Transport: 15 },
    });
    expect(resHighTransportPenalty.allocations[0]?.machineId).toBe('v6-01');
  });
});

describe('Sprint 2 — Filtro Rígido, Sugestão de Salas, Controle Manual e Upgrade (Tarefas 2.2, 2.7, 2.8, 2.9, 2.10, 2.12)', () => {
  it('2.2 — filtra máquinas em manutenção e máquinas já utilizadas no turno', () => {
    const machines = SEED_MACHINES.map((m) =>
      m.id === 'signature' ? { ...m, status: 'MAINTENANCE' as const } : m,
    );
    const used = new Set<string>(['performance']);
    const eligible = filterEligibleMachinesForCourse(
      'pg-us-ecof',
      machines,
      SEED_COURSE_RULES,
      used,
    );

    expect(eligible.some((e) => e.machine.id === 'signature')).toBe(false);
    expect(eligible.some((e) => e.machine.id === 'performance')).toBe(false);
    expect(eligible[0]?.machine.id).toBe('resona-i9');
  });

  it('2.8 — sugere salas da Zona 1 primeiro quando livres e respeita salas herdadas (DEC-B)', () => {
    const suggested = suggestRoomBlockForCourse({
      courseId: 'pg-us-ecof',
      roomsRequired: 4,
      rooms: SEED_ROOMS,
      usedRoomIds: new Set(),
    });
    expect(suggested).toEqual(['1A-05', '1A-06', '1A-07', '1A-08']);

    const suggestedWithInheritance = suggestRoomBlockForCourse({
      courseId: 'pg-us-ecof',
      roomsRequired: 3,
      rooms: SEED_ROOMS,
      usedRoomIds: new Set(),
      previousCourseRoomIds: ['1A-17', '1A-18', '1A-19'],
    });
    expect(suggestedWithInheritance).toEqual(['1A-17', '1A-18', '1A-19']);
  });

  it('2.9 — cursos de Controle Manual (Fígado e Hemodinâmica Neonatal) param e retornam aguardando decisão do operador (RN08)', () => {
    const result = allocateShift({
      shift: SAMPLE_SHIFT,
      demands: [
        {
          id: 'dem-figado',
          shiftId: SAMPLE_SHIFT.id,
          courseId: 'mod-figado-elastografia',
          studentsCount: 6,
          roomsRequired: 3,
          chosenRooms: ['1A-05', '1A-06', '1A-07'],
          extraMachine: false,
        },
        {
          id: 'dem-hemo',
          shiftId: SAMPLE_SHIFT.id,
          courseId: 'mod-hemodinamica-neonatal',
          studentsCount: 4,
          roomsRequired: 2,
          chosenRooms: ['1A-11', '1A-12'],
          extraMachine: false,
        },
      ],
      machines: SEED_MACHINES,
      rooms: SEED_ROOMS,
      courses: SEED_COURSES,
      courseRules: SEED_COURSE_RULES,
      manualLocks: [],
      previousMachineFloors: createInitialFloors(1),
      config: SEED_ENGINE_CONFIG,
    });

    expect(result.allocations).toHaveLength(0);
    expect(result.bottlenecks).toHaveLength(2);
    expect(result.bottlenecks.every((b) => b.kind === 'MANUAL_CONTROL_REQUIRED')).toBe(true);
  });

  it('2.7 — demanda impossível (> 29 salas) gera gargalo crítico e não lança exceção', () => {
    const result = allocateShift({
      shift: SAMPLE_SHIFT,
      demands: [
        {
          id: 'dem-giant',
          shiftId: SAMPLE_SHIFT.id,
          courseId: 'pg-us-giob',
          studentsCount: 64,
          roomsRequired: 32,
          chosenRooms: [],
          extraMachine: false,
        },
      ],
      machines: SEED_MACHINES,
      rooms: SEED_ROOMS,
      courses: SEED_COURSES,
      courseRules: SEED_COURSE_RULES,
      manualLocks: [],
      previousMachineFloors: createInitialFloors(1),
      config: SEED_ENGINE_CONFIG,
    });

    expect(result.bottlenecks.some((b) => b.kind === 'PARK_CAPACITY_EXCEEDED')).toBe(true);
  });

  it('2.10 — upgrade com limiar (RN05): não troca máquina quando o ganho é menor que upgradeThreshold', () => {
    // Se upgradeThreshold for 100, mesmo uma máquina IDEAL livre (ganho de +40 sobre SECONDARY) não substitui
    const initialAlloc = allocateShift({
      shift: SAMPLE_SHIFT,
      demands: [
        {
          id: 'dem-ecof',
          shiftId: SAMPLE_SHIFT.id,
          courseId: 'pg-us-ecof',
          studentsCount: 2,
          roomsRequired: 1,
          chosenRooms: ['1A-06'],
          extraMachine: false,
        },
      ],
      // Forçamos inicialmente só v6-01 (SECONDARY) ou testamos o limiar com herança
      machines: SEED_MACHINES.filter((m) => m.id === 'v6-01' || m.id === 'signature'),
      rooms: SEED_ROOMS,
      courses: SEED_COURSES,
      courseRules: SEED_COURSE_RULES,
      manualLocks: [],
      previousAllocations: [
        {
          id: 'prev-alloc',
          shiftId: 'shift-sexta-manha',
          demandId: 'dem-ecof',
          roomId: '1A-06',
          machineId: 'v6-01',
          matchQuality: 'SECONDARY',
          isPinned: false,
          inherited: false,
          score: 90,
        },
      ],
      previousMachineFloors: createInitialFloors(1),
      // Com limiar alto (50), v6-01 herdada na sala (60 + 30 + 40 = 130) não é trocada por signature (100 + 30 = 130, ganho 0 < 50)
      config: { ...SEED_ENGINE_CONFIG, upgradeThreshold: 50 },
    });

    expect(initialAlloc.allocations[0]?.machineId).toBe('v6-01');
    expect(initialAlloc.allocations[0]?.inherited).toBe(true);
  });

  it('2.12 — quebra de máquina (DEC-E) propõe a menor mudança: altera apenas a sala afetada e mantém todas as demais intactas', () => {
    const initial = allocateShift({
      shift: SAMPLE_SHIFT,
      demands: [
        {
          id: 'dem-ecof',
          shiftId: SAMPLE_SHIFT.id,
          courseId: 'pg-us-ecof',
          studentsCount: 8,
          roomsRequired: 4,
          chosenRooms: ['1A-17', '1A-18', '1A-19', '1A-20'],
          extraMachine: false,
        },
      ],
      machines: SEED_MACHINES,
      rooms: SEED_ROOMS,
      courses: SEED_COURSES,
      courseRules: SEED_COURSE_RULES,
      manualLocks: [],
      previousMachineFloors: createInitialFloors(1),
      config: SEED_ENGINE_CONFIG,
    });

    expect(initial.allocations).toHaveLength(4);
    const brokenAlloc = initial.allocations[0]!;

    const proposal = recalculateOnMachineMaintenance({
      brokenMachineId: brokenAlloc.machineId,
      shiftId: SAMPLE_SHIFT.id,
      currentAllocations: initial.allocations,
      currentExplanations: initial.explanations,
      demands: [
        {
          id: 'dem-ecof',
          shiftId: SAMPLE_SHIFT.id,
          courseId: 'pg-us-ecof',
          studentsCount: 8,
          roomsRequired: 4,
          chosenRooms: ['1A-17', '1A-18', '1A-19', '1A-20'],
          extraMachine: false,
        },
      ],
      machines: SEED_MACHINES,
      rooms: SEED_ROOMS,
      courses: SEED_COURSES,
      courseRules: SEED_COURSE_RULES,
      machineFloors: createInitialFloors(1),
      config: SEED_ENGINE_CONFIG,
    });

    expect(proposal).not.toBeNull();
    expect(proposal!.affectedRoomId).toBe(brokenAlloc.roomId);
    expect(proposal!.replacementMachineId).not.toBeNull();
    expect(proposal!.replacementMachineId).not.toBe(brokenAlloc.machineId);

    // Verifica que as outras 3 salas permaneceram exatamente com as mesmas máquinas
    const unchangedCount = proposal!.updatedAllocations.filter((u, idx) => {
      const orig = initial.allocations[idx]!;
      return u.roomId === orig.roomId && u.machineId === orig.machineId;
    }).length;
    expect(unchangedCount).toBe(3);
  });
});

describe('Sprint 2 — Propriedades, Semana Movimento Zero e Performance (< 50 ms) (Tarefa 2.14)', () => {
  it('2.14 — semana de movimento zero: mesmos cursos de manhã e à tarde geram 0 transportes entre andares e 100% de herança', () => {
    const shiftManha: Shift = {
      id: 's-manha',
      scheduleId: 'sch-1',
      shiftKey: 'SABADO_MANHA',
      label: 'SÁBADO MANHÃ',
      version: 1,
    };
    const shiftTarde: Shift = {
      id: 's-tarde',
      scheduleId: 'sch-1',
      shiftKey: 'SABADO_TARDE',
      label: 'SÁBADO TARDE',
      version: 1,
    };

    const sameDemands = (shiftId: string) => [
      {
        id: `d-mefe-${shiftId}`,
        shiftId,
        courseId: 'pg-us-mefe',
        studentsCount: 12,
        roomsRequired: 6,
        chosenRooms: ['1A-06', '1A-07', '1A-08', '1A-11', '1A-12', '1A-13'],
        extraMachine: false,
      },
    ];

    const weekResult = allocateWeek({
      shifts: [shiftManha, shiftTarde],
      demandsByShiftId: {
        [shiftManha.id]: sameDemands(shiftManha.id),
        [shiftTarde.id]: sameDemands(shiftTarde.id),
      },
      manualLocksByShiftId: {},
      machines: SEED_MACHINES,
      rooms: SEED_ROOMS,
      courses: SEED_COURSES,
      courseRules: SEED_COURSE_RULES,
      initialMachineFloors: createInitialFloors(1),
      config: SEED_ENGINE_CONFIG,
    });

    const manhaAllocs = weekResult.resultsByShiftId[shiftManha.id]!.allocations;
    const tardeAllocs = weekResult.resultsByShiftId[shiftTarde.id]!.allocations;

    expect(weekResult.totalFloorMoves).toBe(0);
    expect(tardeAllocs.every((a) => a.inherited)).toBe(true);
    expect(tardeAllocs.map((a) => a.machineId)).toEqual(manhaAllocs.map((a) => a.machineId));
  });

  it('2.6 e 2.14 — determinismo, unicidade estrita e performance < 50 ms para a semana inteira (H7)', () => {
    const shifts: Shift[] = [
      { id: 's1', scheduleId: 'w', shiftKey: 'SEXTA_MANHA', label: 'SEXTA MANHÃ', version: 1 },
      { id: 's2', scheduleId: 'w', shiftKey: 'SEXTA_TARDE', label: 'SEXTA TARDE', version: 1 },
      { id: 's3', scheduleId: 'w', shiftKey: 'SABADO_MANHA', label: 'SÁBADO MANHÃ', version: 1 },
      { id: 's4', scheduleId: 'w', shiftKey: 'SABADO_TARDE', label: 'SÁBADO TARDE', version: 1 },
      { id: 's5', scheduleId: 'w', shiftKey: 'DOMINGO_MANHA', label: 'DOMINGO MANHÃ', version: 1 },
    ];

    const demandsByShiftId: Record<string, ReturnType<typeof Array.prototype.slice>> = {};
    for (const s of shifts) {
      demandsByShiftId[s.id] = [
        {
          id: `ecof-${s.id}`,
          shiftId: s.id,
          courseId: 'pg-us-ecof',
          studentsCount: 14,
          roomsRequired: 7,
          chosenRooms: [],
          extraMachine: false,
        },
        {
          id: `mefe-${s.id}`,
          shiftId: s.id,
          courseId: 'pg-us-mefe',
          studentsCount: 12,
          roomsRequired: 6,
          chosenRooms: [],
          extraMachine: false,
        },
        {
          id: `vasc-${s.id}`,
          shiftId: s.id,
          courseId: 'pg-ecografia-vascular',
          studentsCount: 8,
          roomsRequired: 4,
          chosenRooms: [],
          extraMachine: false,
        },
      ];
    }

    const t0 = performance.now();
    const run1 = allocateWeek({
      shifts,
      demandsByShiftId,
      manualLocksByShiftId: {},
      machines: SEED_MACHINES,
      rooms: SEED_ROOMS,
      courses: SEED_COURSES,
      courseRules: SEED_COURSE_RULES,
      initialMachineFloors: createInitialFloors(1),
      config: SEED_ENGINE_CONFIG,
    });
    const elapsedMs = performance.now() - t0;

    const run2 = allocateWeek({
      shifts,
      demandsByShiftId,
      manualLocksByShiftId: {},
      machines: SEED_MACHINES,
      rooms: SEED_ROOMS,
      courses: SEED_COURSES,
      courseRules: SEED_COURSE_RULES,
      initialMachineFloors: createInitialFloors(1),
      config: SEED_ENGINE_CONFIG,
    });

    expect(elapsedMs).toBeLessThan(50);
    expect(run1).toEqual(run2);

    // Verifica unicidade matemática de máquinas e salas em todos os turnos
    for (const s of shifts) {
      const allocs = run1.resultsByShiftId[s.id]!.allocations;
      const machines = allocs.map((a) => a.machineId);
      const rooms = allocs.map((a) => a.roomId);
      expect(new Set(machines).size).toBe(machines.length);
      expect(new Set(rooms).size).toBe(rooms.length);
    }
  });
});

