-- Escala Nexus — Seed 0001: 29 máquinas, probes e 33 salas (Sprint 1, tarefa 1.5)
-- Fonte: docs/analise-requisitos-escala-nexus.md §2.4 e §3.1.
-- Tier, mobilidade e zonas seguem o documento. Cursos e regras de máquina por curso
-- ficam para depois da validação da hipótese H2 (Sprint 0).

INSERT INTO machines (id, code, internal_label, brand, family, tier, mobility) VALUES
  ('signature',   'SIGNATURE',   'SIGNATURE',   'GE',        'VOLUSON',   1, 'HEAVY'),
  ('s10-expert',  'S10 EXPERT',  'S10 EXPERT',  'GE',        'VOLUSON',   1, 'HEAVY'),
  ('performance', 'PERFORMANCE', 'PERFORMANCE', 'GE',        'VOLUSON',   1, 'HEAVY'),
  ('s10',         'S10',         'S10',         'GE',        'VOLUSON',   1, 'HEAVY'),
  ('e8',          'E8',          'E8',          'GE',        'VOLUSON',   2, 'MEDIUM'),
  ('swift',       'SWIFT',       'SWIFT',       'GE',        'VOLUSON',   2, 'LIGHT'),
  ('p8',          'P8',          'P8',          'GE',        'VOLUSON',   3, 'LIGHT'),
  ('resona-i9',   'RESONA I9',   'RESONA I9',   'Mindray',   'RESONA',    1, 'HEAVY'),
  ('v8',          'V8',          'V8',          'Samsung',   'SAMSUNG_V', 1, 'HEAVY'),
  ('v7',          'V7',          'V7',          'Samsung',   'SAMSUNG_V', 1, 'MEDIUM'),
  ('rs80',        'RS80',        'RS80',        'Samsung',   'SAMSUNG_V', 2, 'HEAVY'),
  ('v6-01',       'V6',          'V6 #01',      'Samsung',   'SAMSUNG_V', 2, 'MEDIUM'),
  ('v6-02',       'V6',          'V6 #02',      'Samsung',   'SAMSUNG_V', 2, 'MEDIUM'),
  ('v6-03',       'V6',          'V6 #03',      'Samsung',   'SAMSUNG_V', 2, 'MEDIUM'),
  ('v6-04',       'V6',          'V6 #04',      'Samsung',   'SAMSUNG_V', 2, 'MEDIUM'),
  ('v5-01',       'V5',          'V5 #01',      'Samsung',   'SAMSUNG_V', 3, 'LIGHT'),
  ('v5-02',       'V5',          'V5 #02',      'Samsung',   'SAMSUNG_V', 3, 'LIGHT'),
  ('v4',          'V4',          'V4',          'Samsung',   'SAMSUNG_V', 3, 'LIGHT'),
  ('totus',       'TOTUS',       'TOTUS',       'GE',        'LOGIQ',     1, 'HEAVY'),
  ('balance',     'BALANCE',     'BALANCE',     'GE',        'LOGIQ',     2, 'MEDIUM'),
  ('p9',          'P9',          'P9',          'GE',        'LOGIQ',     2, 'MEDIUM'),
  ('logiq-e',     'LOGIQ E',     'LOGIQ E',     'GE',        'LOGIQ',     3, 'PORTABLE'),
  ('n8-01',       'N8',          'N8 #01',      'Mindray',   'CONSONA',   2, 'MEDIUM'),
  ('n8-02',       'N8',          'N8 #02',      'Mindray',   'CONSONA',   2, 'MEDIUM'),
  ('canon',       'CANON',       'CANON',       'Canon',     'CANON',     1, 'MEDIUM'),
  ('p12-elite',   'P12 ELITE',   'P12 ELITE',   'SonoScape', 'ELITE',     2, 'MEDIUM'),
  ('vinno-e35',   'VINNO E35',   'VINNO E35',   'Vinno',     'VINNO',     2, 'LIGHT'),
  ('vinno-e20',   'VINNO E20',   'VINNO E20',   'Vinno',     'VINNO',     3, 'LIGHT'),
  ('hm70',        'HM70',        'HM70',        'Samsung',   'PORTATIL',  3, 'PORTABLE');

INSERT INTO probes (id, label) VALUES
  ('CONVEXO',           'Convexo'),
  ('LINEAR',            'Linear'),
  ('ENDOVAGINAL',       'Endovaginal'),
  ('VOLUMETRICO_4D',    'Volumétrico 3D/4D'),
  ('SETORIAL_NEONATAL', 'Setorial Adulto/Neonatal'),
  ('ELASTOGRAFIA',      'Elastografia');

-- 1º andar: Zona 1 = salas 5-8 e 11-18 (proximidade 30); Zona 2 = demais (10).
INSERT INTO rooms (id, floor, room_number, zone, report_proximity)
SELECT format('1A-%s', lpad(n::text, 2, '0')),
       1,
       n,
       CASE WHEN n IN (5,6,7,8,11,12,13,14,15,16,17,18) THEN 1 ELSE 2 END,
       CASE WHEN n IN (5,6,7,8,11,12,13,14,15,16,17,18) THEN 30 ELSE 10 END
FROM generate_series(1, 23) AS n;

-- 2º andar: Zona 3 (apoio), proximidade 0 (hipótese H4/zonas, a validar na Sprint 0).
INSERT INTO rooms (id, floor, room_number, zone, report_proximity)
SELECT format('2A-%s', lpad(n::text, 2, '0')), 2, n, 3, 0
FROM generate_series(1, 10) AS n;

INSERT INTO engine_config DEFAULT VALUES;

