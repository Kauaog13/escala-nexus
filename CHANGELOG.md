# Changelog

Todas as mudanças relevantes do **Escala Nexus** são registradas neste arquivo.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o versionamento segue o [Versionamento Semântico 2.0.0](https://semver.org/lang/pt-BR/).

---

## Regras de versionamento

### Formato da versão

`vMAJOR.MINOR.PATCH`, por exemplo `v0.1.0`.

| Parte | Quando incrementar | Exemplo no Escala Nexus |
|---|---|---|
| **MAJOR** | Mudança incompatível: altera o formato dos dados salvos, remove funcionalidade ou muda uma regra de negócio de forma que escalas antigas deixam de se comportar igual | Trocar o modelo de alocação ou o esquema do banco sem migração automática |
| **MINOR** | Funcionalidade nova compatível com o que já existe | Nova tela, novo curso suportado, novo termo no score |
| **PATCH** | Correção de defeito compatível, sem funcionalidade nova | Corrigir cálculo de salas, ajustar texto de explicação, corrigir cor |

### Fase 0.x (desenvolvimento inicial)

- Enquanto a versão for `0.y.z`, a API e os dados ainda podem mudar.
- Nesta fase, `MINOR` é usado para mudanças que quebram compatibilidade e para novas funcionalidades. `PATCH` é usado só para correções.
- A versão **`v1.0.0`** é lançada quando os 3 operadores usarem o sistema em um fim de semana real, com escala completa gerada em menos de 3 minutos.

### Mapa de versões planejadas

| Versão | Marco |
|---|---|
| `v0.0.0` | Documentação e design aprovados, ainda sem código de aplicação |
| `v0.1.0` | Sprint 1: schema, seeds e CRUD |
| `v0.2.0` | Sprint 2: motor determinístico |
| `v0.3.0` | Sprint 3: grade interativa e overrides |
| `v0.4.0` | Sprint 4: telemetria, auditoria e ajuste fino |
| `v1.0.0` | Uso em produção pelos operadores |

### Regras gerais

1. Toda mudança que afeta o usuário ou os dados entra neste arquivo, na seção `[Não lançado]`, no mesmo commit que a alterou.
2. Ao lançar, a seção `[Não lançado]` vira `[vX.Y.Z] - AAAA-MM-DD` e uma nova seção `[Não lançado]` vazia é criada acima.
3. Cada versão recebe uma tag Git anotada: `git tag -a vX.Y.Z -m "Escala Nexus vX.Y.Z"`.
4. Mudanças em regras de negócio (RN01 a RN11) e nos pesos do score `w1..w4` devem ser citadas explicitamente.
5. Mudanças no banco devem citar o nome da migração.
6. Uma versão publicada nunca é editada. Correções saem em uma nova versão.

### Categorias de entrada

| Categoria | Uso |
|---|---|
| **Adicionado** | Funcionalidades novas |
| **Alterado** | Mudanças em funcionalidades existentes |
| **Obsoleto** | Itens que serão removidos |
| **Removido** | Itens removidos |
| **Corrigido** | Correção de defeitos |
| **Segurança** | Correções ligadas a segurança ou privacidade |

### Convenção de commits

Mensagens seguem o [Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0/), em português:

`tipo(escopo): descrição curta no imperativo`

| Tipo | Efeito na versão |
|---|---|
| `feat` | MINOR |
| `fix` | PATCH |
| `feat!` ou rodapé `BREAKING CHANGE:` | MAJOR (ou MINOR na fase 0.x) |
| `docs`, `refactor`, `test`, `chore`, `build`, `ci` | Sem alteração de versão por si só |

Escopos sugeridos: `domain`, `db`, `ui`, `config`, `docs`.

---

## [Não lançado]

---

## [v0.4.0] - 2026-11-12

Entrega da **Sprint 4 — Telemetria, auditoria e ajuste fino** (tarefas 4.1 a 4.7).

### Adicionado

- Painel de telemetria e métricas operacionais Kaizen (`src/ui/components/AuditAndConcurrencyView.tsx`):
  - percentual de alocações com Match Ideal (`1ª Opção`), percentual de estabilidade por herança de sala, total de transportes entre andares na semana, tempo de execução do motor em milissegundos, travas e gargalos ativos;
  - contador de frequência de overrides manuais por curso (`overrideCounterByCourseId`) como ciclo de feedback para calibrar os pesos.
- Painel interativo de calibração dos pesos desacoplados (`w1Fit`, `w2Proximity`, `w3Transport`, `w4Stability` e `upgradeThreshold`) com recálculo imediato da escala sem alteração de código.
- Histórico de versões da escala (`scheduleVersions`) ao publicar (`PUBLISHED`) ou alterar em andamento (`CHANGED`).
- Exportação e importação completa de backup `.json` (`exportBackupJson` e `importBackupJson`).

---

## [v0.3.0] - 2026-11-12

Entrega da **Sprint 3 — Grade interativa e overrides** (tarefas 3.1 a 3.14).

### Adicionado

- Componente `SchedulePlannerBoard.tsx` com planejador por turno (`SEXTA_MANHA`, `SEXTA_TARDE`, `SABADO_MANHA`, `SABADO_TARDE`, `DOMINGO_MANHA`) e controle de estado da escala (`Rascunho`, `Oficial Publicada`, `Alterada em Andamento` — RN11).
- Formulário de lançamento de curso por turno com cálculo automático de salas `⌈alunos / 2⌉`, bloco de salas sugerido (`DEC-B`), seletor manual de consultórios (`DEC-A`) e escolha de aparelhos para cursos de Controle Manual (`RN08`).
- Grade interativa dos 33 consultórios (1º e 2º andar) estilizada com o Design System Nexus (§7):
  - chip **"Por quê?"** em cada consultório exibindo a fórmula desacoplada e a justificativa em PT-BR;
  - trava manual (**Pin** com cadeado), salto de sala por distância do laudo (`RN09`) e botão **Desfazer (Undo)**;
  - troca rápida (**Hot-Swap**) com detecção em tempo real de colisão de patrimônio e oferta automática de **Permuta entre salas** (`RN10`);
  - simulação e tratamento de quebra de equipamento em andamento com alerta e proposta de **Menor Mudança (`DEC-E`)**.
- Gerador de **Relatório de Logística entre Turnos (`RF06`)** (`buildShiftTransitionReport`), separando máquinas que permanecem na mesma sala, máquinas que mudam de sala no mesmo andar e máquinas transportadas entre pavimentos.
- Exportador oficial no **Padrão de WhatsApp da Nexus (`RF07`)** (`formatWeekWhatsAppText`), com inserção automática da tag `*2° ANDAR*`, códigos limpos (`DEC-04`), nota operacional de rodapé editável e cópia em 1 clique / download `.txt`.

---

## [v0.2.0] - 2026-11-12

Entrega da **Sprint 2 — Motor determinístico** (tarefas 2.1 a 2.14).

### Adicionado

- Termos isolados da função objetivo em `src/domain/scoring/terms.ts`: `calculateClinicalFit` (`100 / 60 / 20`), `calculateProximityBonus` (`30 / 10 / 0`), `calculateFloorTransportPenalty` (`5 / 3 / 2 / 1 / 0`) e `calculateStabilityBonus` (`40 / 0`), combinados em `evaluateCandidateScore`.
- Gerador de explicações auditáveis em PT-BR (`src/domain/explain/buildExplanation.ts`) seguindo o padrão `Score_Final = (w1 * Fit_Clinico [100]) + (w2 * Bonus_PC_Laudo [30]) - (w3 * Penalidade_Andar [0]) = 130 pts`.
- Filtro de restrições rígidas (`filterEligibleMachinesForCourse`) e sugestor de bloco de salas por Zonas Radiais e herança (`suggestRoomBlockForCourse`) em `src/domain/rules/eligibility.ts`.
- Motor de alocação por turno e semanal (`allocateShift`, `allocateWeek`) e recálculo de menor mudança em manutenção (`recalculateOnMachineMaintenance` — `DEC-E`) em `src/domain/engine/allocate.ts`, respeitando a ordem de rendição (`DEC-D`), herança de salas (`RN04`, `RN06`, `RN07`), Controle Manual (`RN08`) e upgrade com limiar (`RN05`).
- Suíte de testes do motor (`tests/engine.test.ts`) e testes golden com o cenário operacional real de conflito triplo `ECOF + MEFE + GIOB` e descida do `GIOB` (`tests/golden.test.ts`), executando a semana completa em `< 50 ms`.

---

## [v0.1.0] - 2026-11-11

Entrega completa da **Sprint 1 — Schema, seeds e CRUD** (tarefas 1.1 a 1.10).

### Adicionado

- Scaffold do projeto: Vite 5, React 18, TypeScript 5 (modo estrito), Tailwind 3, Zustand, ESLint 9, Prettier e Vitest.
- Estrutura em camadas: `src/domain` (puro), `src/application`, `src/infrastructure` (`supabase` e `local`), `src/ui` e `src/config`.
- Regra de ESLint que impede `src/domain/` de importar React, Supabase, Zustand, UI, infraestrutura ou aplicação, mantendo o motor puro (DEC-F).
- Tokens de cor Nexus (verde, branco e preto, §7 do documento de requisitos) no Tailwind e layout base com cabeçalho institucional.
- Migração `supabase/migrations/0001_schema.sql` com 17 tabelas normalizadas (DEC-G):
  - `UNIQUE (shift_id, machine_id)` e `UNIQUE (shift_id, room_id)` em `allocations` (RN10, RNF02);
  - trigger `assert_machine_usable` que impede alocar ou travar máquina em manutenção;
  - função `bump_shift_version` para concorrência otimista por turno;
  - RLS restrita a usuários autenticados.
- Seed completo em `supabase/seed.sql` e `src/config/seedData.ts`:
  - 29 máquinas oficiais com IDs únicos para unidades repetidas (`v6-01` a `v6-04`, `v5-01`, `v5-02`, `n8-01`, `n8-02`) e sondas pré-mapeadas;
  - 6 sondas (`CONVEXO`, `LINEAR`, `ENDOVAGINAL`, `VOLUMETRICO_4D`, `SETORIAL_NEONATAL`, `ELASTOGRAFIA`);
  - 33 consultórios com Zonas Radiais 1, 2 e 3 e pontuação de proximidade dos PCs de laudo (`30 / 10 / 0`);
  - 22 cursos oficiais da Nexus (9 Pós-Graduações e 13 Modulares, §4.1 e §4.2) e matriz inicial de máquinas preferenciais (`IDEAL`, `SECONDARY`, `CONTINGENCY`).
- Validações puras de integridade ACID em `src/domain/rules/constraints.ts`: `DuplicateMachineAllocationError`, `DuplicateRoomAllocationError`, `MachineInMaintenanceError` e `OptimisticConcurrencyError` (HTTP 409).
- Repositório Local-First (`src/infrastructure/local/localDatabase.ts`) com persistência em `localStorage` e conector REST para o Supabase (`src/infrastructure/supabase/supabaseClient.ts`).
- Autenticação simples dos 3 operadores no cabeçalho (`src/ui/App.tsx`), com troca e renomeação de operador ativo e preenchimento automático de `updatedBy` e `auditLog` (tarefa 1.9).
- Interface de gestão da Sprint 1:
  - `MachineInventoryView.tsx`: CRUD de máquinas, troca de status (`Ativo`, `Manutenção`, `Empréstimo/Demo`) e de sondas em **1 clique** (< 3 cliques, tarefa 1.7) e seletor de Andar Inicial (Snapshot DEC-C);
  - `CoursesCatalogView.tsx`: CRUD de cursos, edição de prioridade, ordem de rendição (`surrenderRank`) e matriz interativa de máquinas `1ª Opção / 2ª Opção / Contingência` em 1 clique (tarefa 1.8);
  - `RoomsTopologyView.tsx`: revisão das 33 salas, Zonas Radiais 1/2/3 e proximidade dos PCs de laudo;
  - `AuditAndConcurrencyView.tsx`: histórico de auditoria em tempo real e simulador interativo de salvamento transacional e concorrência otimista (`version`, tarefa 1.10).
- Suíte de testes (`tests/schema.test.ts` e `tests/repository.test.ts`) cobrindo seeds, CRUDs, bloqueio de duplicidade de máquina/sala, bloqueio de máquina em manutenção e conflito de versão concorrente (17 testes passando).

### Pendências conhecidas

- A migração e o seed SQL aguardam a criação do projeto Supabase (tarefa 0.6) para execução em instância PostgreSQL remota; localmente, todas as restrições ACID e seeds já rodam e são validadas pelo repositório Local-First.
- Calibração fina com os operadores da matriz `course_machine_rules` (H2) e das pontuações de zona (`30 / 10 / 0`) diretamente pela tela de revisão entregue nesta versão.

---

## [v0.0.0] - 2026-11-11

Marco inicial do projeto: análise, design e planejamento. Ainda não há código de aplicação.

### Adicionado

- Documento de análise de requisitos v4.0 (`docs/analise-requisitos-escala-nexus.md`), com regras de negócio RN01 a RN11, inventário de 29 máquinas, 33 salas, matriz de cursos, design system Nexus e esquema de dados.
- Design validado (`docs/design-escala-nexus.md`), com Understanding Lock, premissas, Decision Log (DEC-A a DEC-G), diagrama ER, fluxograma de alocação e roadmap.
- Plano de implementação (`docs/plano-implementacao-escala-nexus.md`), com Sprint 0 e Sprints 1 a 4, critérios de pronto, testes e riscos.
- Skill `brainstorming` instalada em `.agents/skills/brainstorming/`, do repositório `sickn33/agentic-awesome-skills`.
- Logotipo da Nexus em `assets/logo-principal.svg`.
- Este `CHANGELOG.md` com as regras de versionamento.

### Decisões registradas

- **DEC-A:** o operador escolhe as salas e o motor sugere as máquinas. As zonas são score de apoio.
- **DEC-B:** bloco de salas sugerido e pré-preenchido, editável.
- **DEC-C:** estado inicial das máquinas herdado da última escala salva.
- **DEC-D:** ordem de rendição entre cursos fixa e editável.
- **DEC-E:** em quebra de máquina, o sistema alerta e propõe a menor mudança, confirmada pelo operador.
- **DEC-F:** motor puro em camadas, em TypeScript no cliente.
- **DEC-G:** banco normalizado com `UNIQUE (turno, máquina)` e `UNIQUE (turno, sala)`.

### Pendências conhecidas

- Validar com os operadores as hipóteses H2 (exigências por curso), H4 (custo de transporte) e H8 (valores iniciais do score).
- Confirmar quais salas do 2º andar são próximas do laudo e a ordem de rendição inicial.
