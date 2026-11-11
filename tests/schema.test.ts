import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const seed = readFileSync('supabase/seed.sql', 'utf-8');
const migration = readFileSync('supabase/migrations/0001_schema.sql', 'utf-8');

/** Extrai as linhas de VALUES de um INSERT de máquinas: `('id', ...` */
function machineIds(): string[] {
  const block = seed.split('INSERT INTO probes')[0] ?? '';
  return [...block.matchAll(/^\s*\('([a-z0-9-]+)',/gm)].map((m) => m[1] as string);
}

describe('seed.sql', () => {
  it('cadastra as 29 máquinas do inventário oficial', () => {
    expect(machineIds()).toHaveLength(29);
  });

  it('não repete ids de máquina', () => {
    const ids = machineIds();
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('diferencia unidades repetidas (V6 x4, V5 x2, N8 x2)', () => {
    const ids = machineIds();
    expect(ids.filter((i) => i.startsWith('v6-'))).toHaveLength(4);
    expect(ids.filter((i) => i.startsWith('v5-'))).toHaveLength(2);
    expect(ids.filter((i) => i.startsWith('n8-'))).toHaveLength(2);
  });

  it('gera 23 salas no 1º andar e 10 no 2º', () => {
    expect(seed).toContain('generate_series(1, 23)');
    expect(seed).toContain('generate_series(1, 10)');
  });
});

describe('0001_schema.sql', () => {
  it('garante unicidade de máquina e de sala por turno (RN10)', () => {
    expect(migration).toMatch(/UNIQUE \(shift_id, machine_id\)/);
    expect(migration).toMatch(/UNIQUE \(shift_id, room_id\)/);
  });

  it('impede alocar máquina em manutenção', () => {
    expect(migration).toContain('assert_machine_usable');
  });

  it('implementa concorrência otimista por versão do turno', () => {
    expect(migration).toContain('bump_shift_version');
  });

  it('não guarda alocações em JSONB', () => {
    expect(migration).not.toMatch(/shifts_payload/);
  });
});

