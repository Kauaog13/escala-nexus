// Tipos puros do domínio Escala Nexus (Sprints 1, 2, 3 e 4)
// Restrição arquitetural (DEC-F): este módulo não importa bibliotecas de UI ou I/O.

export type MachineFamily =
  | 'VOLUSON'
  | 'SAMSUNG_V'
  | 'RESONA'
  | 'LOGIQ'
  | 'CONSONA'
  | 'CANON'
  | 'ELITE'
  | 'VINNO'
  | 'PORTATIL';

export type MachineTier = 1 | 2 | 3;

export type MobilityWeight = 'HEAVY' | 'MEDIUM' | 'LIGHT' | 'PORTABLE';

export type MachineStatus = 'ACTIVE' | 'MAINTENANCE' | 'LOANED_TEMP';

export type ProbeType =
  | 'CONVEXO'
  | 'LINEAR'
  | 'ENDOVAGINAL'
  | 'VOLUMETRICO_4D'
  | 'SETORIAL_NEONATAL'
  | 'ELASTOGRAFIA';

export interface Probe {
  id: ProbeType;
  label: string;
}

export interface Machine {
  id: string;
  code: string;
  internalLabel: string;
  brand: string;
  family: MachineFamily;
  tier: MachineTier;
  mobility: MobilityWeight;
  probes: ProbeType[];
  status: MachineStatus;
  notes?: string;
  updatedAt: string;
  updatedBy?: string;
}

export type FloorNumber = 1 | 2;
export type RadialZone = 1 | 2 | 3;

export interface FloorPlanCoords {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ConsultingRoom {
  id: string;
  floor: FloorNumber;
  roomNumber: number;
  zone: RadialZone;
  reportProximity: number;
  corridorGroup: string;
  defaultEnabled: boolean;
  floorPlanCoords?: FloorPlanCoords;
}

export type CourseType = 'POS' | 'MODULAR';
export type PriorityLevel = 1 | 2 | 3;
export type MatchQuality = 'IDEAL' | 'SECONDARY' | 'CONTINGENCY' | 'MANUAL';
export type RuleQuality = 'IDEAL' | 'SECONDARY' | 'CONTINGENCY';

export interface Course {
  id: string;
  shortName: string;
  fullName: string;
  type: CourseType;
  workloadHours?: number;
  priorityLevel: PriorityLevel;
  requiresManual: boolean;
  manualReason?: string;
  surrenderRank: number;
}

export interface CourseMachineRule {
  courseId: string;
  machineId: string;
  quality: RuleQuality;
}

export interface EngineConfig {
  id: string;
  w1Fit: number;
  w2Proximity: number;
  w3Transport: number;
  w4Stability: number;
  upgradeThreshold: number;
  createdAt: string;
}

export type ScheduleStatus = 'DRAFT' | 'PUBLISHED' | 'CHANGED';

export interface WeeklySchedule {
  id: string;
  title: string;
  status: ScheduleStatus;
  footerNote: string;
  engineConfigId: string;
  basedOnId?: string;
  updatedBy: string;
  updatedAt: string;
}

export interface Shift {
  id: string;
  scheduleId: string;
  shiftKey: string;
  label: string;
  version: number;
}

export interface ShiftDemand {
  id: string;
  shiftId: string;
  courseId: string;
  studentsCount: number;
  roomsRequired: number;
  chosenRooms: string[];
  extraMachine: boolean;
  manualMachineIds?: string[];
}

export interface Allocation {
  id: string;
  shiftId: string;
  demandId: string;
  roomId: string;
  machineId: string;
  matchQuality: MatchQuality;
  isPinned: boolean;
  inherited: boolean;
  score: number;
}

export interface AllocationExplanation {
  allocationId: string;
  fitTerm: number;
  proximityTerm: number;
  transportTerm: number;
  stabilityTerm: number;
  formulaPt: string;
  textPt: string;
}

export interface ManualLock {
  id: string;
  shiftId: string;
  machineId: string;
  roomId: string;
  lockedBy: string;
  lockedAt: string;
}

export interface MachineLocationSnapshot {
  scheduleId: string;
  machineId: string;
  floor: FloorNumber;
}

export interface AuditLogEntry {
  id: number;
  scheduleId?: string;
  actor: string;
  action: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface Operator {
  id: string;
  name: string;
  role: string;
}

// ---------------------------------------------------------------------------
// Tipos do Motor de Alocação (Sprint 2)
// ---------------------------------------------------------------------------

export type BottleneckKind =
  | 'PARK_CAPACITY_EXCEEDED'
  | 'NO_ELIGIBLE_MACHINE'
  | 'MANUAL_CONTROL_REQUIRED'
  | 'PIN_CONFLICT'
  | 'ROOM_UNAVAILABLE';

export interface Bottleneck {
  id: string;
  shiftId: string;
  courseId?: string;
  roomId?: string;
  kind: BottleneckKind;
  severity: 'WARNING' | 'CRITICAL';
  messagePt: string;
  suggestedActionsPt: string[];
}

export interface FloorTransportMove {
  machineId: string;
  machineLabel: string;
  machineCode: string;
  mobility: MobilityWeight;
  fromFloor: FloorNumber;
  toFloor: FloorNumber;
  fromRoomId?: string;
  toRoomId: string;
  courseShortName: string;
}

export interface ShiftAllocationInput {
  shift: Shift;
  demands: ShiftDemand[];
  machines: Machine[];
  rooms: ConsultingRoom[];
  courses: Course[];
  courseRules: CourseMachineRule[];
  manualLocks: ManualLock[];
  disabledRoomIds?: string[];
  previousAllocations?: Allocation[];
  previousDemands?: ShiftDemand[];
  previousMachineFloors: Record<string, FloorNumber>;
  config: EngineConfig;
}

export interface ShiftAllocationResult {
  shiftId: string;
  allocations: Allocation[];
  explanations: AllocationExplanation[];
  bottlenecks: Bottleneck[];
  floorMoves: FloorTransportMove[];
  updatedMachineFloors: Record<string, FloorNumber>;
  suggestedRoomsByDemandId: Record<string, string[]>;
}

export interface WeekAllocationInput {
  shifts: Shift[];
  demandsByShiftId: Record<string, ShiftDemand[]>;
  manualLocksByShiftId: Record<string, ManualLock[]>;
  disabledRoomsByShiftId?: Record<string, string[]>;
  machines: Machine[];
  rooms: ConsultingRoom[];
  courses: Course[];
  courseRules: CourseMachineRule[];
  initialMachineFloors: Record<string, FloorNumber>;
  config: EngineConfig;
}

export interface WeekAllocationResult {
  resultsByShiftId: Record<string, ShiftAllocationResult>;
  totalFloorMoves: number;
  suggestedFooterNotePt: string;
}

export interface MaintenanceQuarantineProposal {
  brokenMachineId: string;
  shiftId: string;
  affectedRoomId: string;
  affectedCourseId: string;
  replacementMachineId: string | null;
  replacementQuality: MatchQuality | null;
  updatedAllocations: Allocation[];
  updatedExplanations: AllocationExplanation[];
  alertMessagePt: string;
  footerNoteSuggestionPt: string;
}

export interface ShiftTransitionReport {
  fromShiftLabel: string;
  toShiftLabel: string;
  stayingInSameRoom: {
    roomId: string;
    machineId: string;
    machineLabel: string;
    courseShortName: string;
  }[];
  movingWithinSameFloor: {
    fromRoomId: string;
    toRoomId: string;
    floor: FloorNumber;
    machineId: string;
    machineLabel: string;
    courseShortName: string;
  }[];
  movingBetweenFloors: FloorTransportMove[];
}
