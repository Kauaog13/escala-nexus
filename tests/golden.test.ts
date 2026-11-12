import { describe, expect, it } from 'vitest';
import {
  SEED_COURSES,
  SEED_COURSE_RULES,
  SEED_ENGINE_CONFIG,
  SEED_MACHINES,
  SEED_ROOMS,
} from '@/config/seedData';
import { allocateWeek } from '@/domain/engine/allocate';
import {
  buildShiftTransitionReport,
  formatWeekWhatsAppText,
} from '@/domain/export/whatsappAndLogistics';
import type { FloorNumber, Shift, ShiftDemand } from '@/domain/types';

function createInitialFloors(): Record<string, FloorNumber> {
  const map: Record<string, FloorNumber> = {};
  for (const m of SEED_MACHINES) {
    map[m.id] = 1;
  }
  return map;
}

describe('Sprint 2 — Testes Golden de Escalas Operacionais Reais (Tarefa 2.13 — RN02, RN03, RN04, RN06, RN10)', () => {
  it('reproduz o cenário operacional real de Conflito Triplo (Sábado Manhã: ECOF + MEFE + GIOB) e Herança de Salas (Sábado Tarde: ECOF encerra e GIOB desce para o 1º andar)', () => {
    const sabadoManha: Shift = {
      id: 'shift-sab-manha',
      scheduleId: 'sch-golden',
      shiftKey: 'SABADO_MANHA',
      label: 'SÁBADO MANHÃ',
      version: 1,
    };
    const sabadoTarde: Shift = {
      id: 'shift-sab-tarde',
      scheduleId: 'sch-golden',
      shiftKey: 'SABADO_TARDE',
      label: 'SÁBADO TARDE',
      version: 1,
    };

    // Sábado Manhã (§2.2 e RN03):
    // - ECOF nas salas 17 a 23 (7 salas)
    // - MEFE nas salas 6, 7, 8, 11, 12, 13 (6 salas)
    // - GIOB no 2º andar (10 salas: 2A-01 a 2A-10)
    const demandsSabManha: ShiftDemand[] = [
      {
        id: 'dem-ecof-sm',
        shiftId: sabadoManha.id,
        courseId: 'pg-us-ecof',
        studentsCount: 14,
        roomsRequired: 7,
        chosenRooms: ['1A-17', '1A-18', '1A-19', '1A-20', '1A-21', '1A-22', '1A-23'],
        extraMachine: false,
      },
      {
        id: 'dem-mefe-sm',
        shiftId: sabadoManha.id,
        courseId: 'pg-us-mefe',
        studentsCount: 12,
        roomsRequired: 6,
        chosenRooms: ['1A-06', '1A-07', '1A-08', '1A-11', '1A-12', '1A-13'],
        extraMachine: false,
      },
      {
        id: 'dem-giob-sm',
        shiftId: sabadoManha.id,
        courseId: 'pg-us-giob',
        studentsCount: 20,
        roomsRequired: 10,
        chosenRooms: [], // DEC-B + RN03: motor sugere 2º andar no conflito triplo
        extraMachine: false,
      },
    ];

    // Sábado Tarde (§5 RN04 e RN06):
    // - ECOF encerrou ao meio-dia!
    // - MEFE permanece nas salas 6, 7, 8, 11, 12, 13 (6 salas)
    // - GIOB desce para o 1º andar ocupando as salas 17..23 (herdadas do ECOF) + 14, 15, 16!
    const demandsSabTarde: ShiftDemand[] = [
      {
        id: 'dem-mefe-st',
        shiftId: sabadoTarde.id,
        courseId: 'pg-us-mefe',
        studentsCount: 12,
        roomsRequired: 6,
        chosenRooms: ['1A-06', '1A-07', '1A-08', '1A-11', '1A-12', '1A-13'],
        extraMachine: false,
      },
      {
        id: 'dem-giob-st',
        shiftId: sabadoTarde.id,
        courseId: 'pg-us-giob',
        studentsCount: 20,
        roomsRequired: 10,
        chosenRooms: [
          '1A-14',
          '1A-15',
          '1A-16',
          '1A-17',
          '1A-18',
          '1A-19',
          '1A-20',
          '1A-21',
          '1A-22',
          '1A-23',
        ],
        extraMachine: false,
      },
    ];

    const weekResult = allocateWeek({
      shifts: [sabadoManha, sabadoTarde],
      demandsByShiftId: {
        [sabadoManha.id]: demandsSabManha,
        [sabadoTarde.id]: demandsSabTarde,
      },
      manualLocksByShiftId: {},
      machines: SEED_MACHINES,
      rooms: SEED_ROOMS,
      courses: SEED_COURSES,
      courseRules: SEED_COURSE_RULES,
      initialMachineFloors: createInitialFloors(),
      config: SEED_ENGINE_CONFIG,
    });

    const resManha = weekResult.resultsByShiftId[sabadoManha.id]!;
    const resTarde = weekResult.resultsByShiftId[sabadoTarde.id]!;

    // 1. Sábado Manhã: 23 alocações (7 ECOF + 6 MEFE + 10 GIOB), zero duplicidade de máquinas (RN10)
    expect(resManha.allocations).toHaveLength(23);
    const manhaMachines = resManha.allocations.map((a) => a.machineId);
    expect(new Set(manhaMachines).size).toBe(23);

    // 2. ECOF recebe máquinas de topo (Signature, Performance, S10 Expert, Resona I9, V8)
    const ecofMachines = resManha.allocations
      .filter((a) => a.demandId === 'dem-ecof-sm')
      .map((a) => a.machineId);
    expect(ecofMachines).toContain('signature');
    expect(ecofMachines).toContain('performance');
    expect(ecofMachines).toContain('s10-expert');
    expect(ecofMachines).toContain('resona-i9');
    expect(ecofMachines).toContain('v8');

    // 3. GIOB no Sábado Manhã foi alocado no 2º andar (RN03)
    const giobManhaRooms = resManha.allocations
      .filter((a) => a.demandId === 'dem-giob-sm')
      .map((a) => a.roomId);
    expect(giobManhaRooms.every((r) => r.startsWith('2A-'))).toBe(true);

    // 4. Sábado Tarde (RN06): MEFE mantém exatamente as mesmas salas e as mesmas máquinas da manhã!
    const mefeManha = resManha.allocations
      .filter((a) => a.demandId === 'dem-mefe-sm')
      .map((a) => `${a.roomId}:${a.machineId}`);
    const mefeTarde = resTarde.allocations
      .filter((a) => a.demandId === 'dem-mefe-st')
      .map((a) => `${a.roomId}:${a.machineId}`);
    expect(mefeTarde).toEqual(mefeManha);

    // 5. Sábado Tarde (RN04): GIOB herda todas as 7 máquinas deixadas pelo ECOF nas salas 1A-17 a 1A-23 sem movimentá-las!
    const ecofManhaByRoom = new Map(
      resManha.allocations
        .filter((a) => a.demandId === 'dem-ecof-sm')
        .map((a) => [a.roomId, a.machineId]),
    );
    const giobInheritedIn17To23 = resTarde.allocations.filter(
      (a) => a.demandId === 'dem-giob-st' && ecofManhaByRoom.has(a.roomId),
    );
    expect(giobInheritedIn17To23).toHaveLength(7);
    expect(
      giobInheritedIn17To23.every(
        (a) => a.inherited && a.machineId === ecofManhaByRoom.get(a.roomId),
      ),
    ).toBe(true);

    // 6. Exportação de WhatsApp e Relatório de Transição (RF06 e RF07)
    const transitionReport = buildShiftTransitionReport({
      fromShift: sabadoManha,
      toShift: sabadoTarde,
      fromAllocations: resManha.allocations,
      toAllocations: resTarde.allocations,
      toDemands: demandsSabTarde,
      machines: SEED_MACHINES,
      rooms: SEED_ROOMS,
      courses: SEED_COURSES,
    });
    // As 6 do MEFE + as 7 herdadas do ECOF permanecem na mesma sala (13 máquinas imóveis!)
    expect(transitionReport.stayingInSameRoom).toHaveLength(13);

    const whatsappText = formatWeekWhatsAppText({
      title: 'FDS 23-25',
      shifts: [
        {
          shift: sabadoManha,
          demands: demandsSabManha,
          allocations: resManha.allocations,
          courses: SEED_COURSES,
          rooms: SEED_ROOMS,
          machines: SEED_MACHINES,
        },
        {
          shift: sabadoTarde,
          demands: demandsSabTarde,
          allocations: resTarde.allocations,
          courses: SEED_COURSES,
          rooms: SEED_ROOMS,
          machines: SEED_MACHINES,
        },
      ],
      footerNote: weekResult.suggestedFooterNotePt,
    });

    expect(whatsappText).toContain('*PG US GIOB* *2° ANDAR*');
    expect(whatsappText).toContain('SALA 17: ');
    expect(whatsappText).not.toContain('#01'); // Códigos limpos no WhatsApp (DEC-04)
  });
});

