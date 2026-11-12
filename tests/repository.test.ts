import { describe, expect, it } from 'vitest';
import {
  DuplicateMachineAllocationError,
  DuplicateRoomAllocationError,
  MachineInMaintenanceError,
  OptimisticConcurrencyError,
} from '@/domain/rules/constraints';
import { LocalNexusDatabase } from '@/infrastructure/local/localDatabase';

describe('Sprint 1 — Repositório Local-First, CRUD e Garantias ACID (Tarefas 1.4 a 1.10)', () => {
  it('1.5 — carrega os seeds oficiais: 29 máquinas, 33 salas (12 na Zona 1) e 22 cursos', () => {
    const db = new LocalNexusDatabase({ persist: false });
    const machines = db.listMachines();
    const rooms = db.listRooms();
    const courses = db.listCourses();

    expect(machines).toHaveLength(29);
    expect(rooms).toHaveLength(33);
    expect(rooms.filter((r) => r.floor === 1)).toHaveLength(23);
    expect(rooms.filter((r) => r.floor === 2)).toHaveLength(10);
    expect(rooms.filter((r) => r.zone === 1)).toHaveLength(12);
    expect(courses).toHaveLength(22);
  });

  it('1.7 e 1.9 — executa CRUD de máquinas, alterna status e sondas e registra operador no audit_log', () => {
    const db = new LocalNexusDatabase({ persist: false });
    db.setCurrentOperator('op-2');
    db.updateOperatorName('op-2', 'Maria (Operações)');

    const updated = db.setMachineStatus('v7', 'MAINTENANCE');
    expect(updated.status).toBe('MAINTENANCE');
    expect(updated.updatedBy).toBe('Maria (Operações)');

    const afterProbe = db.toggleMachineProbe('v7', 'ELASTOGRAFIA');
    expect(afterProbe.probes).toContain('ELASTOGRAFIA');

    const demo = db.upsertMachine({
      id: 'demo-ge-01',
      code: 'VOLUSON DEMO',
      internalLabel: 'VOLUSON DEMO #01',
      brand: 'GE',
      family: 'VOLUSON',
      tier: 1,
      mobility: 'HEAVY',
      probes: ['CONVEXO', 'VOLUMETRICO_4D'],
      status: 'LOANED_TEMP',
    });
    expect(demo.id).toBe('demo-ge-01');
    expect(db.listMachines()).toHaveLength(30);

    db.deleteMachine('demo-ge-01');
    expect(db.listMachines()).toHaveLength(29);
  });

  it('1.8 — executa CRUD de cursos e atualiza matriz de máquinas preferenciais (IDEAL/SECONDARY/CONTINGENCY)', () => {
    const db = new LocalNexusDatabase({ persist: false });
    const ecofRulesBefore = db.listCourseRules('pg-us-ecof');
    expect(ecofRulesBefore.some((r) => r.machineId === 'signature' && r.quality === 'IDEAL')).toBe(
      true,
    );

    db.setCourseMachineRule('pg-us-ecof', 'v7', 'IDEAL');
    const ecofRulesAfter = db.listCourseRules('pg-us-ecof');
    expect(ecofRulesAfter.find((r) => r.machineId === 'v7')?.quality).toBe('IDEAL');

    db.setCourseMachineRule('pg-us-ecof', 'v7', null);
    expect(db.listCourseRules('pg-us-ecof').some((r) => r.machineId === 'v7')).toBe(false);
  });

  it('1.4 — rejeita duplicidade da mesma máquina no mesmo turno (RN10: UNIQUE shift_id + machine_id)', () => {
    const db = new LocalNexusDatabase({ persist: false });
    const shiftId = 'shift-sabado-manha';

    expect(() =>
      db.saveShiftTransactional({
        shiftId,
        expectedVersion: 1,
        actor: 'Operador 1',
        allocations: [
          {
            id: 'a-1',
            shiftId,
            demandId: 'd-1',
            roomId: '1A-06',
            machineId: 'v7',
            matchQuality: 'IDEAL',
            isPinned: false,
            inherited: false,
            score: 130,
          },
          {
            id: 'a-2',
            shiftId,
            demandId: 'd-2',
            roomId: '1A-14',
            machineId: 'v7',
            matchQuality: 'IDEAL',
            isPinned: false,
            inherited: false,
            score: 120,
          },
        ],
      }),
    ).toThrow(DuplicateMachineAllocationError);

    expect(db.getShift(shiftId)?.version).toBe(1);
    expect(db.listShiftAllocations(shiftId)).toHaveLength(0);
  });

  it('1.4 — rejeita duplicidade do mesmo consultório no mesmo turno (UNIQUE shift_id + room_id)', () => {
    const db = new LocalNexusDatabase({ persist: false });
    const shiftId = 'shift-sabado-manha';

    expect(() =>
      db.saveShiftTransactional({
        shiftId,
        expectedVersion: 1,
        actor: 'Operador 1',
        allocations: [
          {
            id: 'a-1',
            shiftId,
            demandId: 'd-1',
            roomId: '1A-06',
            machineId: 'signature',
            matchQuality: 'IDEAL',
            isPinned: false,
            inherited: false,
            score: 130,
          },
          {
            id: 'a-2',
            shiftId,
            demandId: 'd-1',
            roomId: '1A-06',
            machineId: 'v8',
            matchQuality: 'IDEAL',
            isPinned: false,
            inherited: false,
            score: 130,
          },
        ],
      }),
    ).toThrow(DuplicateRoomAllocationError);
  });

  it('1.4 — impede alocar ou travar máquina em manutenção (MAINTENANCE)', () => {
    const db = new LocalNexusDatabase({ persist: false });
    const shiftId = 'shift-sabado-manha';
    db.setMachineStatus('resona-i9', 'MAINTENANCE');

    expect(() =>
      db.saveShiftTransactional({
        shiftId,
        expectedVersion: 1,
        actor: 'Operador 1',
        allocations: [
          {
            id: 'a-1',
            shiftId,
            demandId: 'd-1',
            roomId: '1A-17',
            machineId: 'resona-i9',
            matchQuality: 'IDEAL',
            isPinned: false,
            inherited: false,
            score: 130,
          },
        ],
      }),
    ).toThrow(MachineInMaintenanceError);

    expect(() =>
      db.addManualLock({
        shiftId,
        roomId: '1A-17',
        machineId: 'resona-i9',
        lockedBy: 'Operador 1',
      }),
    ).toThrow(MachineInMaintenanceError);
  });

  it('1.10 — salvamento transacional com version bloqueia segundo salvamento concorrente com versão antiga (409)', () => {
    const db = new LocalNexusDatabase({ persist: false });
    const shiftId = 'shift-sabado-manha';

    // Operador A e Operador B leem a versão 1 simultaneamente
    const readVersionByOpA = db.getShift(shiftId)!.version;
    const readVersionByOpB = db.getShift(shiftId)!.version;
    expect(readVersionByOpA).toBe(1);
    expect(readVersionByOpB).toBe(1);

    // Operador A salva primeiro -> sucesso, versão sobe para 2
    const commitA = db.saveShiftTransactional({
      shiftId,
      expectedVersion: readVersionByOpA,
      actor: 'Operador A',
      allocations: [
        {
          id: 'alloc-op-a',
          shiftId,
          demandId: 'dem-1',
          roomId: '1A-06',
          machineId: 'signature',
          matchQuality: 'IDEAL',
          isPinned: false,
          inherited: false,
          score: 130,
        },
      ],
    });
    expect(commitA.shift.version).toBe(2);

    // Operador B tenta salvar usando a versão 1 que havia lido -> falha com OptimisticConcurrencyError (409)
    expect(() =>
      db.saveShiftTransactional({
        shiftId,
        expectedVersion: readVersionByOpB,
        actor: 'Operador B',
        allocations: [
          {
            id: 'alloc-op-b',
            shiftId,
            demandId: 'dem-1',
            roomId: '1A-06',
            machineId: 'v8',
            matchQuality: 'IDEAL',
            isPinned: false,
            inherited: false,
            score: 130,
          },
        ],
      }),
    ).toThrow(OptimisticConcurrencyError);

    // Dados do Operador A permanecem intactos
    const savedAllocations = db.listShiftAllocations(shiftId);
    expect(savedAllocations).toHaveLength(1);
    expect(savedAllocations[0]?.machineId).toBe('signature');
  });

  it('3.1 — suporta adição de turnos flexíveis da semana (RN01) e lançamento em regime Dia Todo (Manhã + Tarde — RN06)', () => {
    const db = new LocalNexusDatabase({ persist: false });
    const quintaManha = db.addShiftToSchedule('QUINTA_MANHA', 'Operador 1');
    expect(quintaManha.label).toBe('QUINTA MANHÃ');

    const savedBoth = db.upsertFullDayDemand(
      {
        id: 'dem-quinta-mefe',
        shiftId: quintaManha.id,
        courseId: 'pg-us-mefe',
        studentsCount: 8,
        roomsRequired: 4,
        chosenRooms: ['1A-06', '1A-07', '1A-08', '1A-11'],
        extraMachine: false,
      },
      'Operador 1',
    );

    expect(savedBoth).toHaveLength(2);
    const snap = db.getSnapshot();
    const quintaTarde = snap.shifts.find((s) => s.shiftKey === 'QUINTA_TARDE');
    expect(quintaTarde).toBeDefined();
    const tardeDemand = snap.demands.find(
      (d) => d.shiftId === quintaTarde?.id && d.courseId === 'pg-us-mefe',
    );
    expect(tardeDemand?.chosenRooms).toEqual(['1A-06', '1A-07', '1A-08', '1A-11']);
  });

  it('3.12 — clona escala para o próximo FDS herdando o andar final das máquinas no último turno como initialFloors (RF08 / DEC-C)', () => {
    const db = new LocalNexusDatabase({ persist: false });
    db.saveShiftTransactional({
      shiftId: 'shift-sabado-tarde',
      expectedVersion: 1,
      actor: 'Operador 1',
      allocations: [
        {
          id: 'alloc-2a',
          shiftId: 'shift-sabado-tarde',
          demandId: 'dem-giob-sab-t',
          roomId: '2A-05',
          machineId: 'v7',
          matchQuality: 'SECONDARY',
          isPinned: false,
          inherited: false,
          score: 60,
        },
      ],
    });

    expect(db.getSnapshot().initialFloors['v7']).toBe(1);
    const cloned = db.cloneScheduleForNextWeek('FDS 30-01 (Clonada)', 'Operador 1');
    expect(cloned.title).toBe('FDS 30-01 (Clonada)');
    expect(cloned.basedOnId).toBe('schedule-default');
    expect(db.getSnapshot().initialFloors['v7']).toBe(2);
  });
});

