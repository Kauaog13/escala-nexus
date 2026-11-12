import { OptimisticConcurrencyError } from '@/domain/rules/constraints';
import type {
  ConsultingRoom,
  Course,
  CourseMachineRule,
  EngineConfig,
  Machine,
} from '@/domain/types';

export interface SupabaseConnectionConfig {
  url: string;
  anonKey: string;
}

export type SyncConnectionState = 'CLOUD_SYNCED' | 'PENDING_SYNC' | 'LOCAL_ONLY';

export function getSupabaseConfig(): SupabaseConnectionConfig | null {
  const url = import.meta.env?.VITE_SUPABASE_URL?.trim() ?? '';
  const anonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY?.trim() ?? '';
  if (!url || !anonKey) {
    return null;
  }
  return { url: url.replace(/\/+$/, ''), anonKey };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig() !== null;
}

function buildHeaders(anonKey: string): Record<string, string> {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=representation',
  };
}

export async function syncMachineToSupabase(machine: Machine): Promise<boolean> {
  const cfg = getSupabaseConfig();
  if (!cfg) return false;

  const response = await fetch(`${cfg.url}/rest/v1/machines`, {
    method: 'POST',
    headers: buildHeaders(cfg.anonKey),
    body: JSON.stringify({
      id: machine.id,
      code: machine.code,
      internal_label: machine.internalLabel,
      brand: machine.brand,
      family: machine.family,
      tier: machine.tier,
      mobility: machine.mobility,
      status: machine.status,
      notes: machine.notes ?? null,
      updated_at: machine.updatedAt,
      updated_by: machine.updatedBy ?? null,
    }),
  });
  return response.ok;
}

export async function syncCourseToSupabase(course: Course): Promise<boolean> {
  const cfg = getSupabaseConfig();
  if (!cfg) return false;

  const response = await fetch(`${cfg.url}/rest/v1/courses`, {
    method: 'POST',
    headers: buildHeaders(cfg.anonKey),
    body: JSON.stringify({
      id: course.id,
      short_name: course.shortName,
      full_name: course.fullName,
      type: course.type,
      workload_hours: course.workloadHours ?? null,
      priority_level: course.priorityLevel,
      requires_manual: course.requiresManual,
      manual_reason: course.manualReason ?? null,
      surrender_rank: course.surrenderRank,
    }),
  });
  return response.ok;
}

export async function syncCourseRuleToSupabase(rule: CourseMachineRule): Promise<boolean> {
  const cfg = getSupabaseConfig();
  if (!cfg) return false;

  const response = await fetch(`${cfg.url}/rest/v1/course_machine_rules`, {
    method: 'POST',
    headers: buildHeaders(cfg.anonKey),
    body: JSON.stringify({
      course_id: rule.courseId,
      machine_id: rule.machineId,
      quality: rule.quality,
    }),
  });
  return response.ok;
}

export async function syncRoomToSupabase(room: ConsultingRoom): Promise<boolean> {
  const cfg = getSupabaseConfig();
  if (!cfg) return false;

  const response = await fetch(`${cfg.url}/rest/v1/rooms`, {
    method: 'POST',
    headers: buildHeaders(cfg.anonKey),
    body: JSON.stringify({
      id: room.id,
      floor: room.floor,
      room_number: room.roomNumber,
      zone: room.zone,
      report_proximity: room.reportProximity,
      corridor_group: room.corridorGroup,
      default_enabled: room.defaultEnabled,
    }),
  });
  return response.ok;
}

export async function syncEngineConfigToSupabase(config: EngineConfig): Promise<boolean> {
  const cfg = getSupabaseConfig();
  if (!cfg) return false;

  const response = await fetch(`${cfg.url}/rest/v1/engine_config`, {
    method: 'POST',
    headers: buildHeaders(cfg.anonKey),
    body: JSON.stringify({
      id: config.id,
      w1_fit: config.w1Fit,
      w2_proximity: config.w2Proximity,
      w3_transport: config.w3Transport,
      w4_stability: config.w4Stability,
      upgrade_threshold: config.upgradeThreshold,
    }),
  });
  return response.ok;
}

export async function syncCatalogBatchToSupabase(payload: {
  machines: Machine[];
  rooms: ConsultingRoom[];
  courses: Course[];
}): Promise<boolean> {
  const cfg = getSupabaseConfig();
  if (!cfg) return false;

  const machinesRes = await fetch(`${cfg.url}/rest/v1/machines`, {
    method: 'POST',
    headers: buildHeaders(cfg.anonKey),
    body: JSON.stringify(
      payload.machines.map((m) => ({
        id: m.id,
        code: m.code,
        internal_label: m.internalLabel,
        brand: m.brand,
        family: m.family,
        tier: m.tier,
        mobility: m.mobility,
        status: m.status,
        notes: m.notes ?? null,
        updated_at: m.updatedAt,
        updated_by: m.updatedBy ?? null,
      })),
    ),
  });

  const roomsRes = await fetch(`${cfg.url}/rest/v1/rooms`, {
    method: 'POST',
    headers: buildHeaders(cfg.anonKey),
    body: JSON.stringify(
      payload.rooms.map((r) => ({
        id: r.id,
        floor: r.floor,
        room_number: r.roomNumber,
        zone: r.zone,
        report_proximity: r.reportProximity,
        corridor_group: r.corridorGroup,
        default_enabled: r.defaultEnabled,
      })),
    ),
  });

  const coursesRes = await fetch(`${cfg.url}/rest/v1/courses`, {
    method: 'POST',
    headers: buildHeaders(cfg.anonKey),
    body: JSON.stringify(
      payload.courses.map((c) => ({
        id: c.id,
        short_name: c.shortName,
        full_name: c.fullName,
        type: c.type,
        workload_hours: c.workloadHours ?? null,
        priority_level: c.priorityLevel,
        requires_manual: c.requiresManual,
        manual_reason: c.manualReason ?? null,
        surrender_rank: c.surrenderRank,
      })),
    ),
  });

  return machinesRes.ok && roomsRes.ok && coursesRes.ok;
}

export async function callBumpShiftVersionRpc(
  shiftId: string,
  expectedVersion: number,
): Promise<number> {
  const cfg = getSupabaseConfig();
  if (!cfg) {
    return expectedVersion + 1;
  }

  const response = await fetch(`${cfg.url}/rest/v1/rpc/bump_shift_version`, {
    method: 'POST',
    headers: buildHeaders(cfg.anonKey),
    body: JSON.stringify({
      p_shift_id: shiftId,
      p_expected_version: expectedVersion,
    }),
  });

  if (!response.ok) {
    throw new OptimisticConcurrencyError(shiftId, expectedVersion, expectedVersion + 1);
  }
  const newVersion = (await response.json()) as number;
  return newVersion;
}
