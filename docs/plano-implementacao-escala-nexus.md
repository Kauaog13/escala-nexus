# Plano de Implementação — Escala Nexus

**Base:** `docs/design-escala-nexus.md` (design validado, DEC-A a DEC-G).
**Princípio:** entregas pequenas, testáveis e que já funcionam sozinhas. Cada sprint termina com um critério de pronto verificável.
**Stack (do documento v4.0):** React 18 + Vite + TypeScript, Tailwind + shadcn/ui, Zustand, Supabase (PostgreSQL), Vitest.

---

## 0. Antes de codificar (Sprint 0 — 1 a 2 dias)

| # | Tarefa | Saída | Quem decide | Status |
|---|---|---|---|---|
| 0.1 | Validar H2: lista de máquinas 1ª/2ª opção por curso | Planilha `curso × máquina × (1ª, 2ª, contingência)` revisada | Operadores | ✅ Implementado em `src/config/seedData.ts` + editável em `CoursesCatalogView.tsx` (⏳ validação final presencial com operadores) |
| 0.2 | Definir salas do 2º andar próximas do laudo e confirmar zonas do 1º | Tabela `sala → zona → proximidade` | Operadores | ✅ Implementado em `src/config/seedData.ts` + editável em `RoomsTopologyView.tsx` |
| 0.3 | Definir a ordem de rendição inicial entre cursos | Lista ordenada | Operadores | ✅ Implementado (`surrenderRank` 1 a 22 em `src/config/seedData.ts`) |
| 0.4 | Reunir 3 a 5 escalas reais (WhatsApp) para testes golden | Pasta `tests/fixtures/` com entradas e saídas esperadas | Operadores | ✅ Implementado em `tests/fixtures/fds-23-25-ecof-mefe-giob.json` e `tests/golden.test.ts` |
| 0.5 | Confirmar H4 e H8 (pesos e valores do score) | Valores iniciais em `config/` | Equipe técnica + operadores | ✅ Implementado em `SEED_ENGINE_CONFIG` e `src/domain/scoring/terms.ts` |
| 0.6 | Criar projeto Supabase e definir autenticação dos 3 operadores | Projeto e credenciais em `.env` (fora do Git) | Equipe técnica | ✅ Concluído (`.env.local` configurado e ignorado pelo Git) |

> Se 0.1 a 0.4 não estiverem prontos, o Sprint 2 usa dados provisórios do documento v4.0. Os resultados ficam marcados como "não validados".

---

## 1. Sprint 1 — Schema, seeds e CRUD (`✅ 100% Concluída — v0.1.0`)

**Objetivo:** dados confiáveis e impossibilidade de duplicidade no banco.

| # | Tarefa | Critério de pronto | Status |
|---|---|---|---|
| 1.1 | Scaffold: Vite + React + TS, Tailwind, ESLint, Prettier, Vitest, estrutura `domain/ application/ infrastructure/ ui/ config/` | `npm run build` e `npm test` passam | ✅ Concluído (`package.json`, `eslint.config.js`, `tsconfig.json`) |
| 1.2 | Tokens de cor Nexus (verde, branco e preto, §7 do documento) em Tailwind | Tema aplicado ao layout base | ✅ Concluído (`tailwind.config.js`, `src/ui/App.tsx`) |
| 1.3 | Migrações SQL normalizadas (ver 5.2 do design): `machines`, `probes`, `machine_probes`, `rooms`, `courses`, `course_machine_rules`, `weekly_schedules`, `shifts`, `shift_demands`, `allocations`, `allocation_explanations`, `manual_locks`, `machine_location_snapshots`, `engine_config`, `schedule_versions`, `audit_log` | Migração roda do zero em banco limpo | ✅ Concluído (`supabase/migrations/0001_schema.sql`) |
| 1.4 | Restrições: `UNIQUE (shift_id, machine_id)`, `UNIQUE (shift_id, room_id)`, `CHECK` de status, `version` por turno | Teste SQL: inserir duplicata falha | ✅ Concluído (`src/domain/rules/constraints.ts`, `tests/schema.test.ts`) |
| 1.5 | Seeds: 29 máquinas (códigos únicos `V6-01`…), 33 salas com zona, catálogo de cursos e regras 1ª/2ª opção | Contagens batem: 29, 33, cursos do §4 | ✅ Concluído (`supabase/seed.sql`, `src/config/seedData.ts`) |
| 1.6 | Repositórios em `infrastructure/supabase/` e cache local em `infrastructure/local/` | Leitura e escrita com e sem rede | ✅ Concluído (`localDatabase.ts`, `supabaseClient.ts`) |
| 1.7 | CRUD de inventário: listar, adicionar, editar, status (Ativo, Manutenção, Empréstimo), sondas | Operador altera status em < 3 cliques | ✅ Concluído (`MachineInventoryView.tsx` — 1 clique) |
| 1.8 | CRUD de cursos e regras de máquinas preferenciais | Edição reflete no banco | ✅ Concluído (`CoursesCatalogView.tsx`) |
| 1.9 | Autenticação simples dos 3 operadores e campo `updated_by` | Login funciona e fica registrado | ✅ Concluído (`App.tsx`, `localDatabase.ts`) |
| 1.10 | Salvamento de turno em transação única com `version` (concorrência otimista) | Teste: segundo salvamento com versão antiga recebe conflito | ✅ Concluído (`saveShiftTransactional`, `tests/repository.test.ts`) |

**Risco da sprint:** dados de entrada errados (H2). **Mitigação:** tela de revisão do inventário e das regras por curso, validada pelos operadores antes do Sprint 2.

---

## 2. Sprint 2 — Motor determinístico (`✅ 100% Concluída — v0.2.0`)

**Objetivo:** o motor gera sugestões corretas e explicáveis, sem depender de banco ou tela.

| # | Tarefa | Critério de pronto | Status |
|---|---|---|---|
| 2.1 | Tipos do domínio em `domain/types/` | Sem dependência de React ou Supabase | ✅ Concluído (`src/domain/types/index.ts`) |
| 2.2 | Filtro rígido (`domain/rules/`): status ativo, lista de opções do curso, unicidade no turno, pins | Testes unitários por regra | ✅ Concluído (`src/domain/rules/eligibility.ts`) |
| 2.3 | Termos do score (`domain/scoring/`): `fit`, `proximity`, `transport`, `stability`, cada um isolado | Cada termo tem teste com valores da tabela do design | ✅ Concluído (`src/domain/scoring/terms.ts`, `tests/engine.test.ts`) |
| 2.4 | Pesos e ordem de rendição lidos de `config/` | Mudar peso muda o resultado sem alterar código | ✅ Concluído (`SEED_ENGINE_CONFIG`, `updateEngineWeights`) |
| 2.5 | Herança (RN04, RN06, RN07) e estado inicial vindo do snapshot (DEC-C) | Teste: curso contínuo mantém salas e máquinas | ✅ Concluído (`allocateShift`, `allocateWeek`) |
| 2.6 | Atribuição por curso na ordem de rendição, com desempate por código | Mesmo input gera sempre o mesmo output | ✅ Concluído (`sortDemandsBySurrenderOrder`, `allocate.ts`) |
| 2.7 | Gargalos: demanda acima do parque, falta de máquina elegível | Retorna lista de gargalos, nunca lança erro | ✅ Concluído (`PARK_CAPACITY_EXCEEDED`, `NO_ELIGIBLE_MACHINE`) |
| 2.8 | Sugestão de bloco de salas (DEC-B) pelas zonas e pela herança | Teste: Zona 1 é preferida quando livre | ✅ Concluído (`suggestRoomBlockForCourse`) |
| 2.9 | Controle Manual (RN08): cursos manuais param e pedem escolha | Teste: Fígado e Hemodinâmica Neonatal retornam "aguardando operador" | ✅ Concluído (`MANUAL_CONTROL_REQUIRED` em `allocate.ts`) |
| 2.10 | Upgrade com limiar (RN05) | Teste: não troca se o ganho for menor que o limiar | ✅ Concluído (`upgradeThreshold` em `allocate.ts`) |
| 2.11 | Explicações em PT-BR (`domain/explain/`) com o padrão do design | Texto cita curso, zona, andar e score | ✅ Concluído (`src/domain/explain/buildExplanation.ts`) |
| 2.12 | Menor mudança em quebra de máquina (DEC-E) | Teste: só a sala afetada muda | ✅ Concluído (`recalculateOnMachineMaintenance`) |
| 2.13 | Testes golden com as escalas reais da Sprint 0 | Divergências documentadas e justificadas | ✅ Concluído (`tests/golden.test.ts`, `tests/fixtures/`) |
| 2.14 | Testes de propriedade e de perturbação | Nenhuma duplicidade em entradas aleatórias; tirar 1 Voluson muda no máximo N salas | ✅ Concluído (`tests/property-perturbation.test.ts`) |

**Meta de desempenho:** semana inteira em < 50 ms (H7), medido em teste (`~4 a 15 ms` nos testes automatizados).

---

## 3. Sprint 3 — Grade interativa e overrides (`✅ 100% Concluída — v0.3.0 / v0.5.0`)

**Objetivo:** o operador monta e altera uma escala completa em menos de 3 minutos.

| # | Tarefa | Critério de pronto | Status |
|---|---|---|---|
| 3.1 | Planejador por dia e turno (Seg a Dom, Manhã/Tarde/Dia Todo), padrão Sex, Sáb e Dom | RN01 atendida | ✅ Concluído (`AVAILABLE_WEEK_SHIFTS`, `upsertFullDayDemand`) |
| 3.2 | Lançamento de curso: alunos, cálculo de salas `⌈alunos/2⌉`, ajuste manual | Valores editáveis | ✅ Concluído (`SchedulePlannerBoard.tsx`) |
| 3.3 | Seletor de salas com bloco sugerido e ajuste com um clique | DEC-B atendida | ✅ Concluído (`suggestRoomsForCourseInShift` + seletor 1 clique) |
| 3.4 | Grade de salas com cartões e cores do §7 | Verde, âmbar, vermelho e cinza conforme o estado | ✅ Concluído (`FloorMapContainer.tsx`) |
| 3.5 | Chip "Por quê?" com detalhamento do score | Mostra os 4 termos em português | ✅ Concluído (`FloorMapContainer.tsx`) |
| 3.6 | Pin, arrastar e soltar, permuta em conflito (RN10) e desfazer | Conflito detectado em tempo real | ✅ Concluído (Drag-and-Drop HTML5 + `evaluateManualMachineChange`) |
| 3.7 | Quarentena de máquina com alerta e proposta de menor mudança (DEC-E) | Operador aceita ou troca manualmente | ✅ Concluído (`quarantineMachineInShift`, `applyPendingMaintenanceProposal`) |
| 3.8 | Banner de transporte entre andares | Lista as máquinas, com ícone para as pesadas | ✅ Concluído (`shiftFloorMoves` em `SchedulePlannerBoard.tsx`) |
| 3.9 | Relatório de transição entre turnos (RF06) | Separa "permanece" de "transportar" | ✅ Concluído (`buildShiftTransitionReport`) |
| 3.10 | Exportação no formato WhatsApp com nota de rodapé automática e botão de cópia (RF07) | Texto idêntico ao padrão da escola | ✅ Concluído (`formatWeekWhatsAppText`) |
| 3.11 | Estados da escala: Rascunho, Oficial Publicada, Alterada em Andamento (RN11) | Escala publicada só muda com confirmação | ✅ Concluído (`ScheduleStatus` + histórico de versões) |
| 3.12 | Clonagem e histórico de escalas (RF08) | Duplica estrutura de um fim de semana anterior | ✅ Concluído (`cloneScheduleForNextWeek`, `restoreScheduleVersion`) |
| 3.13 | Sincronização offline e tratamento de conflito de versão | "Pendente de sincronização" visível | ✅ Concluído (`SyncConnectionState`, `AuditAndConcurrencyView.tsx`) |
| 3.14 | Responsividade para celular (RNF04) | Usável em tela pequena | ✅ Concluído (grids responsivos Tailwind `sm/md/lg`) |

**Teste de aceitação:** um operador, com cronômetro, monta ECOF + MEFE + GIOB para um fim de semana real.

---

## 4. Sprint 4 — Telemetria, auditoria e ajuste fino (`✅ 100% Concluída em Código — v0.4.0 / v0.5.2`)

| # | Tarefa | Critério de pronto | Status |
|---|---|---|---|
| 4.1 | Audit log completo: quem mudou o quê e quando | Toda alteração fica registrada | ✅ Concluído (`appendAudit`, `AuditAndConcurrencyView.tsx`) |
| 4.2 | Registro de overrides (qual regra o operador corrigiu) | Painel por regra | ✅ Concluído (`overrideCounterByCourseId`) |
| 4.3 | Métricas: transportes entre andares, tempo até publicar, gargalos por semana | Painel simples | ✅ Concluído (Cards Kaizen em `AuditAndConcurrencyView.tsx`) |
| 4.4 | Calibração de `w1..w4` com dados de 4+ fins de semana | Valores revisados em `config/` | ✅ Painel interativo pronto (⏳ coleta contínua durante 4+ fins de semana reais) |
| 4.5 | Backup e importação em `.json` | Restaura uma escala completa | ✅ Concluído (`exportBackupJson`, `importBackupJson`) |
| 4.6 | Preparar o `FloorMapContainer` para a planta baixa futura | Visão em grade continua funcionando | ✅ Concluído (`src/ui/components/FloorMapContainer.tsx` com Grade + Planta Radial) |
| 4.7 | Deploy em produção e manual curto do operador | Os 3 operadores usam em um fim de semana real | ✅ Concluído (`vercel.json`, `docs/manual-operador-escala-nexus.md`, `HelpModal.tsx` — ⏳ uso presencial pelos operadores para tag `v1.0.0`) |

---

## 5. Estratégia de testes e qualidade

| Camada | Ferramenta | Cobertura mínima | Status |
|---|---|---|---|
| `domain/` | Vitest (unitário, propriedade, perturbação, golden) | Alta, é o coração do sistema | ✅ `tests/engine.test.ts`, `tests/golden.test.ts`, `tests/property-perturbation.test.ts` |
| Banco | Testes SQL das restrições | `UNIQUE`, `CHECK` e `version` | ✅ `tests/schema.test.ts`, `tests/repository.test.ts` |
| UI / Fluxo | Testes de componente e fluxo principal | Gerar, intervir, exportar | ✅ `tests/operator-workflow.test.ts` |
| Aceitação | Cronômetro com operador real | < 3 minutos | ⏳ Teste presencial com operador (marco para `v1.0.0`) |

**CI:** lint, tipos e testes a cada commit (`.github/workflows/ci.yml`). Migrações validadas em banco limpo.

---

## 6. Riscos e mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Dados de curso e máquinas errados | Escalas erradas com aparência de confiança | Sprint 0 e tela de revisão no Sprint 1 |
| Pesos mal calibrados | Sugestões ruins | Pesos em configuração, testes golden e calibração no Sprint 4 |
| Conflito entre operadores | Perda de edição | Versão otimista e mesclagem guiada |
| Perda de internet | Operação parada | Local-first com cache e sincronização |
| Mudança de regra no meio do projeto | Retrabalho | Regras como dado e motor puro |

---

## 7. Definição de pronto (global)

- [x] Nenhuma máquina duplicada no mesmo turno, nem por SQL direto.
- [x] O motor é determinístico: mesma entrada, mesma saída.
- [x] Pins nunca são removidos pelo motor.
- [x] Toda sugestão tem explicação em português.
- [x] Escala completa gerada pelo motor em `< 50 ms` (pronta para operação em `< 3 minutos`).
- [x] As escalas reais de teste são reproduzidas, com divergências justificadas.
