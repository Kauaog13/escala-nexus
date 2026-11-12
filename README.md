# Escala Nexus — Sistema Inteligente de Alocação de Ultrassom

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38b2ac.svg)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-3ecf8e.svg)](https://supabase.com/)
[![Vitest](https://img.shields.io/badge/Vitest-38_passed-brightgreen.svg)](https://vitest.dev/)
[![License](https://img.shields.io/badge/Licença-Proprietária_Nexus-09090b.svg)](https://nexusultrassonografia.com.br/)

Sistema web **Local-First com Sincronização em Nuvem (Supabase)** desenvolvido para a equipe de Operações e Logística Clínica da **Academia Nexus** (Brasília/DF e São Paulo/SP).

O sistema automatiza e otimiza a distribuição semanal de **29 máquinas de ultrassom** (GE Voluson/Logiq, Samsung Linha V/RS, Mindray Resona/Consona, Canon Aplio, SonoScape e Vinno) nos **33 consultórios** da unidade (23 no 1º andar e 10 no 2º andar), respeitando a hierarquia clínica de cursos, a proximidade às estações de laudo (Zonas Radiais), a minimização de transporte físico entre andares e a total autonomia do operador (*Human-in-the-Loop*).

---

## Sumário

1. [Visão Geral e Objetivos Clínicos](#visão-geral-e-objetivos-clínicos)
2. [Pré-requisitos](#pré-requisitos)
3. [Instalação e Execução Rápida](#instalação-e-execução-rápida)
4. [Configuração de Variáveis de Ambiente](#configuração-de-variáveis-de-ambiente)
5. [Configuração do Banco de Dados (Supabase)](#configuração-do-banco-de-dados-supabase)
6. [Manual Operacional Rápido (4 Passos)](#manual-operacional-rápido-4-passos)
7. [Arquitetura e Estrutura de Pastas](#arquitetura-e-estrutura-de-pastas)
8. [Comandos de Testes e Qualidade](#comandos-de-testes-e-qualidade)
9. [Segurança e Respeito a Segredos](#segurança-e-respeito-a-segredos)
10. [Documentação Técnica Completa](#documentação-técnica-completa)

---

## Visão Geral e Objetivos Clínicos

* **Parque de 29 Máquinas com Unicidade de Patrimônio (`RN10`):** Cada equipamento possui identificador único físico (ex: `v6-01` a `v6-04`, `v5-01`/`02`, `v7-01`, `signature`, `resona-i9`), prevenindo duplicidades acidentais no mesmo turno através de travas em 3 camadas (motor em memória, diálogo de permuta na interface e constraints `UNIQUE` no PostgreSQL).
* **Hierarquia Clínica e Conflito Triplo (`RN02` e `RN03`):** Cursos de Saúde da Mulher de alta complexidade (`ECOF`, `MEFE`, `Neurossonografia Fetal`) têm prioridade sobre equipamentos Voluson Premium, Resona I9 e Linha V. Em semanas de conflito triplo (`ECOF + MEFE + GIOB = 23 salas`), `ECOF` e `MEFE` ocupam o 1º andar e o `GIOB` é alocado no 2º andar.
* **Transição Inteligente de Almoço (`RN04`):** Quando o `ECOF` encerra no sábado ao meio-dia, o `GIOB` desce para o 1º andar herdando as salas e os melhores aparelhos, descendo apenas 3 máquinas do 2º andar e gerando a nota operacional explicativa automaticamente.
* **Proximidade aos Computadores de Laudo (`RN09` e §9):** Planta Radial integrada dividindo os consultórios em **Zona 1 (Núcleo Central: +30 pts)**, **Zona 2 (Periferia: +10 pts)** e **Zona 3 (2º Andar: 0 pts)**, permitindo concentração de turmas próximas aos computadores de laudo e salto opcional de salas distantes (1 a 5 e 9 a 10).
* **Operação Human-in-the-Loop (`RN08`):** Drag-and-Drop, bloqueio de alocação de cursos manuais (Elastografia Hepática, Neonatal, POCUS) até validação de transdutores, quarentena de manutenção com proposta de menor perturbação (`DEC-E`) e botão de desfazer (*Undo*).

---

## Pré-requisitos

Antes de iniciar, certifique-se de ter instalado no seu computador:

* **Node.js:** Versão 20 LTS ou superior ([nodejs.org](https://nodejs.org/))
* **Gerenciador de Pacotes:** `npm` (incluso com o Node) ou `pnpm`
* **Git:** Para clonar e gerenciar versões ([git-scm.com](https://git-scm.com/))
* **Navegador Web Moderno:** Google Chrome, Microsoft Edge, Firefox ou Safari

---

## Instalação e Execução Rápida

Em apenas **3 passos** no seu terminal (PowerShell, Command Prompt ou Bash):

```bash
# 1. Clone o repositório
git clone https://github.com/Kauaog13/escala-nexus.git
cd escala-nexus

# 2. Instale as dependências
npm install

# 3. Inicie o servidor de desenvolvimento
npm run dev
```

A aplicação estará disponível instantaneamente em:
👉 **`http://localhost:5173`**

> **Nota:** A aplicação foi arquitetada como **Local-First**. Você pode utilizá-la imediatamente para gerar escalas, mesmo sem configurar o banco de dados Supabase (os dados ficam salvos de forma resiliente no `localStorage` do seu navegador).

---

## Configuração de Variáveis de Ambiente

Para habilitar a sincronização em nuvem e a concorrência multi-operador com o Supabase, configure o arquivo de ambiente local:

1. Na raiz do projeto, crie um arquivo chamado `.env.local` baseado no [.env.example](.env.example):
   ```bash
   cp .env.example .env.local
   ```
2. Abra o arquivo `.env.local` e preencha as variáveis públicas do seu projeto Supabase:
   ```env
   # URL pública do seu projeto Supabase
   VITE_SUPABASE_URL=https://seu-projeto.supabase.co

   # Chave pública anônima (Publishable / Anon Key)
   VITE_SUPABASE_ANON_KEY=sb_publishable_... (ou eyJ... legada)
   ```

> **Aviso de Segurança:** Nunca versiona chaves secretas (`service_role` ou `SUPABASE_SECRET_KEY`) no repositório nem as exponha com prefixo `VITE_`. O arquivo `.env.local` já está devidamente ignorado no [.gitignore](.gitignore).

---

## Configuração do Banco de Dados (Supabase)

O Escala Nexus possui um script SQL consolidado e idempotente que cria todas as **17 tabelas relacionais**, funções de concorrência otimista (`bump_shift_version`), triggers de quarentena de manutenção e a carga inicial oficial (29 máquinas, 33 salas, 22 cursos e matriz de regras).

Você pode inicializar o banco de duas maneiras simples:

### Opção A — Pela Interface Web (1 Clique - Recomendado)

1. Com o projeto em execução (`npm run dev`), acesse a aplicação no navegador.
2. No cabeçalho superior, clique no botão com ícone de banco de dados (que exibirá **"Configurar Tabelas Supabase"** ou **"Pendente de Sincronização"**).
3. Na janela que se abrirá:
   * **Passo 1:** Clique em **"Copiar SQL Completo"** (o script será transferido para sua área de transferência).
   * **Passo 2:** Clique em **"Abrir SQL Editor"** para ir diretamente ao painel do seu projeto Supabase.
   * Cole o script no SQL Editor (`Ctrl + V`) e clique em **Run** (`Ctrl + Enter`).
   * **Passo 3:** Volte ao Escala Nexus e clique em **"Testar & Sincronizar"**. O status mudará imediatamente para **`Sincronizado (Supabase Realtime)`** na cor verde.

### Opção B — Manualmente via SQL Editor ou Supabase CLI

1. Abra o arquivo [supabase/full_setup.sql](supabase/full_setup.sql) gerado na raiz.
2. Copie todo o conteúdo.
3. No painel do Supabase ([supabase.com/dashboard](https://supabase.com/dashboard)), acesse **SQL Editor** -> **New Query**.
4. Cole o script e clique em **Run**.
5. Recarregue a página da aplicação.

---

## Manual Operacional Rápido (4 Passos)

A interface foi projetada para que a equipe de operações elabore a escala completa de um fim de semana em **menos de 3 minutos**:

```
[1. Inventário & Status] ➔ [2. Lançamento da Semana] ➔ [3. Ajustes Finos & Diff] ➔ [4. Exportação WhatsApp]
```

### 1. Inventário e Status Operacional (Aba 2)
* Verifique se algum aparelho está em manutenção ou empréstimo temporário.
* Clique no botão de status da máquina para alternar entre **Ativo**, **Em Manutenção** (quarentena imediata) ou **Empréstimo**.
* Máquinas em manutenção são automaticamente bloqueadas pelo motor e removidas das salas.

### 2. Planejador da Semana e Lançamento de Turmas (Aba 1)
* Selecione os turnos do fim de semana (**Sexta Tarde**, **Sábado Manhã**, **Sábado Tarde**, **Domingo Manhã**).
* Clique em **"Adicionar Turma"** no turno desejado:
  - Escolha o curso (ex: `PG US ECOF`, `PG US MEFE`, `PG US GIOB`);
  - Informe o número de alunos (o sistema calcula as salas considerando 2 alunos por consultório);
  - Escolha a permanência: `Só este turno` ou `Dia Todo` (garante as mesmas salas o dia inteiro via `RN06`);
  - Utilize os **Blocos Sugeridos** (ex: *Zona 1 - Núcleo de Laudo*) para alocar as turmas próximas às estações de trabalho.

### 3. Ajustes Finos e Permuta Anti-Duplicidade
* O motor determinístico distribui as melhores máquinas em menos de 5 milissegundos.
* Arraste e solte equipamentos entre salas ou troque pelo seletor de máquina.
* **Permuta Automática:** Caso selecione uma máquina já em uso em outra sala do mesmo turno, o sistema detecta o conflito na hora e pergunta se deseja permutar os aparelhos entre as duas salas (`RN10`), evitando colisões de patrimônio.
* Utilize o botão de **Trava (Pin)** para fixar uma máquina em uma sala específica.

### 4. Exportação Oficial para WhatsApp e Logística
* Clique em **"Exportar WhatsApp"** no topo da grade:
  - O texto é gerado rigorosamente no padrão da Academia Nexus (identificando turmas, salas, modelos de máquina, tag `*2º ANDAR*` e nota operacional de transição);
  - Clique em **"Copiar para WhatsApp"** (cópia em 1 clique) e cole no grupo operacional da Nexus.
* Consulte a aba **Logística entre Turnos** para visualizar a lista simplificada de transporte (quantas e quais máquinas sobem ou descem de andar).

---

## Arquitetura e Estrutura de Pastas

O projeto adota os princípios de **Domain-Driven Design (DDD)** com isolamento estrito de regras de negócio:

```text
escala-nexus/
├── docs/                               # Especificações de Requisitos, Design e Manuais
│   ├── analise-requisitos-escala-nexus.md
│   ├── design-escala-nexus.md
│   ├── plano-implementacao-escala-nexus.md
│   └── manual-operador-escala-nexus.md
├── src/
│   ├── domain/                         # Regras puras de negócio (Zero I/O e Zero dependências - DEC-F)
│   │   ├── engine/allocate.ts          # Motor determinístico linear multi-critério
│   │   ├── rules/                      # Elegibilidade, matriz clínica e Zonas Radiais
│   │   ├── export/                     # Formatador oficial do WhatsApp e relatório logístico
│   │   └── types/index.ts              # Modelos tipados e invariantes do domínio
│   ├── application/
│   │   └── store.ts                    # Estado reativo da aplicação (Zustand) e histórico de Undo
│   ├── infrastructure/
│   │   ├── local/                      # Banco Local-First (LocalStorage/IndexedDB) e Seeds
│   │   └── supabase/                   # Conector REST e verificação de saúde do schema
│   └── ui/
│       ├── App.tsx                     # Shell principal e cabeçalho institucional
│       └── components/                 # Grade interativa, Planta Radial, modais e auditoria
├── supabase/
│   ├── full_setup.sql                  # Script SQL consolidado para criação do banco
│   ├── seed.sql                        # Seeds oficiais (29 máquinas, 33 salas, 22 cursos)
│   └── migrations/0001_schema.sql      # Schema PostgreSQL normalizado
└── tests/                              # Testes automatizados (Vitest)
    ├── engine.test.ts                  # Testes do algoritmo de alocação
    ├── golden.test.ts                  # Teste golden do cenário real de conflito triplo
    ├── property-perturbation.test.ts   # Testes de invariantes matemáticas e perturbação
    └── operator-workflow.test.ts       # Testes ponta a ponta do fluxo do operador
```

### Decisão Arquitetural Fundamental (`DEC-F`)
A pasta `src/domain/` é protegida por uma regra customizada de linter no ESLint (`no-restricted-imports`). Ela **nunca** importa React, Zustand, bibliotecas de UI ou clientes de rede, garantindo que as regras clínicas sejam testáveis, portáveis e 100% determinísticas.

---

## Comandos de Testes e Qualidade

O projeto possui rigoroso controle de qualidade automatizado com **38 testes unitários e de integração** em 7 suítes do Vitest:

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia o servidor Vite local com Hot Module Replacement (HMR) |
| `npm test` | Executa toda a suíte de testes do Vitest (invariantes, schemas, motor e workflow) |
| `npm run test:watch` | Executa os testes em modo interativo de monitoramento |
| `npm run lint` | Valida as regras do ESLint (incluindo a regra de pureza do domínio `DEC-F`) |
| `npm run typecheck` | Executa o compilador TypeScript em modo estrito (`tsc -b --noEmit`) |
| `npm run build` | Compila os assets e gera o bundle estático de produção em `dist/` |
| `npm run preview` | Executa um servidor local para pré-visualizar o build de produção |

---

## Segurança e Respeito a Segredos

1. **Credenciais Protegidas:** Nenhuma chave privada ou segredo institucional é mantido em controle de versão. O arquivo `.env` e `.env.*` são ignorados no Git.
2. **Permissões Granulares (RLS):** Todas as tabelas do Supabase possuem Row Level Security ativo, permitindo acesso seguro às operações da clínica.
3. **Resiliência Offline:** Se a conexão cair ou o banco remoto estiver indisponível, o sistema continuará funcionando perfeitamente em modo Local-First.

---

## Documentação Técnica Completa

Para aprofundar-se nas regras de negócio e especificações técnicas do projeto:

* [Análise de Requisitos e Regras Clínicas v4.0](docs/analise-requisitos-escala-nexus.md)
* [Design Técnico e Decisões de Arquitetura (DEC-A a DEC-G)](docs/design-escala-nexus.md)
* [Plano de Implementação e Matriz de Sprints](docs/plano-implementacao-escala-nexus.md)
* [Manual Operacional Completo do Operador](docs/manual-operador-escala-nexus.md)
* [Histórico de Mudanças e Versionamento Semântico](CHANGELOG.md)

---

**Escala Nexus** • Desenvolvido com excelência técnica para a **Academia Nexus**.
Brasília – DF • São Paulo – SP • [nexusultrassonografia.com.br](https://nexusultrassonografia.com.br/)
