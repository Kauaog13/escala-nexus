-- Escala Nexus — Seed 0001: 29 máquinas, 6 sondas, 33 salas, 22 cursos e regras (Sprint 1, tarefa 1.5)
-- Fonte: docs/analise-requisitos-escala-nexus.md §2.4, §3.1, §4.1 e §4.2.

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
  ('hm70',        'HM70',        'HM70',        'Samsung',   'PORTATIL',  3, 'PORTABLE')
ON CONFLICT (id) DO NOTHING;

INSERT INTO probes (id, label) VALUES
  ('CONVEXO',           'Convexo'),
  ('LINEAR',            'Linear'),
  ('ENDOVAGINAL',       'Endovaginal'),
  ('VOLUMETRICO_4D',    'Volumétrico 3D/4D'),
  ('SETORIAL_NEONATAL', 'Setorial Adulto/Neonatal'),
  ('ELASTOGRAFIA',      'Elastografia')
ON CONFLICT (id) DO NOTHING;

-- 1º andar: Zona 1 = salas 5-8 e 11-18 (proximidade 30); Zona 2 = demais (10).
INSERT INTO rooms (id, floor, room_number, zone, report_proximity, corridor_group)
SELECT format('1A-%s', lpad(n::text, 2, '0')),
       1,
       n,
       CASE WHEN n IN (5,6,7,8,11,12,13,14,15,16,17,18) THEN 1 ELSE 2 END,
       CASE WHEN n IN (5,6,7,8,11,12,13,14,15,16,17,18) THEN 30 ELSE 10 END,
       CASE WHEN n IN (5,6,7,8,11,12,13,14,15,16,17,18)
            THEN 'Zona 1 - Núcleo Próximo ao Laudo'
            ELSE 'Zona 2 - Periferia 1º Andar'
       END
FROM generate_series(1, 23) AS n
ON CONFLICT (id) DO NOTHING;

-- 2º andar: Zona 3 (apoio), proximidade 0.
INSERT INTO rooms (id, floor, room_number, zone, report_proximity, corridor_group)
SELECT format('2A-%s', lpad(n::text, 2, '0')),
       2,
       n,
       3,
       0,
       'Zona 3 - Expansão 2º Andar'
FROM generate_series(1, 10) AS n
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Catálogo Oficial de Cursos (§4.1 Pós-Graduação e §4.2 Modulares)
-- ---------------------------------------------------------------------------
INSERT INTO courses (id, short_name, full_name, type, workload_hours, priority_level, requires_manual, manual_reason, surrender_rank) VALUES
  -- Pós-Graduação (§4.1)
  ('pg-us-ecof',               'PG US ECOF',                          'Pós-Graduação em Ecocardiografia Fetal',                 'POS',     360, 1, FALSE, NULL, 1),
  ('pg-us-mefe',               'PG US MEFE',                          'Pós-Graduação em Medicina Fetal Internacional',          'POS',     800, 1, FALSE, NULL, 2),
  ('pg-neurossonografia-fetal','PG Neurossonografia Fetal',           'Pós-Graduação em Neurossonografia Fetal',                'POS',     360, 1, FALSE, NULL, 3),
  ('pg-ecografia-vascular',    'PG Ecografia Vascular',               'Pós-Graduação em Ecografia Vascular',                    'POS',     440, 1, FALSE, NULL, 4),
  ('pg-imagem-saude-mulher',   'PG Imagem na Saúde da Mulher',        'Pós-Graduação em Imagem na Saúde da Mulher',             'POS',     380, 2, FALSE, NULL, 10),
  ('pg-ginecologia-endocrina', 'PG Ginecologia Endócrina e Reprodução','Pós-Graduação em Ginecologia Endócrina e Reprodução',   'POS',     360, 2, FALSE, NULL, 11),
  ('pg-us-pediatrica-neonatal','PG US Pediátrica e Neonatal',         'Pós-Graduação em US Pediátrica e Neonatal',              'POS',     360, 2, FALSE, NULL, 12),
  ('pg-intervencoes-dor',      'PG Intervenções Ambulatoriais em Dor','Pós-Graduação em Intervenções Ambulatoriais em Dor',     'POS',     360, 2, TRUE,  'Exige alerta e validação manual de transdutor linear de alta frequência', 15),
  ('pg-us-giob',               'PG US GIOB',                          'Pós-Graduação em Ginecologia e Obstetrícia',             'POS',     360, 3, FALSE, NULL, 20),
  -- Cursos Modulares (§4.2)
  ('mod-endometriose',         'Avançado em Endometriose',            'Curso Modular Avançado em Endometriose',                 'MODULAR',  30, 1, FALSE, NULL, 5),
  ('mod-doppler-obstetrico',   'Doppler Avançado em Patologias Obstétricas', 'Doppler Avançado em Patologias Obstétricas',    'MODULAR',  30, 1, FALSE, NULL, 6),
  ('mod-musculo',              'Músculo (Musculoesquelético)',        'Curso Modular em Ultrassonografia Musculoesquelética',   'MODULAR',  30, 1, FALSE, NULL, 7),
  ('mod-carotidas',            'Artérias Carótidas, Vertebrais e Fístulas', 'Artérias Carótidas, Vertebrais e Fístulas',        'MODULAR',  30, 1, FALSE, NULL, 8),
  ('mod-figado-elastografia',  'Avaliação Multiparamétrica do Fígado','Avaliação Multiparamétrica do Fígado (Elastografia)',    'MODULAR',  25, 1, TRUE,  'Exige validação manual de quais máquinas possuem Elastografia ativa', 9),
  ('mod-hemodinamica-neonatal','Hemodinâmica Neonatal Guiada por US Cardíaco', 'Hemodinâmica Neonatal Guiada por US Cardíaco',  'MODULAR',  25, 1, TRUE,  'Exige validação manual de máquinas com transdutor setorial neonatal', 9),
  ('mod-histerossonografia',   'Histerossonografia e HyCoSy com Mentoria', 'Histerossonografia e HyCoSy com Mentoria',         'MODULAR',  23, 2, FALSE, NULL, 13),
  ('mod-uroginecologia',       'Ultrassonografia em Uroginecologia Básico', 'Ultrassonografia em Uroginecologia Básico',        'MODULAR',  25, 2, FALSE, NULL, 14),
  ('mod-tireoide',             'Tireoide com Doppler, Cervical e Salivares', 'Tireoide com Doppler, Cervical e Salivares',      'MODULAR',  25, 2, FALSE, NULL, 16),
  ('mod-parede-abdominal',     'Parede Abdominal, Inguinal e Bolsa Testicular', 'Parede Abdominal, Inguinal e Bolsa Testicular','MODULAR',  30, 2, FALSE, NULL, 17),
  ('mod-puncao-vascular',      'Punção Vascular Ecoguiada',           'Punção Vascular Ecoguiada',                              'MODULAR',  10, 2, TRUE,  'Operador escolhe entre Portáteis (Logiq E, HM70) ou Fixos Lineares', 18),
  ('mod-pocus-go',             'Point-of-Care: Urgências / POCUS em GO', 'Point-of-Care: Urgências / POCUS em GO',              'MODULAR',  30, 2, TRUE,  'Operador define proporção entre Portáteis e Linha V / Voluson Base', 19),
  ('mod-basico-giob',          'Básico em Ginecologia e Obstetrícia', 'Curso Básico em Ginecologia e Obstetrícia',              'MODULAR',  60, 3, FALSE, NULL, 21)
ON CONFLICT (id) DO NOTHING;

-- Regras iniciais de máquinas por curso (1ª opção IDEAL, 2ª opção SECONDARY, CONTINGENCY)
INSERT INTO course_machine_rules (course_id, machine_id, quality) VALUES
  -- PG US ECOF
  ('pg-us-ecof', 'signature', 'IDEAL'), ('pg-us-ecof', 'performance', 'IDEAL'), ('pg-us-ecof', 's10-expert', 'IDEAL'),
  ('pg-us-ecof', 'resona-i9', 'IDEAL'), ('pg-us-ecof', 'v8', 'IDEAL'),
  ('pg-us-ecof', 'v6-01', 'SECONDARY'), ('pg-us-ecof', 'v6-02', 'SECONDARY'), ('pg-us-ecof', 'v6-03', 'SECONDARY'), ('pg-us-ecof', 'v6-04', 'SECONDARY'),
  ('pg-us-ecof', 'v5-01', 'SECONDARY'), ('pg-us-ecof', 'v5-02', 'SECONDARY'),
  -- PG US MEFE
  ('pg-us-mefe', 's10', 'IDEAL'), ('pg-us-mefe', 'signature', 'IDEAL'), ('pg-us-mefe', 'performance', 'IDEAL'),
  ('pg-us-mefe', 'v7', 'IDEAL'), ('pg-us-mefe', 'v8', 'IDEAL'),
  ('pg-us-mefe', 'v6-01', 'SECONDARY'), ('pg-us-mefe', 'v6-02', 'SECONDARY'), ('pg-us-mefe', 'v6-03', 'SECONDARY'), ('pg-us-mefe', 'v6-04', 'SECONDARY'),
  ('pg-us-mefe', 'v5-01', 'SECONDARY'), ('pg-us-mefe', 'v5-02', 'SECONDARY'), ('pg-us-mefe', 'v4', 'SECONDARY'),
  -- PG US GIOB
  ('pg-us-giob', 'e8', 'IDEAL'), ('pg-us-giob', 'swift', 'IDEAL'), ('pg-us-giob', 'p8', 'IDEAL'),
  ('pg-us-giob', 'signature', 'IDEAL'), ('pg-us-giob', 's10-expert', 'IDEAL'), ('pg-us-giob', 'performance', 'IDEAL'), ('pg-us-giob', 's10', 'IDEAL'),
  ('pg-us-giob', 'resona-i9', 'IDEAL'), ('pg-us-giob', 'v8', 'IDEAL'), ('pg-us-giob', 'v7', 'IDEAL'), ('pg-us-giob', 'rs80', 'IDEAL'),
  ('pg-us-giob', 'v6-01', 'IDEAL'), ('pg-us-giob', 'v6-02', 'IDEAL'), ('pg-us-giob', 'v6-03', 'IDEAL'), ('pg-us-giob', 'v6-04', 'IDEAL'),
  ('pg-us-giob', 'v5-01', 'IDEAL'), ('pg-us-giob', 'v5-02', 'IDEAL'), ('pg-us-giob', 'v4', 'IDEAL'),
  ('pg-us-giob', 'p12-elite', 'CONTINGENCY'), ('pg-us-giob', 'p9', 'CONTINGENCY'), ('pg-us-giob', 'canon', 'CONTINGENCY'),
  ('pg-us-giob', 'n8-01', 'CONTINGENCY'), ('pg-us-giob', 'n8-02', 'CONTINGENCY'), ('pg-us-giob', 'hm70', 'CONTINGENCY')
ON CONFLICT (course_id, machine_id) DO NOTHING;

INSERT INTO engine_config DEFAULT VALUES;
NOTIFY pgrst, 'reload schema';
