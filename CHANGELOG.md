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

## [v0.5.3] - 2026-11-12

Refatoração de desacoplamento da herança de salas por curso no motor (RN06), snapshots reais e rollback de versões (RF08 e RN11), resolução guiada de concorrência otimista (409) e manual interativo na UI.

### Adicionado

- **Rollback e Restauração de Versões Anteriores (`RF08` e `RN11`):**
  - Armazenamento de snapshots completos de alocações e explicações em `ScheduleVersionRecord` (`src/infrastructure/local/localDatabase.ts`);
  - Método `restoreScheduleVersion(versionId)` no banco local e exposto na store Zustand (`src/application/store.ts`);
  - Botão de restauração com badge e data formatada na tabela de versões em `src/ui/components/AuditAndConcurrencyView.tsx`;
  - Teste de integração de rollback validado na suíte de workflow (`tests/operator-workflow.test.ts`).
- **Resolução Guiada de Conflito Concorrente (`src/ui/components/AuditAndConcurrencyView.tsx` — §5.6):**
  - Banner dinâmico com ações guiadas em caso de erro 409 (`OptimisticConcurrencyError`): "Recarregar Versão Atual" e "Mesclar e Forçar Sobrescrita", preservando autonomia do operador sem travamentos.
- **Modal Interativa de Ajuda e Manual Rápido (`src/ui/components/HelpModal.tsx` e `src/ui/App.tsx`):**
  - Modal acessível no cabeçalho contendo resumo dos 4 passos operacionais (Inventário, Lançamento de Turmas com blocos sugeridos, Ajustes finos com detecção de permuta anti-colisão e Exportação WhatsApp com cópia em 1 clique);
  - Guia de atalhos e boas práticas de transição entre andares.
- **Auditoria de Conformidade das Sprints (`docs/plano-implementacao-escala-nexus.md`):**
  - Mapeamento exaustivo do status de implementação das Sprints 0, 1, 2, 3 e 4, formalizando 100% de cobertura de código para todas as regras de negócio (`RN01` a `RN11`) e decisões arquiteturais (`DEC-A` a `DEC-F`).

### Alterado

- **Desacoplamento Determinístico da Herança de Salas (`RN06` em `src/domain/engine/allocate.ts` e `src/domain/types/index.ts`):**
  - Adicionado campo opcional `previousDemands?: ShiftDemand[]` em `ShiftAllocationInput` e propagado em `allocateWeek`;
  - `allocateShift` agora mapeia o vínculo curso-demanda em $O(1)$ determinístico (`prevCourseByDemandId`), eliminando a heurística frágil anterior de busca por prefixo textual no identificador da demanda. Mantida pureza arquitetural estrita (`DEC-F`) com zero imports de UI/infraestrutura.

Visualização de diff no recálculo da escala (§5.5), suíte de testes de workflow do operador (Seção 5), pipeline de CI e documentação do repositório.

### Adicionado

- **Visualização de Diff no Recálculo da Escala (`src/application/store.ts` e `src/ui/components/SchedulePlannerBoard.tsx` — §5.5):**
  - Implementação de `computeAllocationsDiff`, `lastRecalcDiff` e `dismissRecalcDiff` na store;
  - Banner informativo dinâmico pós-recálculo exibindo exatamente quais salas trocaram de máquina ou confirmando 100% de estabilidade mantida.
- **Suíte de Testes de Workflow do Operador (`tests/operator-workflow.test.ts` — Seção 5):**
  - Testes cobrindo o fluxo operacional ponta a ponta: recálculo com diff, permuta automática anti-duplicidade em colisão de patrimônio (`RN10`) com histórico de `Undo`, e quarentena de equipamento quebrado com menor mudança (`DEC-E`), atualização de status para `CHANGED` e exportação WhatsApp (`RF07`).
  - Total de 38 testes automatizados aprovados nas 7 suítes do Vitest.
- **Pipeline de Integração Contínua (CI) e Configuração de Deploy (`.github/workflows/ci.yml` e `vercel.json`):**
  - Workflow do GitHub Actions validando lint (incluindo trava arquitetural de pureza do domínio `DEC-F`), tipagem TypeScript estrita, suítes de testes completas e build de produção no Node 20;
  - Configuração de deploy de produção SPA em `vercel.json`.
- **Documentação Principal do Repositório (`README.md`):**
  - Apresentação completa do projeto, inventário, objetivos clínicos, comandos de build/teste e índice para todos os manuais e especificações técnicas.

---

## [v0.5.1] - 2026-11-12

Consolidação da suíte de testes de propriedade e perturbação, fixtures reais de fins de semana, sincronização sob demanda com Supabase e fechamento das Sprints 0 a 4.

### Adicionado

- **Fixtures Reais de Fins de Semana (`tests/fixtures/` — Tarefas 0.4 e 2.13):**
  - Adicionados `tests/fixtures/fds-23-25-ecof-mefe-giob.json` e `tests/fixtures/whatsapp-expected-fds-23-25.txt` contendo o cenário golden oficial de conflito triplo no sábado de manhã (`ECOF + MEFE + GIOB = 23 salas`) e transição com descida do GIOB no sábado à tarde.
- **Suíte de Testes de Propriedade, Perturbação e Casos de Borda (`tests/property-perturbation.test.ts` — Tarefa 2.14 e §5.6):**
  - **Invariante RN10:** 30 simulações combinatórias pseudoaleatórias com semente determinística garantindo zero duplicatas de máquina ou consultório no turno;
  - **Perturbação Controlada:** simulação de quebra do Voluson Signature substituindo exatamente 1 equipamento do turno;
  - **Semana de Movimento Zero (§5.6):** garantia de 0 transportes entre andares e 100% de salas herdadas quando a demanda é contínua;
  - **Validação de Performance (H7):** execução da escala completa a partir de fixtures em `< 50 ms`.
- **Sincronização em Lote e Sob Demanda com Supabase REST (`src/infrastructure/supabase/supabaseClient.ts` e `src/application/store.ts` — Tarefas 1.6 e 3.13):**
  - Implementadas as funções `syncCatalogBatchToSupabase`, `syncRoomToSupabase`, `syncEngineConfigToSupabase` e a ação `syncNowWithSupabase`;
  - Botão interativo no cabeçalho (`src/ui/App.tsx`) permitindo forçar a sincronização de catálogo, consultórios e pesos com o Supabase com feedback visual imediato de status (`Sincronizado`, `Pendente`, `Local-Only`).
- **Atualização do Roadmap e Documentos:**
  - Status de conclusão de todas as sprints (0 a 4) registrado em `docs/design-escala-nexus.md` e `docs/plano-implementacao-escala-nexus.md`. Total de 35 testes passando nas 6 suítes.

---

## [v0.5.0] - 2026-11-12

Refinamentos finais das Sprints 3 e 4: planta radial interativa, drag-and-drop, turnos flexíveis, regime dia todo, clonagem com herança e manual do operador.

### Adicionado

- **Planta Radial de Laudo e Grade Operacional (`FloorMapContainer.tsx` — §9 e Tarefas 3.6 / 4.6):**
  - visualização em dois modos: Grade Operacional e Planta Radial interativa mapeando a Ilha Central de Laudo com os anéis concêntricos da Zona 1 (+30 pts), Zona 2 (+10 pts) e Zona 3 linear no 2º andar;
  - suporte nativo a Drag-and-Drop (HTML5) nos cartões de consultório, permitindo arrastar aparelhos entre salas para acionar permuta automática (`RN10`).
- **Turnos Flexíveis de Segunda a Domingo (`RN01` e Tarefa 3.1):**
  - suporte a templates de todos os dias da semana (`AVAILABLE_WEEK_SHIFTS`), permitindo adicionar e remover turnos com ordenação cronológica automática;
  - seletor de regime de lançamento no formulário: **Apenas Turno Atual** vs. **Dia Todo (Manhã + Tarde — `RN06`)**, lançando a turma e espelhando as salas automaticamente em ambos os períodos do dia.
- **Clonagem de Escala com Herança de Pavimento (`RF08` e `DEC-C` — Tarefa 3.12):**
  - botão **"Clonar p/ Próximo FDS"** que gera uma nova escala em rascunho preservando o histórico da semana anterior e herdando a localização final das máquinas do último turno como `initialFloors` da nova semana.
- **Indicador de Sincronização Local/Nuvem (`SyncConnectionState` — Tarefa 3.13):**
  - indicador no cabeçalho exibindo estados: `Sincronizado (Supabase Realtime)`, `Sincronizando na Nuvem...` ou `Local-First (Offline-Ready)`.
- **Manual Rápido do Operador (`docs/manual-operador-escala-nexus.md` — Tarefa 4.7):**
  - guia operacional de 5 minutos explicando o fluxo semanal: conferência de parque, lançamento de turmas, ajustes finos (*Human-in-the-Loop*), tratamento de quebra com menor mudança (`DEC-E`) e exportação para o WhatsApp (`RF07`).
- **Testes Unitários Adicionais (`tests/repository.test.ts`):**
  - testes cobrindo a adição de turnos da semana, o lançamento em regime Dia Todo (`RN06`) e a clonagem de escala com herança de andar (`RF08` / `DEC-C`). Totalizando 31 testes passando nas 5 suítes.

### Alterado

- `vite.config.ts`: configuração explícita de `envPrefix: ['VITE_']` para isolar estritamente variáveis de ambiente privadas do bundle de cliente.

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
