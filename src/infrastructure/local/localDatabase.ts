import {
  SEED_COURSES,
  SEED_COURSE_RULES,
  SEED_ENGINE_CONFIG,
  SEED_MACHINES,
  SEED_OPERATORS,
  SEED_PROBES,
  SEED_ROOMS,
} from '@/config/seedData';
import {
  OptimisticConcurrencyError,
  assertShiftIntegrity,
} from '@/domain/rules/constraints';
import type {
  Allocation,
  AllocationExplanation,
  AuditLogEntry,
  Bottleneck,
  ConsultingRoom,
  Course,
  CourseMachineRule,
  EngineConfig,
  FloorNumber,
  FloorTransportMove,
  Machine,
  MachineStatus,
  ManualLock,
  Operator,
  Probe,
  ProbeType,
  RuleQuality,
  ScheduleStatus,
  Shift,
  ShiftDemand,
  WeeklySchedule,
} from '@/domain/types';

export interface ScheduleVersionRecord {
  id: string;
  scheduleId: string;
  label: string;
  createdBy: string;
  createdAt: string;
  allocationsCount: number;
  footerNote: string;
  snapshotAllocations?: Allocation[];
  snapshotExplanations?: AllocationExplanation[];
}

export interface NexusDatabaseState {
  machines: Machine[];
  probes: Probe[];
  rooms: ConsultingRoom[];
  courses: Course[];
  courseRules: CourseMachineRule[];
  engineConfig: EngineConfig;
  schedules: WeeklySchedule[];
  shifts: Shift[];
  disabledRoomsByShiftId: Record<string, string[]>;
  demands: ShiftDemand[];
  allocations: Allocation[];
  explanations: AllocationExplanation[];
  bottlenecksByShiftId: Record<string, Bottleneck[]>;
  floorMovesByShiftId: Record<string, FloorTransportMove[]>;
  manualLocks: ManualLock[];
  initialFloors: Record<string, FloorNumber>;
  operators: Operator[];
  currentOperatorId: string;
  scheduleVersions: ScheduleVersionRecord[];
  overrideCounterByCourseId: Record<string, number>;
  auditLog: AuditLogEntry[];
}

export interface SaveShiftTransactionalInput {
  shiftId: string;
  expectedVersion: number;
  demands?: ShiftDemand[];
  allocations: Allocation[];
  explanations?: AllocationExplanation[];
  actor: string;
}

export interface WeekShiftTemplate {
  shiftKey: string;
  label: string;
  dayGroup: string;
  period: 'MANHA' | 'TARDE';
  order: number;
}

export const AVAILABLE_WEEK_SHIFTS: WeekShiftTemplate[] = [
  { shiftKey: 'SEGUNDA_MANHA', label: 'SEGUNDA MANHÃ', dayGroup: 'SEGUNDA', period: 'MANHA', order: 1 },
  { shiftKey: 'SEGUNDA_TARDE', label: 'SEGUNDA TARDE', dayGroup: 'SEGUNDA', period: 'TARDE', order: 2 },
  { shiftKey: 'TERCA_MANHA', label: 'TERÇA MANHÃ', dayGroup: 'TERCA', period: 'MANHA', order: 3 },
  { shiftKey: 'TERCA_TARDE', label: 'TERÇA TARDE', dayGroup: 'TERCA', period: 'TARDE', order: 4 },
  { shiftKey: 'QUARTA_MANHA', label: 'QUARTA MANHÃ', dayGroup: 'QUARTA', period: 'MANHA', order: 5 },
  { shiftKey: 'QUARTA_TARDE', label: 'QUARTA TARDE', dayGroup: 'QUARTA', period: 'TARDE', order: 6 },
  { shiftKey: 'QUINTA_MANHA', label: 'QUINTA MANHÃ', dayGroup: 'QUINTA', period: 'MANHA', order: 7 },
  { shiftKey: 'QUINTA_TARDE', label: 'QUINTA TARDE', dayGroup: 'QUINTA', period: 'TARDE', order: 8 },
  { shiftKey: 'SEXTA_MANHA', label: 'SEXTA MANHÃ', dayGroup: 'SEXTA', period: 'MANHA', order: 9 },
  { shiftKey: 'SEXTA_TARDE', label: 'SEXTA TARDE', dayGroup: 'SEXTA', period: 'TARDE', order: 10 },
  { shiftKey: 'SABADO_MANHA', label: 'SÁBADO MANHÃ', dayGroup: 'SABADO', period: 'MANHA', order: 11 },
  { shiftKey: 'SABADO_TARDE', label: 'SÁBADO TARDE', dayGroup: 'SABADO', period: 'TARDE', order: 12 },
  { shiftKey: 'DOMINGO_MANHA', label: 'DOMINGO MANHÃ', dayGroup: 'DOMINGO', period: 'MANHA', order: 13 },
  { shiftKey: 'DOMINGO_TARDE', label: 'DOMINGO TARDE', dayGroup: 'DOMINGO', period: 'TARDE', order: 14 },
];

const STORAGE_KEY = 'escala_nexus_db_v2';

function createInitialState(): NexusDatabaseState {
  const initialFloors: Record<string, FloorNumber> = {};
  for (const m of SEED_MACHINES) {
    initialFloors[m.id] = 1;
  }

  const defaultScheduleId = 'schedule-default';
  const defaultShifts: Shift[] = [
    {
      id: 'shift-sexta-manha',
      scheduleId: defaultScheduleId,
      shiftKey: 'SEXTA_MANHA',
      label: 'SEXTA MANHÃ',
      version: 1,
    },
    {
      id: 'shift-sexta-tarde',
      scheduleId: defaultScheduleId,
      shiftKey: 'SEXTA_TARDE',
      label: 'SEXTA TARDE',
      version: 1,
    },
    {
      id: 'shift-sabado-manha',
      scheduleId: defaultScheduleId,
      shiftKey: 'SABADO_MANHA',
      label: 'SÁBADO MANHÃ',
      version: 1,
    },
    {
      id: 'shift-sabado-tarde',
      scheduleId: defaultScheduleId,
      shiftKey: 'SABADO_TARDE',
      label: 'SÁBADO TARDE',
      version: 1,
    },
    {
      id: 'shift-domingo-manha',
      scheduleId: defaultScheduleId,
      shiftKey: 'DOMINGO_MANHA',
      label: 'DOMINGO MANHÃ',
      version: 1,
    },
  ];

  // Demandas de demonstração pré-carregadas para Sábado Manhã e Sábado Tarde (Cenário Golden RN03 & RN04)
  const defaultDemands: ShiftDemand[] = [
    {
      id: 'dem-ecof-sab-m',
      shiftId: 'shift-sabado-manha',
      courseId: 'pg-us-ecof',
      studentsCount: 14,
      roomsRequired: 7,
      chosenRooms: ['1A-17', '1A-18', '1A-19', '1A-20', '1A-21', '1A-22', '1A-23'],
      extraMachine: false,
    },
    {
      id: 'dem-mefe-sab-m',
      shiftId: 'shift-sabado-manha',
      courseId: 'pg-us-mefe',
      studentsCount: 12,
      roomsRequired: 6,
      chosenRooms: ['1A-06', '1A-07', '1A-08', '1A-11', '1A-12', '1A-13'],
      extraMachine: false,
    },
    {
      id: 'dem-giob-sab-m',
      shiftId: 'shift-sabado-manha',
      courseId: 'pg-us-giob',
      studentsCount: 20,
      roomsRequired: 10,
      chosenRooms: [
        '2A-01',
        '2A-02',
        '2A-03',
        '2A-04',
        '2A-05',
        '2A-06',
        '2A-07',
        '2A-08',
        '2A-09',
        '2A-10',
      ],
      extraMachine: false,
    },
    {
      id: 'dem-mefe-sab-t',
      shiftId: 'shift-sabado-tarde',
      courseId: 'pg-us-mefe',
      studentsCount: 12,
      roomsRequired: 6,
      chosenRooms: ['1A-06', '1A-07', '1A-08', '1A-11', '1A-12', '1A-13'],
      extraMachine: false,
    },
    {
      id: 'dem-giob-sab-t',
      shiftId: 'shift-sabado-tarde',
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

  return {
    machines: structuredClone(SEED_MACHINES),
    probes: structuredClone(SEED_PROBES),
    rooms: structuredClone(SEED_ROOMS),
    courses: structuredClone(SEED_COURSES),
    courseRules: structuredClone(SEED_COURSE_RULES),
    engineConfig: structuredClone(SEED_ENGINE_CONFIG),
    schedules: [
      {
        id: defaultScheduleId,
        title: 'FDS 23-25 (Escala Oficial)',
        status: 'DRAFT',
        footerNote: '',
        engineConfigId: SEED_ENGINE_CONFIG.id,
        updatedBy: SEED_OPERATORS[0]?.name ?? 'Operador 1',
        updatedAt: new Date().toISOString(),
      },
    ],
    shifts: defaultShifts,
    disabledRoomsByShiftId: {},
    demands: defaultDemands,
    allocations: [],
    explanations: [],
    bottlenecksByShiftId: {},
    floorMovesByShiftId: {},
    manualLocks: [],
    initialFloors,
    operators: structuredClone(SEED_OPERATORS),
    currentOperatorId: SEED_OPERATORS[0]?.id ?? 'op-1',
    scheduleVersions: [],
    overrideCounterByCourseId: {},
    auditLog: [
      {
        id: 1,
        actor: 'Sistema (Seed)',
        action: 'SEED_INITIALIZED',
        details: {
          machines: SEED_MACHINES.length,
          rooms: SEED_ROOMS.length,
          courses: SEED_COURSES.length,
        },
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

export class LocalNexusDatabase {
  private state: NexusDatabaseState;
  private persistEnabled: boolean;

  constructor(options?: { persist?: boolean; initialState?: NexusDatabaseState }) {
    this.persistEnabled = options?.persist ?? typeof window !== 'undefined';
    if (options?.initialState) {
      this.state = structuredClone(options.initialState);
    } else {
      this.state = this.loadFromStorage() ?? createInitialState();
    }
  }

  private loadFromStorage(): NexusDatabaseState | null {
    if (!this.persistEnabled || typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as NexusDatabaseState;
    } catch {
      return null;
    }
  }

  persist(): void {
    if (!this.persistEnabled || typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Ignora erro de quota em ambiente restrito
    }
  }

  appendAudit(
    actor: string,
    action: string,
    details?: Record<string, unknown>,
    scheduleId?: string,
  ): void {
    const nextId = (this.state.auditLog[0]?.id ?? 0) + 1;
    const entry: AuditLogEntry = {
      id: nextId,
      scheduleId,
      actor,
      action,
      details,
      createdAt: new Date().toISOString(),
    };
    this.state.auditLog = [entry, ...this.state.auditLog.slice(0, 299)];
  }

  getSnapshot(): NexusDatabaseState {
    return structuredClone(this.state);
  }

  replaceState(newState: NexusDatabaseState, actor = 'Operador'): NexusDatabaseState {
    this.state = structuredClone(newState);
    this.appendAudit(actor, 'STATE_IMPORTED');
    this.persist();
    return this.getSnapshot();
  }

  resetToSeed(actor = 'Sistema'): NexusDatabaseState {
    this.state = createInitialState();
    this.appendAudit(actor, 'DATABASE_RESET_TO_SEED');
    this.persist();
    return this.getSnapshot();
  }

  // -------------------------------------------------------------------------
  // Operadores (Tarefa 1.9)
  // -------------------------------------------------------------------------
  listOperators(): Operator[] {
    return structuredClone(this.state.operators);
  }

  getCurrentOperator(): Operator {
    const found = this.state.operators.find((o) => o.id === this.state.currentOperatorId);
    return found ?? this.state.operators[0] ?? { id: 'op-1', name: 'Operador 1', role: 'Operações' };
  }

  setCurrentOperator(operatorId: string): Operator {
    const found = this.state.operators.find((o) => o.id === operatorId);
    if (!found) {
      throw new Error(`Operador '${operatorId}' não encontrado.`);
    }
    this.state.currentOperatorId = operatorId;
    this.appendAudit(found.name, 'OPERATOR_SWITCHED', { operatorId: found.id });
    this.persist();
    return structuredClone(found);
  }

  updateOperatorName(operatorId: string, newName: string): Operator {
    const trimmed = newName.trim();
    if (!trimmed) {
      throw new Error('O nome do operador não pode ser vazio.');
    }
    const target = this.state.operators.find((o) => o.id === operatorId);
    if (!target) {
      throw new Error(`Operador '${operatorId}' não encontrado.`);
    }
    target.name = trimmed;
    this.appendAudit(trimmed, 'OPERATOR_RENAMED', { operatorId, newName: trimmed });
    this.persist();
    return structuredClone(target);
  }

  // -------------------------------------------------------------------------
  // Inventário de Máquinas (Tarefa 1.7)
  // -------------------------------------------------------------------------
  listMachines(): Machine[] {
    return structuredClone(this.state.machines);
  }

  upsertMachine(machine: Omit<Machine, 'updatedAt' | 'updatedBy'>, actor?: string): Machine {
    const operatorName = actor ?? this.getCurrentOperator().name;
    const id = machine.id.trim().toLowerCase();
    if (!id) {
      throw new Error('O ID da máquina é obrigatório.');
    }
    if (!machine.code.trim()) {
      throw new Error('O código de exibição da máquina é obrigatório.');
    }

    const updated: Machine = {
      ...machine,
      id,
      code: machine.code.trim().toUpperCase(),
      internalLabel: machine.internalLabel.trim() || machine.code.trim().toUpperCase(),
      brand: machine.brand.trim(),
      probes: [...new Set(machine.probes)],
      updatedAt: new Date().toISOString(),
      updatedBy: operatorName,
    };

    const idx = this.state.machines.findIndex((m) => m.id === id);
    const isNew = idx === -1;
    if (isNew) {
      this.state.machines.push(updated);
      this.state.initialFloors[id] = 1;
    } else {
      this.state.machines[idx] = updated;
    }

    this.appendAudit(operatorName, isNew ? 'MACHINE_CREATED' : 'MACHINE_UPDATED', {
      machineId: id,
      code: updated.code,
      status: updated.status,
    });
    this.persist();
    return structuredClone(updated);
  }

  setMachineStatus(machineId: string, status: MachineStatus, actor?: string): Machine {
    const operatorName = actor ?? this.getCurrentOperator().name;
    const target = this.state.machines.find((m) => m.id === machineId);
    if (!target) {
      throw new Error(`Máquina '${machineId}' não encontrada.`);
    }
    const previousStatus = target.status;
    target.status = status;
    target.updatedAt = new Date().toISOString();
    target.updatedBy = operatorName;

    this.appendAudit(operatorName, 'MACHINE_STATUS_CHANGED', {
      machineId,
      from: previousStatus,
      to: status,
    });
    this.persist();
    return structuredClone(target);
  }

  toggleMachineProbe(machineId: string, probe: ProbeType, actor?: string): Machine {
    const operatorName = actor ?? this.getCurrentOperator().name;
    const target = this.state.machines.find((m) => m.id === machineId);
    if (!target) {
      throw new Error(`Máquina '${machineId}' não encontrada.`);
    }
    const hasProbe = target.probes.includes(probe);
    target.probes = hasProbe
      ? target.probes.filter((p) => p !== probe)
      : [...target.probes, probe];
    target.updatedAt = new Date().toISOString();
    target.updatedBy = operatorName;

    this.appendAudit(operatorName, 'MACHINE_PROBE_TOGGLED', {
      machineId,
      probe,
      enabled: !hasProbe,
    });
    this.persist();
    return structuredClone(target);
  }

  deleteMachine(machineId: string, actor?: string): void {
    const operatorName = actor ?? this.getCurrentOperator().name;
    const exists = this.state.machines.some((m) => m.id === machineId);
    if (!exists) {
      throw new Error(`Máquina '${machineId}' não encontrada.`);
    }
    this.state.machines = this.state.machines.filter((m) => m.id !== machineId);
    this.state.courseRules = this.state.courseRules.filter((r) => r.machineId !== machineId);
    this.state.allocations = this.state.allocations.filter((a) => a.machineId !== machineId);
    this.state.manualLocks = this.state.manualLocks.filter((l) => l.machineId !== machineId);
    delete this.state.initialFloors[machineId];

    this.appendAudit(operatorName, 'MACHINE_DELETED', { machineId });
    this.persist();
  }

  setInitialMachineFloor(machineId: string, floor: FloorNumber, actor?: string): void {
    const operatorName = actor ?? this.getCurrentOperator().name;
    const exists = this.state.machines.some((m) => m.id === machineId);
    if (!exists) {
      throw new Error(`Máquina '${machineId}' não encontrada.`);
    }
    this.state.initialFloors[machineId] = floor;
    this.appendAudit(operatorName, 'INITIAL_FLOOR_UPDATED', { machineId, floor });
    this.persist();
  }

  // -------------------------------------------------------------------------
  // Catálogo de Cursos e Regras de Máquinas (Tarefa 1.8)
  // -------------------------------------------------------------------------
  listCourses(): Course[] {
    return structuredClone(this.state.courses).sort((a, b) => a.surrenderRank - b.surrenderRank);
  }

  listCourseRules(courseId?: string): CourseMachineRule[] {
    const filtered = courseId
      ? this.state.courseRules.filter((r) => r.courseId === courseId)
      : this.state.courseRules;
    return structuredClone(filtered);
  }

  upsertCourse(course: Course, actor?: string): Course {
    const operatorName = actor ?? this.getCurrentOperator().name;
    const id = course.id.trim().toLowerCase();
    if (!id) {
      throw new Error('O ID do curso é obrigatório.');
    }
    if (!course.shortName.trim()) {
      throw new Error('O nome curto do curso é obrigatório.');
    }

    const normalized: Course = {
      ...course,
      id,
      shortName: course.shortName.trim(),
      fullName: course.fullName.trim() || course.shortName.trim(),
    };

    const idx = this.state.courses.findIndex((c) => c.id === id);
    const isNew = idx === -1;
    if (isNew) {
      this.state.courses.push(normalized);
    } else {
      this.state.courses[idx] = normalized;
    }

    this.appendAudit(operatorName, isNew ? 'COURSE_CREATED' : 'COURSE_UPDATED', {
      courseId: id,
      shortName: normalized.shortName,
      priorityLevel: normalized.priorityLevel,
      requiresManual: normalized.requiresManual,
    });
    this.persist();
    return structuredClone(normalized);
  }

  deleteCourse(courseId: string, actor?: string): void {
    const operatorName = actor ?? this.getCurrentOperator().name;
    this.state.courses = this.state.courses.filter((c) => c.id !== courseId);
    this.state.courseRules = this.state.courseRules.filter((r) => r.courseId !== courseId);
    this.appendAudit(operatorName, 'COURSE_DELETED', { courseId });
    this.persist();
  }

  setCourseMachineRule(
    courseId: string,
    machineId: string,
    quality: RuleQuality | null,
    actor?: string,
  ): CourseMachineRule[] {
    const operatorName = actor ?? this.getCurrentOperator().name;
    const existingIdx = this.state.courseRules.findIndex(
      (r) => r.courseId === courseId && r.machineId === machineId,
    );

    if (quality === null) {
      if (existingIdx !== -1) {
        this.state.courseRules.splice(existingIdx, 1);
      }
    } else if (existingIdx === -1) {
      this.state.courseRules.push({ courseId, machineId, quality });
    } else {
      const target = this.state.courseRules[existingIdx];
      if (target) {
        target.quality = quality;
      }
    }

    this.appendAudit(operatorName, 'COURSE_RULE_UPDATED', {
      courseId,
      machineId,
      quality,
    });
    this.persist();
    return this.listCourseRules(courseId);
  }

  // -------------------------------------------------------------------------
  // Consultórios e Zonas Radiais
  // -------------------------------------------------------------------------
  listRooms(): ConsultingRoom[] {
    return structuredClone(this.state.rooms);
  }

  updateRoom(
    roomId: string,
    patch: Partial<
      Pick<ConsultingRoom, 'zone' | 'reportProximity' | 'defaultEnabled' | 'corridorGroup'>
    >,
    actor?: string,
  ): ConsultingRoom {
    const operatorName = actor ?? this.getCurrentOperator().name;
    const room = this.state.rooms.find((r) => r.id === roomId);
    if (!room) {
      throw new Error(`Consultório '${roomId}' não encontrado.`);
    }
    if (patch.zone !== undefined) room.zone = patch.zone;
    if (patch.reportProximity !== undefined) room.reportProximity = patch.reportProximity;
    if (patch.defaultEnabled !== undefined) room.defaultEnabled = patch.defaultEnabled;
    if (patch.corridorGroup !== undefined) room.corridorGroup = patch.corridorGroup;

    this.appendAudit(operatorName, 'ROOM_UPDATED', { roomId, ...patch });
    this.persist();
    return structuredClone(room);
  }

  // -------------------------------------------------------------------------
  // Demandas, Turnos, Escala e Pesos (Sprints 3 e 4)
  // -------------------------------------------------------------------------
  addShiftToSchedule(shiftKey: string, actor?: string): Shift {
    const operatorName = actor ?? this.getCurrentOperator().name;
    const existing = this.state.shifts.find((s) => s.shiftKey === shiftKey);
    if (existing) {
      return structuredClone(existing);
    }

    const template = AVAILABLE_WEEK_SHIFTS.find((t) => t.shiftKey === shiftKey);
    const scheduleId = this.state.schedules[0]?.id ?? 'schedule-default';
    const newShift: Shift = {
      id: `shift-${shiftKey.toLowerCase().replace(/_/g, '-')}`,
      scheduleId,
      shiftKey,
      label: template?.label ?? shiftKey.replace(/_/g, ' '),
      version: 1,
    };

    const orderMap = new Map(AVAILABLE_WEEK_SHIFTS.map((t) => [t.shiftKey, t.order]));
    this.state.shifts = [...this.state.shifts, newShift].sort(
      (a, b) => (orderMap.get(a.shiftKey) ?? 99) - (orderMap.get(b.shiftKey) ?? 99),
    );

    this.appendAudit(operatorName, 'SHIFT_ADDED', {
      shiftId: newShift.id,
      shiftKey: newShift.shiftKey,
      label: newShift.label,
    });
    this.persist();
    return structuredClone(newShift);
  }

  removeShiftFromSchedule(shiftId: string, actor?: string): void {
    if (this.state.shifts.length <= 1) {
      throw new Error('A escala precisa manter pelo menos 1 turno ativo.');
    }
    const operatorName = actor ?? this.getCurrentOperator().name;
    this.state.shifts = this.state.shifts.filter((s) => s.id !== shiftId);
    this.state.demands = this.state.demands.filter((d) => d.shiftId !== shiftId);
    this.state.allocations = this.state.allocations.filter((a) => a.shiftId !== shiftId);
    this.state.manualLocks = this.state.manualLocks.filter((l) => l.shiftId !== shiftId);
    delete this.state.disabledRoomsByShiftId[shiftId];
    delete this.state.bottlenecksByShiftId[shiftId];
    delete this.state.floorMovesByShiftId[shiftId];

    this.appendAudit(operatorName, 'SHIFT_REMOVED', { shiftId });
    this.persist();
  }

  upsertShiftDemand(demand: ShiftDemand, actor?: string): ShiftDemand {
    const operatorName = actor ?? this.getCurrentOperator().name;
    const idx = this.state.demands.findIndex(
      (d) => d.id === demand.id || (d.shiftId === demand.shiftId && d.courseId === demand.courseId),
    );
    if (idx === -1) {
      this.state.demands.push(structuredClone(demand));
    } else {
      this.state.demands[idx] = structuredClone(demand);
    }
    this.appendAudit(operatorName, 'SHIFT_DEMAND_UPSERTED', {
      shiftId: demand.shiftId,
      courseId: demand.courseId,
      roomsRequired: demand.roomsRequired,
    });
    this.persist();
    return structuredClone(demand);
  }

  upsertFullDayDemand(demand: ShiftDemand, actor?: string): ShiftDemand[] {
    const operatorName = actor ?? this.getCurrentOperator().name;
    const currentShift = this.state.shifts.find((s) => s.id === demand.shiftId);
    if (!currentShift) {
      return [this.upsertShiftDemand(demand, operatorName)];
    }

    const template = AVAILABLE_WEEK_SHIFTS.find((t) => t.shiftKey === currentShift.shiftKey);
    if (!template) {
      return [this.upsertShiftDemand(demand, operatorName)];
    }

    const companionPeriod = template.period === 'MANHA' ? 'TARDE' : 'MANHA';
    const companionTemplate = AVAILABLE_WEEK_SHIFTS.find(
      (t) => t.dayGroup === template.dayGroup && t.period === companionPeriod,
    );

    const savedPrimary = this.upsertShiftDemand(demand, operatorName);
    if (!companionTemplate) {
      return [savedPrimary];
    }

    const companionShift = this.addShiftToSchedule(companionTemplate.shiftKey, operatorName);
    const existingCompanion = this.state.demands.find(
      (d) => d.shiftId === companionShift.id && d.courseId === demand.courseId,
    );
    const companionDemand: ShiftDemand = {
      ...structuredClone(demand),
      id: existingCompanion?.id ?? `dem-${companionShift.id}-${demand.courseId}`,
      shiftId: companionShift.id,
    };
    const savedCompanion = this.upsertShiftDemand(companionDemand, operatorName);

    this.appendAudit(operatorName, 'FULL_DAY_DEMAND_UPSERTED', {
      dayGroup: template.dayGroup,
      courseId: demand.courseId,
      rooms: demand.chosenRooms,
    });
    this.persist();
    return [savedPrimary, savedCompanion];
  }

  cloneScheduleForNextWeek(newTitle: string, actor?: string): WeeklySchedule {
    const operatorName = actor ?? this.getCurrentOperator().name;
    const currentSchedule = this.state.schedules[0];
    if (!currentSchedule) {
      throw new Error('Nenhuma escala ativa para clonar.');
    }

    // Registra snapshot da escala anterior no histórico de versões
    this.state.scheduleVersions.unshift({
      id: `ver-clone-${Date.now()}`,
      scheduleId: currentSchedule.id,
      label: `Base Clonada: ${currentSchedule.title}`,
      createdBy: operatorName,
      createdAt: new Date().toISOString(),
      allocationsCount: this.state.allocations.length,
      footerNote: currentSchedule.footerNote,
      snapshotAllocations: structuredClone(this.state.allocations),
      snapshotExplanations: structuredClone(this.state.explanations),
    });

    // DEC-C & RF08: herda o andar final onde cada máquina terminou na última escala como initialFloors da nova semana
    const roomsById = new Map(this.state.rooms.map((r) => [r.id, r]));
    for (const shift of this.state.shifts) {
      const shiftAllocs = this.state.allocations.filter((a) => a.shiftId === shift.id);
      for (const alloc of shiftAllocs) {
        const room = roomsById.get(alloc.roomId);
        if (room) {
          this.state.initialFloors[alloc.machineId] = room.floor;
        }
      }
    }

    const previousId = currentSchedule.id;
    currentSchedule.id = `schedule-${Date.now()}`;
    currentSchedule.title = newTitle.trim() || `${currentSchedule.title} (Clonada)`;
    currentSchedule.status = 'DRAFT';
    currentSchedule.basedOnId = previousId;
    currentSchedule.footerNote = '';
    currentSchedule.updatedBy = operatorName;
    currentSchedule.updatedAt = new Date().toISOString();

    for (const s of this.state.shifts) {
      s.scheduleId = currentSchedule.id;
      s.version = 1;
    }

    this.appendAudit(
      operatorName,
      'SCHEDULE_CLONED_WITH_FLOOR_INHERITANCE',
      {
        basedOnId: previousId,
        newScheduleId: currentSchedule.id,
        newTitle: currentSchedule.title,
      },
      currentSchedule.id,
    );
    this.persist();
    return structuredClone(currentSchedule);
  }

  removeShiftDemand(demandId: string, actor?: string): void {
    const operatorName = actor ?? this.getCurrentOperator().name;
    this.state.demands = this.state.demands.filter((d) => d.id !== demandId);
    this.state.allocations = this.state.allocations.filter((a) => a.demandId !== demandId);
    this.appendAudit(operatorName, 'SHIFT_DEMAND_REMOVED', { demandId });
    this.persist();
  }

  toggleDisabledRoomInShift(shiftId: string, roomId: string, actor?: string): string[] {
    const operatorName = actor ?? this.getCurrentOperator().name;
    const current = new Set(this.state.disabledRoomsByShiftId[shiftId] ?? []);
    if (current.has(roomId)) {
      current.delete(roomId);
    } else {
      current.add(roomId);
    }
    const list = [...current];
    this.state.disabledRoomsByShiftId[shiftId] = list;
    this.appendAudit(operatorName, 'SHIFT_ROOM_SKIP_TOGGLED', {
      shiftId,
      roomId,
      skipped: current.has(roomId),
    });
    this.persist();
    return list;
  }

  updateScheduleMetadata(
    patch: Partial<Pick<WeeklySchedule, 'title' | 'status' | 'footerNote'>>,
    actor?: string,
  ): void {
    const operatorName = actor ?? this.getCurrentOperator().name;
    const schedule = this.state.schedules[0];
    if (!schedule) return;
    if (patch.title !== undefined) schedule.title = patch.title;
    if (patch.status !== undefined) schedule.status = patch.status;
    if (patch.footerNote !== undefined) schedule.footerNote = patch.footerNote;
    schedule.updatedBy = operatorName;
    schedule.updatedAt = new Date().toISOString();

    if (patch.status === 'PUBLISHED' || patch.status === 'CHANGED') {
      this.state.scheduleVersions.unshift({
        id: `ver-${Date.now()}`,
        scheduleId: schedule.id,
        label:
          patch.status === 'PUBLISHED'
            ? `Oficial Publicada (${new Date().toLocaleTimeString('pt-BR')})`
            : `Alterada em Andamento (${new Date().toLocaleTimeString('pt-BR')})`,
        createdBy: operatorName,
        createdAt: new Date().toISOString(),
        allocationsCount: this.state.allocations.length,
        footerNote: schedule.footerNote,
        snapshotAllocations: structuredClone(this.state.allocations),
        snapshotExplanations: structuredClone(this.state.explanations),
      });
    }

    this.appendAudit(operatorName, 'SCHEDULE_METADATA_UPDATED', patch, schedule.id);
    this.persist();
  }

  restoreScheduleVersion(versionId: string, actor?: string): ScheduleVersionRecord {
    const operatorName = actor ?? this.getCurrentOperator().name;
    const version = this.state.scheduleVersions.find((v) => v.id === versionId);
    if (!version) {
      throw new Error(`Versão '${versionId}' não encontrada no histórico.`);
    }
    if (version.snapshotAllocations) {
      this.state.allocations = structuredClone(version.snapshotAllocations);
    }
    if (version.snapshotExplanations) {
      this.state.explanations = structuredClone(version.snapshotExplanations);
    }
    const schedule = this.state.schedules[0];
    if (schedule) {
      schedule.footerNote = version.footerNote;
      schedule.updatedBy = operatorName;
      schedule.updatedAt = new Date().toISOString();
    }
    this.appendAudit(operatorName, 'SCHEDULE_VERSION_RESTORED', {
      versionId: version.id,
      label: version.label,
    });
    this.persist();
    return structuredClone(version);
  }

  updateEngineConfig(
    patch: Partial<
      Pick<
        EngineConfig,
        'w1Fit' | 'w2Proximity' | 'w3Transport' | 'w4Stability' | 'upgradeThreshold'
      >
    >,
    actor?: string,
  ): EngineConfig {
    const operatorName = actor ?? this.getCurrentOperator().name;
    this.state.engineConfig = {
      ...this.state.engineConfig,
      ...patch,
    };
    this.appendAudit(operatorName, 'ENGINE_WEIGHTS_UPDATED', patch);
    this.persist();
    return structuredClone(this.state.engineConfig);
  }

  recordManualOverride(courseId: string): void {
    this.state.overrideCounterByCourseId[courseId] =
      (this.state.overrideCounterByCourseId[courseId] ?? 0) + 1;
  }

  setComputedWeekAllocations(params: {
    allocations: Allocation[];
    explanations: AllocationExplanation[];
    bottlenecksByShiftId: Record<string, Bottleneck[]>;
    floorMovesByShiftId: Record<string, FloorTransportMove[]>;
    suggestedFooterNote?: string;
    actor?: string;
  }): void {
    const operatorName = params.actor ?? this.getCurrentOperator().name;
    this.state.allocations = structuredClone(params.allocations);
    this.state.explanations = structuredClone(params.explanations);
    this.state.bottlenecksByShiftId = structuredClone(params.bottlenecksByShiftId);
    this.state.floorMovesByShiftId = structuredClone(params.floorMovesByShiftId);

    const schedule = this.state.schedules[0];
    if (schedule) {
      if (params.suggestedFooterNote && !schedule.footerNote.trim()) {
        schedule.footerNote = params.suggestedFooterNote;
      }
      schedule.updatedBy = operatorName;
      schedule.updatedAt = new Date().toISOString();
    }

    this.appendAudit(operatorName, 'WEEK_SCHEDULE_GENERATED', {
      totalAllocations: params.allocations.length,
    });
    this.persist();
  }

  // -------------------------------------------------------------------------
  // Salvamento Transacional de Turno & Concorrência Otimista (Tarefas 1.4 e 1.10)
  // -------------------------------------------------------------------------
  getShift(shiftId: string): Shift | undefined {
    const found = this.state.shifts.find((s) => s.id === shiftId);
    return found ? structuredClone(found) : undefined;
  }

  listShiftAllocations(shiftId: string): Allocation[] {
    return structuredClone(this.state.allocations.filter((a) => a.shiftId === shiftId));
  }

  listShiftManualLocks(shiftId: string): ManualLock[] {
    return structuredClone(this.state.manualLocks.filter((l) => l.shiftId === shiftId));
  }

  addManualLock(input: Omit<ManualLock, 'id' | 'lockedAt'>): ManualLock {
    const machinesById = new Map(this.state.machines.map((m) => [m.id, m]));
    const existingLocks = this.state.manualLocks.filter(
      (l) => l.shiftId === input.shiftId && l.roomId !== input.roomId,
    );
    const candidateLock: ManualLock = {
      ...input,
      id: `lock-${input.shiftId}-${input.roomId}`,
      lockedAt: new Date().toISOString(),
    };

    assertShiftIntegrity(input.shiftId, [...existingLocks, candidateLock], machinesById);
    this.state.manualLocks = [...existingLocks, candidateLock];
    this.appendAudit(input.lockedBy, 'MANUAL_LOCK_CREATED', {
      shiftId: input.shiftId,
      roomId: input.roomId,
      machineId: input.machineId,
    });
    this.persist();
    return structuredClone(candidateLock);
  }

  removeManualLock(lockId: string, actor?: string): void {
    const operatorName = actor ?? this.getCurrentOperator().name;
    this.state.manualLocks = this.state.manualLocks.filter((l) => l.id !== lockId);
    this.appendAudit(operatorName, 'MANUAL_LOCK_REMOVED', { lockId });
    this.persist();
  }

  saveShiftTransactional(input: SaveShiftTransactionalInput): {
    shift: Shift;
    allocations: Allocation[];
  } {
    const shift = this.state.shifts.find((s) => s.id === input.shiftId);
    if (!shift) {
      throw new Error(`Turno '${input.shiftId}' não encontrado.`);
    }

    if (shift.version !== input.expectedVersion) {
      throw new OptimisticConcurrencyError(input.shiftId, input.expectedVersion, shift.version);
    }

    const machinesById = new Map(this.state.machines.map((m) => [m.id, m]));
    assertShiftIntegrity(input.shiftId, input.allocations, machinesById);

    shift.version += 1;

    if (input.demands) {
      this.state.demands = [
        ...this.state.demands.filter((d) => d.shiftId !== input.shiftId),
        ...structuredClone(input.demands),
      ];
    }

    const previousAllocationIds = new Set(
      this.state.allocations.filter((a) => a.shiftId === input.shiftId).map((a) => a.id),
    );
    this.state.allocations = [
      ...this.state.allocations.filter((a) => a.shiftId !== input.shiftId),
      ...structuredClone(input.allocations),
    ];

    if (input.explanations) {
      this.state.explanations = [
        ...this.state.explanations.filter((e) => !previousAllocationIds.has(e.allocationId)),
        ...structuredClone(input.explanations),
      ];
    }

    const schedule = this.state.schedules.find((sc) => sc.id === shift.scheduleId);
    if (schedule) {
      if (schedule.status === 'PUBLISHED') {
        schedule.status = 'CHANGED' as ScheduleStatus;
      }
      schedule.updatedBy = input.actor;
      schedule.updatedAt = new Date().toISOString();
    }

    this.appendAudit(
      input.actor,
      'SHIFT_SAVED_TRANSACTIONAL',
      {
        shiftId: shift.id,
        newVersion: shift.version,
        allocationsCount: input.allocations.length,
      },
      shift.scheduleId,
    );
    this.persist();

    return {
      shift: structuredClone(shift),
      allocations: this.listShiftAllocations(shift.id),
    };
  }
}
