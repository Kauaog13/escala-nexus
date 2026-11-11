-- Escala Nexus — Migração 0001: schema normalizado (Sprint 1, tarefas 1.3 e 1.4)
-- Decisão DEC-G: sem JSONB para alocações; a unicidade vale no banco (RN10, RNF02).

-- ---------------------------------------------------------------------------
-- Inventário
-- ---------------------------------------------------------------------------
CREATE TABLE machines (
  id             TEXT PRIMARY KEY,                 -- ex.: 'v6-01'
  code           TEXT NOT NULL,                    -- nome exibido no WhatsApp: 'V6'
  internal_label TEXT NOT NULL,                    -- 'V6 #01'
  brand          TEXT NOT NULL,
  family         TEXT NOT NULL CHECK (family IN
                   ('VOLUSON','SAMSUNG_V','RESONA','LOGIQ','CONSONA','CANON','ELITE','VINNO','PORTATIL')),
  tier           SMALLINT NOT NULL DEFAULT 2 CHECK (tier IN (1, 2, 3)),
  mobility       TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (mobility IN ('HEAVY','MEDIUM','LIGHT','PORTABLE')),
  status         TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','MAINTENANCE','LOANED_TEMP')),
  notes          TEXT,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by     TEXT
);

CREATE TABLE probes (
  id    TEXT PRIMARY KEY,                          -- 'CONVEXO', 'LINEAR', ...
  label TEXT NOT NULL
);

CREATE TABLE machine_probes (
  machine_id TEXT NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  probe_id   TEXT NOT NULL REFERENCES probes(id)   ON DELETE RESTRICT,
  PRIMARY KEY (machine_id, probe_id)
);

-- ---------------------------------------------------------------------------
-- Topologia
-- ---------------------------------------------------------------------------
CREATE TABLE rooms (
  id                TEXT PRIMARY KEY,              -- '1A-06', '2A-01'
  floor             SMALLINT NOT NULL CHECK (floor IN (1, 2)),
  room_number       SMALLINT NOT NULL,
  zone              SMALLINT NOT NULL CHECK (zone IN (1, 2, 3)),
  report_proximity  SMALLINT NOT NULL DEFAULT 0 CHECK (report_proximity BETWEEN 0 AND 100),
  corridor_group    TEXT,
  default_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  floor_plan_coords JSONB,                         -- reservado para a planta baixa
  UNIQUE (floor, room_number)
);

-- ---------------------------------------------------------------------------
-- Cursos
-- ---------------------------------------------------------------------------
CREATE TABLE courses (
  id                  TEXT PRIMARY KEY,            -- 'pg-us-ecof'
  short_name          TEXT NOT NULL,
  full_name           TEXT NOT NULL,
  type                TEXT NOT NULL CHECK (type IN ('POS','MODULAR')),
  workload_hours      INT,
  priority_level      SMALLINT NOT NULL DEFAULT 2 CHECK (priority_level IN (1, 2, 3)),
  requires_manual     BOOLEAN NOT NULL DEFAULT FALSE,
  manual_reason       TEXT,
  surrender_rank      INT                          -- ordem de rendição (DEC-D); menor = escolhe primeiro
);

-- Regras de máquina por curso (hipótese H2): 1ª opção, 2ª opção ou contingência.
CREATE TABLE course_machine_rules (
  course_id  TEXT NOT NULL REFERENCES courses(id)  ON DELETE CASCADE,
  machine_id TEXT NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  quality    TEXT NOT NULL CHECK (quality IN ('IDEAL','SECONDARY','CONTINGENCY')),
  PRIMARY KEY (course_id, machine_id)
);

-- ---------------------------------------------------------------------------
-- Escalas
-- ---------------------------------------------------------------------------
CREATE TABLE engine_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  w1_fit          NUMERIC NOT NULL DEFAULT 1,
  w2_proximity    NUMERIC NOT NULL DEFAULT 1,
  w3_transport    NUMERIC NOT NULL DEFAULT 1,
  w4_stability    NUMERIC NOT NULL DEFAULT 1,
  upgrade_threshold NUMERIC NOT NULL DEFAULT 10,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE weekly_schedules (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT NOT NULL,                    -- 'FDS 23-25'
  status         TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED','CHANGED')),
  footer_note    TEXT NOT NULL DEFAULT '',
  engine_config_id UUID REFERENCES engine_config(id),
  based_on_id    UUID REFERENCES weekly_schedules(id),   -- clonagem / herança de estado (DEC-C)
  updated_by     TEXT NOT NULL,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE shifts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES weekly_schedules(id) ON DELETE CASCADE,
  shift_key   TEXT NOT NULL,                       -- 'SABADO_MANHA'
  label       TEXT NOT NULL,
  version     INT  NOT NULL DEFAULT 1,             -- concorrência otimista
  UNIQUE (schedule_id, shift_key)
);

CREATE TABLE shift_disabled_rooms (
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  room_id  TEXT NOT NULL REFERENCES rooms(id),
  PRIMARY KEY (shift_id, room_id)
);

CREATE TABLE shift_demands (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id       UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  course_id      TEXT NOT NULL REFERENCES courses(id),
  students_count INT  NOT NULL CHECK (students_count >= 0),
  rooms_required INT  NOT NULL CHECK (rooms_required >= 0),
  chosen_rooms   TEXT[] NOT NULL DEFAULT '{}',     -- salas escolhidas pelo operador (DEC-A)
  extra_machine  BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (shift_id, course_id)
);

CREATE TABLE allocations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id      UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  demand_id     UUID NOT NULL REFERENCES shift_demands(id) ON DELETE CASCADE,
  room_id       TEXT NOT NULL REFERENCES rooms(id),
  machine_id    TEXT NOT NULL REFERENCES machines(id),
  match_quality TEXT NOT NULL CHECK (match_quality IN ('IDEAL','SECONDARY','CONTINGENCY','MANUAL')),
  is_pinned     BOOLEAN NOT NULL DEFAULT FALSE,
  inherited     BOOLEAN NOT NULL DEFAULT FALSE,
  score         NUMERIC,
  -- RN10 / RNF02: uma máquina e uma sala só podem aparecer uma vez por turno.
  CONSTRAINT uq_allocation_machine_per_shift UNIQUE (shift_id, machine_id),
  CONSTRAINT uq_allocation_room_per_shift    UNIQUE (shift_id, room_id)
);

CREATE TABLE allocation_explanations (
  allocation_id UUID PRIMARY KEY REFERENCES allocations(id) ON DELETE CASCADE,
  fit_term       NUMERIC NOT NULL,
  proximity_term NUMERIC NOT NULL,
  transport_term NUMERIC NOT NULL,
  stability_term NUMERIC NOT NULL,
  text_pt        TEXT NOT NULL
);

CREATE TABLE manual_locks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id   UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  machine_id TEXT NOT NULL REFERENCES machines(id),
  room_id    TEXT NOT NULL REFERENCES rooms(id),
  locked_by  TEXT NOT NULL,
  locked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (shift_id, machine_id),
  UNIQUE (shift_id, room_id)
);

-- Andar de cada máquina no início da escala (DEC-C).
CREATE TABLE machine_location_snapshots (
  schedule_id UUID NOT NULL REFERENCES weekly_schedules(id) ON DELETE CASCADE,
  machine_id  TEXT NOT NULL REFERENCES machines(id),
  floor       SMALLINT NOT NULL CHECK (floor IN (1, 2)),
  PRIMARY KEY (schedule_id, machine_id)
);

CREATE TABLE schedule_versions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES weekly_schedules(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,                       -- 'Original', 'Alterado 1'
  snapshot    JSONB NOT NULL,                      -- JSONB só para histórico
  created_by  TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_log (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  schedule_id UUID REFERENCES weekly_schedules(id) ON DELETE SET NULL,
  actor       TEXT NOT NULL,
  action      TEXT NOT NULL,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Integridade: máquina fora de operação não pode ser alocada nem travada.
-- ---------------------------------------------------------------------------
CREATE FUNCTION assert_machine_usable() RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT status FROM machines WHERE id = NEW.machine_id) = 'MAINTENANCE' THEN
    RAISE EXCEPTION 'Máquina % está em manutenção e não pode ser alocada', NEW.machine_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_allocations_machine_usable
  BEFORE INSERT OR UPDATE OF machine_id ON allocations
  FOR EACH ROW EXECUTE FUNCTION assert_machine_usable();

CREATE TRIGGER trg_locks_machine_usable
  BEFORE INSERT OR UPDATE OF machine_id ON manual_locks
  FOR EACH ROW EXECUTE FUNCTION assert_machine_usable();

-- ---------------------------------------------------------------------------
-- Salvamento com concorrência otimista (tarefa 1.10): retorna a nova versão ou
-- falha com 'serialization_failure' se outro operador gravou antes.
-- ---------------------------------------------------------------------------
CREATE FUNCTION bump_shift_version(p_shift_id UUID, p_expected_version INT) RETURNS INT AS $$
DECLARE
  new_version INT;
BEGIN
  UPDATE shifts
     SET version = version + 1
   WHERE id = p_shift_id AND version = p_expected_version
   RETURNING version INTO new_version;

  IF new_version IS NULL THEN
    RAISE EXCEPTION 'Conflito de versão no turno %', p_shift_id
      USING ERRCODE = 'serialization_failure';
  END IF;
  RETURN new_version;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Segurança: somente operadores autenticados (3 usuários).
-- ---------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'machines','probes','machine_probes','rooms','courses','course_machine_rules',
    'engine_config','weekly_schedules','shifts','shift_disabled_rooms','shift_demands',
    'allocations','allocation_explanations','manual_locks','machine_location_snapshots',
    'schedule_versions','audit_log'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY operadores_total ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

