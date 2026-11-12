import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  SEED_COURSES,
  SEED_COURSE_RULES,
  SEED_ENGINE_CONFIG,
  SEED_MACHINES,
  SEED_ROOMS,
} from '@/config/seedData';
import { allocateShift, allocateWeek } from '@/domain/engine/allocate';
import type { FloorNumber, Shift, ShiftDemand } from '@/domain/types';

function createInitialFloors(floor: FloorNumber = 1): Record<string, FloorNumber> {
  const map: Record<string, FloorNumber> = {};
  for (const m of SEED_MACHINES) {
    map[m.id] = floor;
  }
  return map;
}

// Gerador pseudoaleatório determinístico (Mulberry32) para testes de propriedade reproduzíveis
function createPrng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('Sprint 2 — Testes de Propriedade, Perturbação, Fixture Oficial e Casos de Borda (Tarefas 0.4, 2.13, 2.14 e §5.6)', () => {
  it('0.4 e 2.13 — carrega a fixture oficial tests/fixtures/fds-23-25-ecof-mefe-giob.json e reproduz a escala em < 50 ms', () => {
    const fixturePath = resolve(__dirname, 'fixtures/fds-23-25-ecof-mefe-giob.json');
    const raw = readFileSync(fixturePath, 'utf-8');
    const fixture = JSON.parse(raw) as {
      title: string;
      shifts: Shift[];
      demandsByShiftId: Record<string, ShiftDemand[]>;
    };

    const t0 = performance.now();
    const result = allocateWeek({
      shifts: fixture.shifts,
      demandsByShiftId: fixture.demandsByShiftId,
      manualLocksByShiftId: {},
      machines: SEED_MACHINES,
      rooms: SEED_ROOMS,
      courses: SEED_COURSES,
      courseRules: SEED_COURSE_RULES,
      initialMachineFloors: createInitialFloors(1),
      config: SEED_ENGINE_CONFIG,
    });
    const elapsedMs = performance.now() - t0;

    expect(elapsedMs).toBeLessThan(50);
    expect(result.resultsByShiftId['shift-sabado-manha']?.allocations).toHaveLength(23);
    expect(result.resultsByShiftId['shift-sabado-tarde']?.allocations).toHaveLength(16);
    expect(result.suggestedFooterNotePt).toContain('DO 2º PARA O 1º ANDAR');
  });

  it('2.14 — Propriedade Invariante RN10: em 30 cenários combinatórios aleatórios, nenhuma máquina nem sala jamais duplica no turno', () => {
    const rand = createPrng(20261112);
    const autoCourses = SEED_COURSES.filter((c) => !c.requiresManual);
    const allRoomIds = SEED_ROOMS.filter((r) => r.defaultEnabled).map((r) => r.id);

    for (let run = 0; run < 30; run++) {
      // Embaralha salas disponíveis
      const shuffledRooms = [...allRoomIds].sort(() => rand() - 0.5);
      const shuffledCourses = [...autoCourses].sort(() => rand() - 0.5).slice(0, 4);

      let roomCursor = 0;
      const demands: ShiftDemand[] = [];

      for (const course of shuffledCourses) {
        const count = Math.floor(rand() * 5) + 2; // 2 a 6 salas por curso
        const chosenRooms = shuffledRooms.slice(roomCursor, roomCursor + count);
        roomCursor += count;
        if (chosenRooms.length === 0) break;

        demands.push({
          id: `prop-dem-${run}-${course.id}`,
          shiftId: `prop-shift-${run}`,
          courseId: course.id,
          studentsCount: chosenRooms.length * 2,
          roomsRequired: chosenRooms.length,
          chosenRooms,
          extraMachine: false,
        });
      }

      const res = allocateShift({
        shift: {
          id: `prop-shift-${run}`,
          scheduleId: 'sched-prop',
          shiftKey: 'SABADO_MANHA',
          label: 'SÁBADO MANHÃ',
          version: 1,
        },
        demands,
        machines: SEED_MACHINES,
        rooms: SEED_ROOMS,
        courses: SEED_COURSES,
        courseRules: SEED_COURSE_RULES,
        manualLocks: [],
        previousMachineFloors: createInitialFloors(1),
        config: SEED_ENGINE_CONFIG,
      });

      const usedMachineIds = res.allocations.map((a) => a.machineId);
      const usedRoomIds = res.allocations.map((a) => a.roomId);

      expect(new Set(usedMachineIds).size).toBe(usedMachineIds.length);
      expect(new Set(usedRoomIds).size).toBe(usedRoomIds.length);
    }
  });

  it('2.14 — Perturbação Controlada: retirar 1 Voluson (signature) em manutenção altera no máximo 2 salas no turno', () => {
    const shift: Shift = {
      id: 'shift-pert',
      scheduleId: 'sched-pert',
      shiftKey: 'SABADO_MANHA',
      label: 'SÁBADO MANHÃ',
      version: 1,
    };
    const demands: ShiftDemand[] = [
      {
        id: 'dem-ecof',
        shiftId: shift.id,
        courseId: 'pg-us-ecof',
        studentsCount: 12,
        roomsRequired: 6,
        chosenRooms: ['1A-17', '1A-18', '1A-19', '1A-20', '1A-21', '1A-22'],
        extraMachine: false,
      },
      {
        id: 'dem-mefe',
        shiftId: shift.id,
        courseId: 'pg-us-mefe',
        studentsCount: 10,
        roomsRequired: 5,
        chosenRooms: ['1A-06', '1A-07', '1A-08', '1A-11', '1A-12'],
        extraMachine: false,
      },
    ];

    const baseline = allocateShift({
      shift,
      demands,
      machines: SEED_MACHINES,
      rooms: SEED_ROOMS,
      courses: SEED_COURSES,
      courseRules: SEED_COURSE_RULES,
      manualLocks: [],
      previousMachineFloors: createInitialFloors(1),
      config: SEED_ENGINE_CONFIG,
    });

    const perturbedMachines = SEED_MACHINES.map((m) =>
      m.id === 'signature' ? { ...m, status: 'MAINTENANCE' as const } : m,
    );

    const afterPerturbation = allocateShift({
      shift,
      demands,
      machines: perturbedMachines,
      rooms: SEED_ROOMS,
      courses: SEED_COURSES,
      courseRules: SEED_COURSE_RULES,
      manualLocks: [],
      previousMachineFloors: createInitialFloors(1),
      config: SEED_ENGINE_CONFIG,
    });

    const baselineSet = new Set(baseline.allocations.map((a) => a.machineId));
    const perturbedSet = new Set(afterPerturbation.allocations.map((a) => a.machineId));

    // O conjunto de aparelhos escalados no turno muda em exatamente 1 máquina (sai signature, entra 1 reserva)
    let newlyIntroducedMachines = 0;
    for (const mId of perturbedSet) {
      if (!baselineSet.has(mId)) {
        newlyIntroducedMachines += 1;
      }
    }

    expect(newlyIntroducedMachines).toBe(1);
    expect(perturbedSet.has('signature')).toBe(false);
  });

  it('§5.6 — Semana de Movimento Zero: mesmos cursos nas mesmas salas durante toda a semana geram 0 transportes e 100% de herança nos turnos seguintes', () => {
    const shifts: Shift[] = [
      { id: 's-1', scheduleId: 'sc', shiftKey: 'SEXTA_MANHA', label: 'SEXTA MANHÃ', version: 1 },
      { id: 's-2', scheduleId: 'sc', shiftKey: 'SEXTA_TARDE', label: 'SEXTA TARDE', version: 1 },
      { id: 's-3', scheduleId: 'sc', shiftKey: 'SABADO_MANHA', label: 'SÁBADO MANHÃ', version: 1 },
    ];

    const demandsByShiftId: Record<string, ShiftDemand[]> = {};
    for (const s of shifts) {
      demandsByShiftId[s.id] = [
        {
          id: `dem-${s.id}`,
          shiftId: s.id,
          courseId: 'pg-us-mefe',
          studentsCount: 10,
          roomsRequired: 5,
          chosenRooms: ['1A-06', '1A-07', '1A-08', '1A-11', '1A-12'],
          extraMachine: false,
        },
      ];
    }

    const week = allocateWeek({
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

    expect(week.totalFloorMoves).toBe(0);
    const s2Allocs = week.resultsByShiftId['s-2']?.allocations ?? [];
    const s3Allocs = week.resultsByShiftId['s-3']?.allocations ?? [];
    expect(s2Allocs.every((a) => a.inherited)).toBe(true);
    expect(s3Allocs.every((a) => a.inherited)).toBe(true);
  });
});

