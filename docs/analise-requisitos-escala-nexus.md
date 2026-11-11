# Documento de Análise de Requisitos, Identidade Visual e Arquitetura Técnica

**Projeto:** Escala Nexus — Sistema Inteligente de Alocação de Ultrassom

**Instituição:** Nexus: Excelência em Treinamento em Ultrassonografia (*Academia Nexus*)

**Razão Social:** Nexus Núcleo de Excelência em Ultrassonografia Ensino Médico Ltda (CNPJ: 28.193.890/0001-14)

**Unidades:** Brasília – DF (Sede Operacional) e São Paulo – SP

**Site Oficial:** <https://nexusultrassonografia.com.br/>

**Setor Usuário:** Equipe de Operações e Logística Clínica (3 operadores)

**Metodologia de Arquitetura:** `/brainstorming` (*Brainstorming Ideas Into Designs* — `sickn33/agentic-awesome-skills`)

**Versão do Documento:** 4.0 (Consolidada para Execução — Regras de Negócio, Logística de Laudos, Design System e Esquema de Dados)

# PARTE I — ESPECIFICAÇÃO DE NEGÓCIO E OPERAÇÃO CLÍNICA

## 1. Visão Geral e Objetivos do Sistema

### 1.1. Contexto Institucional (Extraído do Site Oficial)

A **Nexus** é uma escola clínica de ultrassonografia dedicada à formação médica especializada, unindo sólida base acadêmica e prática clínica intensiva (*hands-on*) em pacientes reais com tecnologia de última geração (parque composto por equipamentos GE, Samsung, Mindray, Canon, SonoScape e Vinno). Os cursos de Pós-Graduação e Cursos Modulares têm alta rotatividade semanal, podendo iniciar em qualquer dia da semana, com forte concentração entre sexta-feira, sábado e domingo, em diferentes turnos (`Manhã`, `Tarde` e `Dia Todo`).

### 1.2. Problema Atual

As máquinas de ultrassom não são fixas nos consultórios e a quantidade de salas por curso varia conforme o número de alunos matriculados (divididos em duplas, $2$ alunos por consultório). A elaboração manual das escalas enfrenta gargalos quando múltiplos cursos da mesma especialidade (ex: `ECOF`, `MEFE` e `GIOB`) ocorrem simultaneamente. Isso gera:

1. Disputas por máquinas de alta performance entre turmas do mesmo turno;

2. Alocação de aparelhos de Medicina Interna em turmas de Saúde da Mulher (gerando reclamações sobre aparelhos);

3. Ambiguidade na identificação de máquinas repetidas (ex: $4$ unidades do modelo `V6` e $2$ unidades de `V5` e `N8`) e risco de duplicidade acidental (como alocar o único `V7` ou `V4` em dois cursos ao mesmo tempo);

4. Esforço físico de movimentação de equipamentos entre o 1º e o 2º andar na transição de turnos;

5. Necessidade de agrupar turmas em consultórios próximos aos **computadores de laudo** conforme a logística do fim de semana.

### 1.3. Objetivo do Sistema

Automatizar o processo de distribuição das máquinas de ultrassom nos consultórios de acordo com os cursos da semana, respeitando a hierarquia de prioridades clínicas da Nexus, otimizando a proximidade aos computadores de laudo, minimizando o transporte físico de aparelhos entre andares, permitindo que o operador assuma o controle manual sempre que necessário e garantindo excelência prática para os alunos médicos.

## 2. Infraestrutura Física, Logística de Corredores e Capacidade Operacional

### 2.1. Mapeamento de Consultórios

A unidade conta com **33 consultórios clínicos** distribuídos em dois pavimentos:

| Pavimento | Quantidade de Salas | Numeração Atual | Código Padronizado no Sistema | Perfil de Uso | 
| ----- | ----- | ----- | ----- | ----- | 
| **1º Andar** | 23 consultórios | Salas 1 a 23 | `1A-01` a `1A-23` | **Andar Preferencial.** Priorizado para todas as turmas até o limite de $23$ salas simultâneas. | 
| **2º Andar** | 10 consultórios | Salas 1 a 10 | `2A-01` a `2A-10` | **Andar de Expansão / Contingência.** Acionado quando a demanda do turno ultrapassa $23$ salas ou em isolamento de turmas específicas. | 

> **Nota sobre Numeração:** Como as salas de `1` a `10` existem tanto no 1º quanto no 2º andar, o sistema identifica visualmente o andar no painel e insere a tag `*2° ANDAR*` automaticamente no cabeçalho do curso ao exportar para o WhatsApp.

### 2.2. Logística de Corredores e Proximidade aos Computadores de Laudo

* **Padrão Geral (Uso Sequencial Completo):** Na maioria dos finais de semana, todos os consultórios estão disponíveis para alocação contínua ($1$ a $23$ no 1º andar; $1$ a $10$ no 2º andar).

* **Exceção Logística (Distância dos Computadores de Laudo):** Alguns corredores ficam mais distantes das estações/computadores de laudo. Em finais de semana específicos (como registrado no arquivo operacional onde o `MEFE` ocupou as salas `6, 7, 8, 11, 12, 13`, pulando as salas `1 a 5` e `9 a 10`, e o `ECOF` ocupou `17 a 23`), a equipe opta por pular determinados consultórios para concentrar os alunos perto dos computadores de laudo.

* **Suporte no Sistema:** O sistema opera por padrão com todas as salas ativas, mas oferece um seletor rápido por turno/fim de semana (**"Pular salas distantes do laudo / Selecionar salas ativas"**) onde o operador pode desmarcar consultórios específicos (ex: desativar salas `9` e `10`) antes de rodar a distribuição automática.

* **Preparação para Planta Baixa (Mapa Topológico):** A estrutura de dados de cada consultório (`RoomTopology`) já contempla coordenadas de corredor/setor e distância até a ilha de laudos, permitindo acoplar a **Planta Baixa visual dos consultórios** assim que for anexada ao projeto.

### 2.3. Cálculo Dinâmico de Salas por Curso

* Os consultórios não possuem quantidade fixa por curso.

* Os alunos são divididos em **duplas** na prática clínica (padrão de $2$ alunos por consultório).

* A fórmula padrão de cálculo de salas para cada turma em um turno é:

$$
\text{Salas Necessárias} = \left\lceil \frac{\text{Quantidade de Alunos}}{2} \right\rceil
$$

* O operador pode ajustar manualmente a proporção (ex: $3$ alunos por sala em turmas específicas), adicionar $+1$ máquina extra caso o professor solicite equipamento em auditório/sala teórica, ou digitar diretamente o número final de consultórios exigidos.

### 2.4. Limite Físico de Alocação (Trava de Parque)

* Embora existam $33$ consultórios físicos, a capacidade máxima de salas ativas simultaneamente em um único turno é estritamente limitada à quantidade de **máquinas ativas no inventário** (atualmente $29$ aparelhos, editável pelos operadores).\
  \
   Lógica Logística e Zonas Radiais (Planta Baixa)

  Para garantir o conforto de alunos e professores, o preenchimento dos consultórios abandonará a ordem numérica sequencial (1, 2, 3...). O algoritmo utilizará um sistema de "Zonas Radiais", preenchendo primeiro as salas mais próximas aos computadores de laudo.

  * **Zona 1 (Núcleo de Alta Proximidade - 1º Andar):** Consultórios 5, 6, 7, 8, 11, 12, 13, 14, 15, 16, 17 e 18. Estas salas envelopam as ilhas de "PCs Laudos" e a Área de Convivência. São a primeira opção absoluta da automação.

  * **Zona 2 (Periferia - 1º Andar):** Consultórios 1, 2, 3, 4, 9, 10, 19, 20, 21, 22 e 23. Localizados nas ramificações e extremidades dos corredores distantes dos laudos. O sistema só os alocará se a Zona 1 lotar.

  * **Zona 3 (Apoio - 2º Andar):** Consultórios 1 ao 10. Dispostos de forma linear. Utilizados apenas como contingência quando há pico simultâneo de cursos (ex: ECOF, MEFE e GIOB no mesmo turno).

## 3. Inventário do Parque Tecnológico (Base Padrão: 29 Aparelhos)

O sistema inicia com a base oficial de $29$ aparelhos abaixo e permite que qualquer um dos $3$ usuários do setor **adicione novos aparelhos, cadastre máquinas temporárias (empréstimo/demo), remova equipamentos ou altere o status para "Em Manutenção"** a qualquer momento.

### 3.1. Tabela Geral de Equipamentos e Vocação Clínica

| Família / Linha | Fabricante | Modelo | Qtd | Códigos Únicos no Sistema | Vocação Clínica Principal | Nível / Categoria | Mobilidade Física | 
| ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | 
| **Linha Voluson** | GE | Voluson Signature | 1 | `SIGNATURE` | Saúde da Mulher (Fetal / Gineco) | Premium (Tier 1) | Pesado (Evitar escada) | 
| **Linha Voluson** | GE | Voluson S10 Expert | 1 | `S10 EXPERT` | Saúde da Mulher (Fetal / Gineco) | Premium (Tier 1) | Pesado (Evitar escada) | 
| **Linha Voluson** | GE | Voluson Performance | 1 | `PERFORMANCE` | Saúde da Mulher (Fetal / Gineco) | Premium (Tier 1) | Pesado (Evitar escada) | 
| **Linha Voluson** | GE | Voluson S10 | 1 | `S10` | Saúde da Mulher (Fetal / Gineco) | Alto (Tier 1) | Pesado (Evitar escada) | 
| **Linha Voluson** | GE | Voluson E8 | 1 | `E8` | Saúde da Mulher (Gineco / Obstetrícia) | Intermediário (Tier 2) | Móvel Padrão | 
| **Linha Voluson** | GE | Voluson Swift | 1 | `SWIFT` | Saúde da Mulher (Gineco / Obstetrícia) | Intermediário (Tier 2) | Móvel Leve | 
| **Linha Voluson** | GE | Voluson P8 | 1 | `P8` | Saúde da Mulher (Base) | Base (Tier 3) | Móvel Leve | 
| **Linha Resona** | Mindray | Resona I9 | 1 | `RESONA I9` | Exame Geral Alta Definição / Mulher / Elastografia | Premium (Tier 1) | Pesado (Evitar escada) | 
| **Linha V / RS** | Samsung | V8 | 1 | `V8` | Exame Geral Premium / Saúde da Mulher | Premium (Tier 1) | Pesado (Evitar escada) | 
| **Linha V / RS** | Samsung | V7 | 1 | `V7` | Exame Geral Alto / Saúde da Mulher | Alto (Tier 1) | Móvel Padrão | 
| **Linha V / RS** | Samsung | RS80 | 1 | `RS80` | Exame Geral Alta Definição / Mulher | Alto (Tier 2) | Pesado | 
| **Linha V / RS** | Samsung | V6 | 4 | `V6-01` a `V6-04` | Exame Geral (Curinga Mulher, Pediatria e Interna) | Intermediário (Tier 2) | Móvel Padrão | 
| **Linha V / RS** | Samsung | V5 | 2 | `V5-01`, `V5-02` | Exame Geral (Curinga Base) | Base (Tier 3) | Móvel Leve | 
| **Linha V / RS** | Samsung | V4 | 1 | `V4` | Exame Geral (Curinga Base) | Base (Tier 3) | Móvel Leve | 
| **Linha Logiq** | GE | Logiq Totus | 1 | `TOTUS` | Medicina Interna, Doppler, Geral Avançado | Premium (Tier 1) | Pesado | 
| **Linha Logiq** | GE | Logiq Balance | 1 | `BALANCE` | Medicina Interna, Doppler, Geral | Alto (Tier 2) | Móvel Padrão | 
| **Linha Logiq** | GE | Logiq P9 | 1 | `P9` | Medicina Interna, Doppler, Linear | Intermediário (Tier 2) | Móvel Padrão | 
| **Linha Logiq** | GE | Logiq E | 1 | `LOGIQ E` | Portátil: Músculo, Punção, POCUS, Anestesia | Portátil (Específico) | Portátil de Mão | 
| **Linha Consona** | Mindray | Consona N8 | 2 | `N8-01`, `N8-02` | Medicina Interna, Doppler, Pediatria | Intermediário (Tier 2) | Móvel Padrão | 
| **Linha Aplio** | Canon | Canon Aplio | 1 | `CANON` | Medicina Interna, Pequenas Partes, Músculo, Doppler | Alto (Tier 1) | Móvel Padrão | 
| **Linha Elite** | SonoScape | P12 Elite | 1 | `P12 ELITE` | Medicina Interna, Doppler, Geral | Intermediário (Tier 2) | Móvel Padrão | 
| **Linha Vinno** | Vinno | Vinno E35 | 1 | `VINNO E35` | Linear, Músculo, Pequenas Partes, Geral | Intermediário (Tier 2) | Móvel Leve | 
| **Linha Vinno** | Vinno | Vinno E20 | 1 | `VINNO E20` | Linear, Pequenas Partes, Geral | Base (Tier 3) | Móvel Leve | 
| **Portátil** | Samsung | HM70 | 1 | `HM70` | Portátil: POCUS, Acesso Vascular, Contingência | Portátil (Contingência) | Portátil de Mão | 

### 3.2. Atributos Operacionais Editáveis por Máquina

No módulo de gerenciamento de inventário, cada aparelho possui marcadores editáveis pelos operadores:

1. **Status de Operação:** `Ativo`, `Em Manutenção` (indisponível temporariamente) ou `Empréstimo / Demo` (equipamento extra enviado por fabricante parceiro para um curso específico).

2. **Transdutores (Sondas) e Recursos Ativos:** Tags opcionais (`Convexo`, `Linear`, `Endovaginal`, `Volumétrico 3D/4D`, `Setorial Adulto/Neonatal`, `Elastografia`) para auxiliar o operador nos cursos que exigem controle manual.

3. **Peso Logístico de Transporte:** Usado pelo motor de transição para preferir manter máquinas pesadas no 1º andar e movimentar apenas o mínimo necessário entre pavimentos.

## 4. Catálogo de Cursos Raspados do Site e Matriz de Prioridade Clínica

O sistema utiliza a base de cursos extraída de `https://nexusultrassonografia.com.br/` e das escalas operacionais da escola, dividida em grupos de prioridade e regras de decisão:

### 4.1. Cursos de Pós-Graduação

| Sigla / Nome do Curso | Carga Horária | Área Clínica | Nível de Prioridade | 1ª Opção de Máquinas (Ideal) | 2ª Opção (Complemento) | Modo de Operação | 
| ----- | ----- | ----- | ----- | ----- | ----- | ----- | 
| **PG US ECOF** (Ecocardiografia Fetal) | 360h | Saúde da Mulher / Fetal | **Prioridade 1 (Máxima)** | Voluson (`Signature`, `Performance`, `S10 Expert`), `Resona I9`, `V8` | `V6`, `V5` | Automático | 
| **PG US MEFE** (Medicina Fetal Internacional) | 800h | Saúde da Mulher / Fetal | **Prioridade 1 (Máxima)** | Voluson (`S10`, `Signature`, `Performance`), `V7`, `V8` | Linha Samsung V (`V6`, `V5`, `V4`) | Automático | 
| **PG Neurossonografia Fetal** | 360h | Saúde da Mulher / Fetal | **Prioridade 1 (Máxima)** | Voluson Premium, `Resona I9`, `V8` | `V7`, `RS80`, `V6` | Automático | 
| **PG Imagem na Saúde da Mulher** | 380h | Mulher / Mama / Pelve | **Prioridade 2 (Alta)** | Linha Voluson, `Resona I9`, `RS80`, `V8`, `V7` | Linha Samsung V (`V6`, `V5`) | Automático | 
| **PG Ginecologia Endócrina e Reprodução** | 360h | Ginecologia / Reprodução | **Prioridade 2 (Alta)** | Linha Voluson, Linha Samsung V (`V8` a `V6`), `RS80` | `V5`, `V4` | Automático | 
| **PG US GIOB** (Ginecologia e Obstetrícia) | 360h | Saúde da Mulher Base | **Prioridade 3 (Base Mulher)** | Voluson disponíveis (`E8`, `Swift`, `P8`), Linha V, `RS80` | Em pico triplo: `P12 Elite`, `P9`, `Canon`, `N8`, `HM70` | Automático com Upgrade | 
| **PG Ecografia Vascular** | 440h | Doppler Vascular | **Prioridade 1 (Interna)** | GE Logiq (`Totus`, `Balance`, `P9`), Consona (`N8`), `Canon` | `P12 Elite`, `Vinno E35`, Linha V | Automático | 
| **PG US Pediátrica e Neonatal** | 360h | Pediatria | **Prioridade 2 (Interna)** | Linha Samsung V, GE Logiq (`Totus`, `Balance`, `P9`), `Consona N8` | `Canon`, `P12 Elite`, `Vinno E35/E20` | Automático | 
| **PG Intervenções Ambulatoriais em Dor** | 360h | Músculo / Intervenção | **Especial (Linear)** | `Canon`, GE Logiq (`Totus`, `P9`, `Logiq E`), `Vinno E35` | `HM70`, `Consona N8`, Linha V | **Alerta Manual** | 

### 4.2. Cursos Modulares e Intensivos

| Nome do Curso Modular | Carga Horária | Área Clínica | Nível de Prioridade | Linhas Recomendadas | Modo de Operação | 
| ----- | ----- | ----- | ----- | ----- | ----- | 
| **Avançado em Endometriose** | 30h | Ginecologia Avançada | **Prioridade 1 (Mulher)** | Voluson (`Signature`, `S10 Expert`, `Performance`, `S10`), `Resona I9`, `RS80`, `V8`, `V7` | Automático | 
| **Doppler Avançado em Patologias Obstétricas** | 30h | Obstetrícia Avançada | **Prioridade 1 (Mulher)** | Linha Voluson, `Resona I9`, Linha Samsung V (`V8`, `V7`, `V6`) | Automático | 
| **Histerossonografia e HyCoSy com Mentoria** | 23h | Ginecologia Especial | **Prioridade 2 (Mulher)** | Linha Voluson, Linha Samsung V, `RS80` | Automático | 
| **Ultrassonografia em Uroginecologia Básico** | 25h | Ginecologia Pélvica | **Prioridade 2 (Mulher)** | Linha Voluson, Linha Samsung V, `RS80` | Automático | 
| **Básico em Ginecologia e Obstetrícia** | 60h | Saúde da Mulher Base | **Prioridade 3 (Mulher)** | Voluson Base (`E8`, `Swift`, `P8`), Linha Samsung V | Automático | 
| **Músculo (Musculoesquelético)** | Modular | Linear Alta Frequência | **Prioridade 1 (Linear)** | `Canon`, GE Logiq (`Totus`, `Balance`, `P9`, `Logiq E`), `Consona N8`, `Vinno E35` | Automático | 
| **Artérias Carótidas, Vertebrais e Fístulas** | 30h | Doppler Vascular | **Prioridade 1 (Interna)** | GE Logiq (`Totus`, `Balance`, `P9`), `Consona N8`, `Canon`, `P12 Elite` | Automático | 
| **Tireoide com Doppler, Cervical e Salivares** | 25h | Pequenas Partes / Linear | **Prioridade 2 (Linear)** | `Canon`, GE Logiq, `Consona N8`, `Vinno E35/E20`, Linha V | Automático | 
| **Parede Abdominal, Inguinal e Bolsa Testicular** | 30h | Interna e Linear | **Prioridade 2 (Interna)** | GE Logiq, `Consona N8`, `Canon`, Linha Samsung V | Automático | 
| **Avaliação Multiparamétrica do Fígado** | 25h | Abdome / Elastografia | **Especial (Software)** | Exige validação de quais máquinas possuem Elastografia ativa (`Resona I9`, `Totus`, `Canon`, etc.) | **Controle Manual** | 
| **Hemodinâmica Neonatal Guiada por US Cardíaco** | 25h | Ecocardiografia Neonatal | **Especial (Sonda)** | Exige validação de máquinas com transdutor setorial neonatal | **Controle Manual** | 
| **Punção Vascular Ecoguiada** | 10h | Acesso Guiado | **Especial (Portátil/Linear)** | Operador escolhe entre Portáteis (`Logiq E`, `HM70`) ou Fixos Lineares (`Vinno`, `Logiq`) | **Controle Manual** | 
| **Point-of-Care: Urgências / POCUS em GO** | 18h / 30h | Emergência / Plantão | **Especial (Portátil/Geral)** | Operador define proporção entre Portáteis (`HM70`, `Logiq E`) e Linha V / Voluson Base | **Controle Manual** | 

## 5. Regras de Negócio (RN) do Motor de Alocação

### RN01 — Grade de Dias e Turnos Flexíveis

* O sistema permite criar escalas para qualquer dia da semana (**Segunda a Domingo**), exibindo por padrão **Sexta, Sábado e Domingo**.

* Cada dia é dividido em dois turnos operacionais: **Manhã** e **Tarde**.

* Ao lançar um curso em um dia, o usuário pode selecionar: `Só Manhã`, `Só Tarde` ou `Dia Todo` (que ocupa Manhã + Tarde).

* Um mesmo curso pode ter regimes diferentes em dias diferentes (ex: `PG US ECOF` na Sexta Manhã e no Sábado Manhã; `PG US GIOB` no Sábado Dia Todo e Domingo Manhã).

### RN02 — Fila de Prioridade na Saúde da Mulher

* Cursos `ECOF`, `MEFE`, `Neurossonografia Fetal` e `Endometriose` têm prioridade absoluta sobre os equipamentos da linha **GE Voluson**, **Mindray Resona I9** e **Samsung V8 / V7**.

* O curso `GIOB` só recebe aparelhos Voluson de topo (`Signature`, `Performance`, `S10 Expert`) se não houver conflito no mesmo turno com `ECOF` ou `MEFE`, ou se sobrarem unidades após atender integralmente as turmas prioritárias.

### RN03 — Resolução de Conflito Triplo (Caso `ECOF` + `MEFE` + `GIOB`)

* Quando ocorrerem três cursos de Saúde da Mulher no mesmo turno (ex: Sábado Manhã) e a soma de salas ultrapassar a capacidade do 1º andar ($23$ salas) ou o estoque de aparelhos vocacionados para Mulher:

  1. `ECOF` e `MEFE` são alocados no **1º Andar** com $100\%$ de máquinas vocacionadas (Voluson, Resona I9 e Linha V).

  2. `GIOB` é alocado no **2º Andar** (Salas 1 a 10) recebendo o saldo de aparelhos Voluson Base (`P8`, `Swift`, `E8`), `RS80`, `V6` e completando as salas restantes com linhas de Medicina Interna/Geral (`P9`, `Canon`, `N8`, `P12 Elite`, `HM70`).

### RN04 — Herança de Salas e Upgrade de Turno (Transição de Almoço)

* Quando um curso prioritário encerra sua participação no meio do fim de semana (ex: `ECOF` termina no Sábado ao meio-dia após usar as salas `17` a `23` do 1º andar) e o `GIOB` continua à tarde:

  1. O sistema **move a turma do `GIOB` do 2º andar para o 1º andar** no turno de Sábado Tarde.

  2. O `GIOB` **herda as salas `17` a `23`** já montadas com os aparelhos de ponta deixados pelo `ECOF` (`Signature`, `V8`, `Resona I9`, `Performance`, `V6`, `S10 Expert`, `V5`), sem necessidade de movimentar essas $7$ máquinas.

  3. Para completar as salas restantes do `GIOB` no 1º andar (ex: salas `14`, `15` e `16`), o sistema seleciona apenas os **melhores aparelhos que estavam no 2º andar** (ex: `V6`, `RS80` e `P12 Elite`) para descerem ao 1º andar, descartando o uso de máquinas menos compatíveis (`HM70`, `P9`, `N8`).

### RN05 — Upgrade Progressivo no Domingo

* Caso aparelhos da **Linha V** (`V7`, `V6`, `V4`) fiquem livres em outros turnos (ex: no Domingo), o sistema substitui automaticamente máquinas de Medicina Interna ou menor compatibilidade que ainda estejam no `GIOB` (como `P12 Elite` ou `RS80`, se aplicável) por aparelhos da **Linha V** disponíveis no 1º andar.

### RN06 — Estabilidade de Sala para Cursos "Dia Todo" e Multi-Dias

* Um curso que permanece ativo em turnos consecutivos (ex: `MEFE` no Sábado Manhã, Sábado Tarde e Domingo nas salas `6`, `7`, `8`, `11`, `12` e `13`) mantém **exatamente as mesmas salas e os mesmos aparelhos** do início ao fim, salvo intervenção manual do operador.

### RN07 — Reciclagem de Consultórios entre Cursos Distintos (Manhã $\rightarrow$ Tarde)

* Se o Curso A ocorre `Só Manhã` no 1º andar e o Curso B ocorre `Só Tarde`, o Curso B reutiliza os consultórios liberados pelo Curso A no 1º andar antes de abrir salas no 2º andar.

* Se o aparelho já presente na sala for compatível com o Curso B (ex: `Linha V` usado em `GIOB` de manhã e compatível com `Pediatria` à tarde), o aparelho permanece na sala para poupar transporte.

### RN08 — Assunção de Controle Manual pelo Usuário (Human-in-the-Loop)

* Sempre que o usuário selecionar um curso classificado como **Controle Manual** ou cadastrar um curso novo sem regra definida, o sistema exibe um painel onde o usuário:

  1. Escolhe quais famílias de máquinas ou quais aparelhos específicos do estoque irão para aquele curso; **ou**

  2. Fixa ("trava") manualmente determinados aparelhos em salas específicas antes de rodar a distribuição automática para os demais cursos do turno.

### RN09 — Alocação Sequencial Padrão e Salto Opcional por Proximidade aos Computadores de Laudo

* **Modo Padrão:** Todos os $23$ consultórios do 1º andar (`1` a `23`) e os $10$ do 2º andar (`1` a `10`) ficam habilitados para uso sequencial.

* **Modo Otimização de Laudo (Salto de Corredor):** Quando o operador precisar concentrar uma turma próxima aos computadores de laudo (evitando corredores distantes), ele pode desmarcar salas específicas (ex: pular salas `1 a 5` e `9 a 10` no 1º andar, alocando o curso diretamente nas salas `6, 7, 8, 11, 12, 13`) ou definir o bloco exato de salas da turma.

### RN10 — Trava Rígida Anti-Duplicidade de Patrimônio por Turno

* No processo manual anterior, ocorriam colisões acidentais de estoque (como no arquivo anexo de Domingo, onde os aparelhos únicos `V7` e `V4` foram escalados simultaneamente no `PG US MEFE` nas salas `6` e `11` e no `PG US GIOB` nas salas `14` e `16`).

* O sistema aplica validação de unicidade estrita por turno: cada unidade física (`id` único, como `v7-01`, `v4-01`, `v6-01` a `v6-04`) só pode ocupar **um único consultório por turno**. Caso o operador tente forçar manualmente um aparelho já em uso, o sistema pergunta se ele deseja **permutar (trocar)** os aparelhos entre as duas salas.

### RN11 — Nota Operacional de Alteração e Versionamento da Escala

* O sistema disponibiliza um campo de **Justificativa / Nota Operacional de Rodapé** (ex: `*ALTERAÇÃO DESCENDO GIOB PARA O PRIMEIRO ANDAR LOGO NO SÁBADO A TARDE, TENDO O TRABALHO DE DESCER 3 APARELHOS MAS POUPANDO RECLAMAÇÕES SOBRE APARELHOS E FACILITANDO O ANDAMENTO DO CURSO*`) e também gera sugestões automáticas desse texto quando detecta mudanças de andar.

* Toda escala salva possui controle de estado (`Rascunho`, `Oficial Publicada`, `Alterada em Andamento`), preservando o histórico caso a programação mude no meio do fim de semana.

## 6. Requisitos Funcionais (RF) e Não Funcionais (RNF)

### 6.1. Requisitos Funcionais

* **RF01 — Gestão do Inventário de Máquinas:** Listar, adicionar novo aparelho, editar nome/código, alterar linha/família, definir vocação clínica, marcar transdutores disponíveis, ajustar nível de prioridade e alternar status entre `Ativo`, `Em Manutenção` e `Empréstimo Temporário`.

* **RF02 — Gestão do Catálogo de Cursos:** Visualizar os cursos da Nexus, editar suas linhas de máquinas preferenciais e cadastrar novos cursos informando sua prioridade e vocação.

* **RF03 — Planejador de Escala por Dia e Turno:** Montar a programação da semana adicionando os cursos ativos em cada dia (Segunda a Domingo), definindo o turno (`Manhã`, `Tarde`, `Dia Todo`), informando o número de alunos (ou salas) e ativando/desativando consultórios conforme a proximidade aos computadores de laudo.

* **RF04 — Motor de Geração Automática de Escala:** Distribuir os aparelhos disponíveis nos consultórios do 1º e 2º andar respeitando todas as Regras de Negócio (`RN01` a `RN11`), evitando duplicidade de máquinas no mesmo turno.

* **RF05 — Painel de Ajuste Manual e Troca Rápida:** Permitir ao operador trocar qualquer aparelho de sala ou mudar o bloco de consultórios de um curso com atualização imediata de disponibilidade.

* **RF06 — Gerador de Relatório de Logística (Transição entre Turnos):** Comparar automaticamente o Turno A com o Turno B e listar para a equipe de operações quais aparelhos permanecem nas salas e quais precisam ser transportados.

* **RF07 — Exportação no Padrão Oficial de WhatsApp da Nexus:** Gerar o texto final exatamente no formato operacional utilizado pela escola (incluindo a nota de rodapé de alterações) com botão de cópia em 1 clique.

* **RF08 — Histórico e Clonagem de Escalas:** Permitir salvar versões da escala (`Original` vs. `Alterado`) e duplicar a estrutura de um fim de semana anterior como ponto de partida.

### 6.2. Requisitos Não Funcionais

* **RNF01 — Usabilidade Focada na Equipe de 3 Operadores:** Interface direta, permitindo gerar ou alterar a escala completa de um fim de semana em menos de $3$ minutos.

* **RNF02 — Prevenção de Conflitos (Idempotência por Turno):** Impedir matematicamente que a mesma unidade física de equipamento seja alocada em duas salas diferentes no mesmo dia e turno.

* **RNF03 — Persistência Offline-First e Sincronização Realtime:** Salvar automaticamente alterações no navegador e sincronizar com o banco em nuvem entre os $3$ operadores.

* **RNF04 — Responsividade e Identidade Visual Nexus:** Interface adaptada para desktop e smartphone utilizando rigorosamente a paleta oficial **Verde, Branco e Preto** da Nexus.

# PARTE II — IDENTIDADE VISUAL E DESIGN SYSTEM NEXUS (EXTRAÍDO DO SITE OFICIAL)

## 7. Diretrizes de Marca e Paleta de Cores (Verde, Branco e Preto)

A identidade visual do sistema **Escala Nexus** reflete a estética institucional de `https://nexusultrassonografia.com.br/` (*Academia Nexus*): visual médico-tecnológico de alto padrão, combinando **Preto Profundo** (autoridade acadêmica e precisão em imagem diagnóstica), **Verde Nexus** (inovação médica, aprovação clínica e destaque de ação) e **Branco Puro** (limpeza clínica e legibilidade operacional).

### 7.1. Tabela Oficial de Tokens de Cores (Verde, Branco e Preto)

| Token Semântico | Nome da Cor | Hexadecimal | Equivalente Tailwind CSS | Aplicação na Interface do Escala Nexus | 
| ----- | ----- | ----- | ----- | ----- | 
| `--nexus-green-primary` | **Verde Nexus Principal** | `#00A859` / `#10B981` | `emerald-500` / `green-600` | Botões primários ("Gerar Escala", "Copiar WhatsApp"), indicadores de curso ativo, borda lateral de consultórios com *Match Ideal* (1ª opção atendida) e ícones de destaque. | 
| `--nexus-green-dark` | **Verde Nexus Profundo** | `#047857` / `#064E3B` | `emerald-700` / `emerald-950` | Estado `:hover` de botões primários, badges de "Prioridade 1 (Máxima)", cabeçalhos de blocos de Saúde da Mulher e fundos de realce escuro. | 
| `--nexus-green-light` | **Verde Clínico Suave** | `#ECFDF5` / `#D1FAE5` | `emerald-50` / `emerald-100` | Fundo suave de cards de salas com alocação $100\%$ compatível, pílulas de status "Ativo" no inventário de máquinas e banners de transição otimizada. | 
| `--nexus-black-pure` | **Preto Institucional** | `#09090B` / `#111111` | `zinc-950` / `neutral-950` | Cabeçalho superior da aplicação (Header Academia Nexus), barra de navegação ativa, painel lateral de preview do WhatsApp e botões secundários de alto contraste. | 
| `--nexus-black-surface` | **Grafite Carbono** | `#18181B` / `#27272A` | `zinc-900` / `zinc-800` | Cards de métricas do topo (ex: `29 Máquinas Ativas`, `23 Salas 1º Andar`), cabeçalhos de tabelas e textos principais sobre fundo branco. | 
| `--nexus-white-pure` | **Branco Clínico Puro** | `#FFFFFF` | `white` | Superfície principal dos cards de consultórios (`RoomSlotCard`), modais de edição, tabelas de cursos/máquinas e textos sobre fundo preto ou verde. | 
| `--nexus-white-off` | **Branco Gelo Operacional** | `#F4F4F5` / `#F8FAFC` | `zinc-100` / `slate-50` | Plano de fundo geral da aplicação (`body`), criando contraste limpo para destacar os cards brancos dos $33$ consultórios. | 
| `--nexus-border-subtle` | **Cinza Neutro de Borda** | `#E4E4E7` | `zinc-200` | Divisórias de tabelas, bordas padrão de consultórios vazios ou desativados por distância do computador de laudo. | 

### 7.2. Cores de Apoio Operacional (Alertas de Regra de Negócio)

* **Status Ideal / Máquina Vocacionada:** Borda e badge em **Verde Nexus (`#10B981`)** sobre fundo branco (`#FFFFFF`) ou verde suave (`#ECFDF5`).

* **Status Herança de Sala Fixa (Sem Transporte):** Badge em **Preto + Verde (`#18181B` com texto `#34D399`)** indicando `Mantido do turno anterior`.

* **Status Sala Pulada (Distante do Computador de Laudo):** Card em cinza tracejado discreto (`#F4F4F5` com texto `#71717A`) indicando `Sala pulada (Logística de Laudo)`.

* **Status Controle Manual / Contingência 2º Andar:** Destaque em **Âmbar Técnico (`#F59E0B` / `amber-500`)** exclusivo para avisar quando o curso exige escolha manual do usuário ou quando um aparelho de Medicina Interna está alocado temporariamente no `GIOB`.

* **Status Em Manutenção / Falta de Aparelho:** Destaque em **Vermelho Alerta (`#EF4444` / `red-500`)** para equipamentos desativados no inventário ou excesso de demanda acima de $29$ salas.

# PARTE III — ARQUITETURA E ESPECIFICAÇÃO TÉCNICA (`/brainstorming` Skill)

## 8. Understanding Summary & Bloqueio de Escopo (Understanding Lock)

* **O que está sendo construído (*What is being built*):** Uma aplicação web reativa (**Escala Nexus**), estilizada com a identidade oficial **Verde, Branca e Preta** da Nexus, contendo um motor determinístico de alocação heurística capaz de cruzar a demanda de consultórios ($\lceil \text{alunos} / 2 \rceil$) com a fila de prioridade clínica das $29$ máquinas de ultrassom e a topologia de $33$ salas ($23$ no 1º andar e $10$ no 2º andar, com suporte a salto opcional de salas distantes dos computadores de laudo) ao longo de múltiplos turnos.

* **Por que existe (*Why it exists*):** Para eliminar reclamações de professores e alunos sobre máquinas incompatíveis com o exame do curso, extinguir erros de duplicidade de aparelhos (como escalar o único `V7` ou `V4` em duas turmas simultâneas) e minimizar o esforço físico da equipe ao transportar equipamentos entre andares no intervalo de almoço.

* **Para quem é (*Who it is for*):** Exclusivamente para o setor de Operações/Logística Clínica da Nexus, composto por **3 operadores**.

* **Restrições-chave (*Key constraints*):** Parque móvel de $29$ máquinas (expansível/editável), limite físico de $23$ salas no 1º andar e $10$ no 2º andar, possibilidade de pular salas distantes dos computadores de laudo quando necessário, obrigatoriedade de intervenção manual (*Human-in-the-Loop*) para cursos dependentes de sondas/softwares específicos e saída de texto $100\%$ fiel ao formato de WhatsApp da empresa.

* **Não-Objetivos Explícitos (*Explicit Non-Goals — YAGNI*):**

  1. **Não terá portal de alunos ou professores:** Alunos e professores não fazem login no sistema; a saída continuará sendo publicada nos grupos operacionais de WhatsApp.

  2. **Não terá integração com ERP financeiro/matrículas nesta versão:** O operador digita diretamente a quantidade de alunos ou salas do curso da semana em segundos.

  3. **Não utilizará API paga da Meta (WhatsApp Business Cloud API):** A exportação será via área de transferência (*Copy-to-Clipboard* formatado com 1 clique) e download `.txt`, mantendo custo zero.

  4. **Não gerenciará laudos médicos, agenda de pacientes modelos ou arquivos DICOM:** O escopo é estritamente a logística de consultórios e máquinas de ultrassom.

## 9. Premissas Explícitas de Engenharia (Scale, Security & Maintenance Assumptions)

| Dimensão | Premissa Assumida para o Projeto | Impacto na Arquitetura | 
| ----- | ----- | ----- | 
| **Performance** | O cálculo completo da escala de todos os turnos da semana deve executar em $< 50\text{ ms}$. | O algoritmo de alocação roda inteiramente em memória no cliente (TypeScript puro), proporcionando feedback instantâneo a cada clique. | 
| **Escala de Usuários e Dados** | $3$ usuários concorrentes; $\sim 30$ a $50$ aparelhos; $\sim 30$ cursos; $\sim 52$ escalas semanais por ano ($< 5\text{ MB}$ de dados textuais por ano). | Dispensa infraestrutura pesada de microsserviços; um banco BaaS gratuito (Supabase) ou persistência local sincronizada atende com folga de $99\%$. | 
| **Segurança e Privacidade (LGPD)** | O sistema **não armazena dados pessoais ou sensíveis** (sem nomes de pacientes, CPFs ou prontuários). Apenas siglas de cursos, números de salas e modelos de máquinas. | Baixo risco regulatório. Autenticação simples para os $3$ operadores do setor. | 
| **Confiabilidade e Disponibilidade** | A operação crítica ocorre às sextas e sábados (inclusive às 12h no intervalo de almoço). O sistema não pode parar se a internet da clínica oscilar. | Arquitetura **Offline-First / Local-First**: o estado é salvo instantaneamente no `localStorage` do navegador e sincronizado em background com a nuvem, com opção de exportar/importar backup `.json`. | 
| **Evolução para Planta Baixa** | O usuário fornecerá futuramente a planta baixa física dos $33$ consultórios. | O componente `FloorMapContainer.tsx` será desacoplado para suportar duas visões: **Visão em Grade Operacional** (imediata) e **Visão de Planta Baixa Interativa** (coordenadas SVG/Canvas dos consultórios e ilhas de laudo). | 

## 10. Estrutura Técnica Detalhada do Projeto (Tech Stack)

### 10.1. Linguagens, Frameworks e Bibliotecas

* **Linguagens:** TypeScript (`v5.4+`), HTML5 Semântico, CSS3 (Tailwind CSS `v3.4+`), SQL (PostgreSQL `v15+` via Supabase).

* **Core Frontend:** React (`v18.3+`) + Vite (`v5+`).

* **Gerenciamento de Estado:** Zustand (`v4.5+`) com middleware `persist` para armazenamento local automático e sincronização com Supabase Realtime.

* **Componentes Visuais e Ícones:** Radix UI Primitives / Shadcn UI + `lucide-react` + `clsx` + `tailwind-merge`.

### 10.2. Modelagem Completa de Dados em TypeScript (`src/types/nexus.ts`)

```
// 1. Famílias de Aparelhos de Ultrassom
export type MachineFamily =
  | 'VOLUSON'     // GE Saúde da Mulher (Signature, S10 Expert, Performance, S10, E8, Swift, P8)
  | 'SAMSUNG_V'   // Samsung Geral/Mulher (V8, V7, V6, V5, V4, RS80)
  | 'RESONA'      // Mindray Alta Definição (Resona I9)
  | 'LOGIQ'       // GE Medicina Interna/Doppler (Totus, Balance, P9, Logiq E)
  | 'CONSONA'     // Mindray Medicina Interna/Doppler (N8)
  | 'CANON'       // Canon Aplio (Interna/Linear)
  | 'ELITE'       // P12 Elite (Interna/Doppler)
  | 'VINNO'       // Vinno E35, E20 (Linear/Geral)
  | 'PORTATIL';   // HM70, Logiq E (Ponto de Cuidado / Contingência)

export type MobilityWeight = 'HEAVY' | 'MEDIUM' | 'LIGHT' | 'PORTABLE';

export type ProbeType =
  | 'CONVEXO'
  | 'LINEAR'
  | 'ENDOVAGINAL'
  | 'VOLUMETRICO_4D'
  | 'SETORIAL_NEONATAL'
  | 'ELASTOGRAFIA';

// 2. Equipamento no Inventário
export interface Machine {
  id: string;                 // Ex: "v6-01", "v6-02", "voluson-signature"
  code: string;               // Nome exibido na escala WhatsApp: ex: "SIGNATURE", "V6"
  internalLabel: string;      // Identificador interno: ex: "V6 #01", "V6 #02"
  brand: string;              // GE, Samsung, Mindray, Canon, Vinno, SonoScape
  family: MachineFamily;
  tier: 1 | 2 | 3;            // 1 = Premium, 2 = Intermediário, 3 = Base/Contingência
  mobility: MobilityWeight;   // Auxilia no cálculo de descida de andar
  probes?: ProbeType[];       // Sondas e softwares ativos na máquina
  status: 'ACTIVE' | 'MAINTENANCE' | 'LOANED_TEMP'; // Ativo, Manutenção ou Empréstimo
  notes?: string;
}

// 3. Topologia de Consultório (Preparado para a Planta Baixa e Distância do Laudo)
export interface ConsultingRoom {
  id: string;                 // Ex: "1A-06", "2A-01"
  floor: 1 | 2;               // 1º Andar (1..23) ou 2º Andar (1..10)
  roomNumber: number;         // 1..23 ou 1..10
  corridorGroup?: string;     // Ex: "Corredor A - Próximo ao Laudo", "Corredor B - Fundo"
  nearReportingStation: boolean; // true se próximo aos computadores de laudo
  defaultEnabled: boolean;    // Padrão: true (todos os consultórios ativos)
  floorPlanCoords?: {         // Coordenadas reservadas para a futura Planta Baixa
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// 4. Curso do Catálogo Nexus
export interface Course {
  id: string;                 // Ex: "pg-us-ecof"
  shortName: string;          // Nome no WhatsApp: ex: "PG US ECOF"
  fullName: string;           // Ex: "Pós-Graduação em Ecocardiografia Fetal"
  type: 'POS' | 'MODULAR';
  workloadHours?: number;
  priorityLevel: 1 | 2 | 3;   // 1 = Máxima (ECOF, MEFE, Endometriose, Vascular), 2 = Alta, 3 = Base (GIOB)
  preferredFamilies: MachineFamily[];
  preferredMachineIds?: string[];
  requiresManualControl: boolean;
  manualPromptReason?: string;
  defaultFloorPreference: 1 | 2;
  preferredRoomBlock?: number[]; // Ex: [17, 18, 19, 20, 21, 22, 23] para ECOF
}

// 5. Demanda de Curso em um Turno
export interface ShiftCourseDemand {
  id: string;
  courseId: string;
  studentsCount: number;
  roomsRequired: number;      // Calculado: ceil(studentsCount / 2)
  needsAuditoriumMachine?: boolean; // +1 máquina opcional para demonstração teórica
  customRoomNumbers?: number[];     // Permite definir salas específicas (ex: pular 9 e 10)
  pinnedMachineIds?: string[];      // Máquinas travadas manualmente pelo operador
}

// 6. Alocação Final de um Consultório em um Turno
export interface RoomAllocation {
  floor: 1 | 2;
  roomNumber: number;
  courseId: string;
  machineId: string;          // Referência única (impede duplicar V7 ou V4 no mesmo turno)
  matchQuality: 'IDEAL' | 'SECONDARY' | 'CONTINGENCY' | 'MANUAL';
  isPinned: boolean;
  inheritedFromPreviousShift: boolean;
}

// 7. Escala Semanal com Versionamento e Nota de Rodapé
export interface WeeklySchedule {
  id: string;
  title: string;              // Ex: "FDS 23-25"
  status: 'ORIGINAL' | 'ALTERADO';
  updatedBy: string;          // Qual dos 3 operadores salvou por último
  updatedAt: string;
  skippedRoomsFloor1: number[]; // Ex: [1, 2, 3, 4, 5, 9, 10] se optar por pular salas distantes do laudo
  footerObservationNote: string; // Ex: "*ALTERAÇÃO DESCENDO GIOB PARA O PRIMEIRO ANDAR...*"
  shifts: {
    shiftKey: string;         // Ex: "SEXTA_MANHA", "SABADO_MANHA", "SABADO_TARDE", "DOMINGO_MANHA"
    label: string;            // Ex: "SEXTA MANHÃ"
    demands: ShiftCourseDemand[];
    allocations: RoomAllocation[];
  }[];
}

```

### 10.3. Esquema do Banco de Dados PostgreSQL (Supabase Migration SQL)

```
-- 1. Tabela de Inventário de Máquinas de Ultrassom
CREATE TABLE machines (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  internal_label TEXT NOT NULL,
  brand TEXT NOT NULL,
  family TEXT NOT NULL,
  tier SMALLINT NOT NULL DEFAULT 2,
  mobility TEXT NOT NULL DEFAULT 'MEDIUM',
  probes TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de Topologia dos 33 Consultórios (Suporte a Laudo e Planta Baixa)
CREATE TABLE consulting_rooms (
  id TEXT PRIMARY KEY,
  floor SMALLINT NOT NULL CHECK (floor IN (1, 2)),
  room_number SMALLINT NOT NULL,
  corridor_group TEXT,
  near_reporting_station BOOLEAN DEFAULT TRUE,
  default_enabled BOOLEAN DEFAULT TRUE,
  floor_plan_coords JSONB
);

-- 3. Tabela de Catálogo de Cursos da Nexus
CREATE TABLE courses (
  id TEXT PRIMARY KEY,
  short_name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('POS', 'MODULAR')),
  workload_hours INT,
  priority_level SMALLINT NOT NULL DEFAULT 2,
  preferred_families TEXT[] NOT NULL,
  preferred_machine_ids TEXT[] DEFAULT '{}',
  requires_manual_control BOOLEAN DEFAULT FALSE,
  manual_prompt_reason TEXT,
  default_floor_preference SMALLINT DEFAULT 1,
  preferred_room_block INT[] DEFAULT '{}'
);

-- 4. Tabela de Escalas Semanais e Histórico de Versões ("Original" vs "Alterado")
CREATE TABLE weekly_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ORIGINAL',
  skipped_rooms_floor1 INT[] DEFAULT '{}',
  footer_observation_note TEXT DEFAULT '',
  shifts_payload JSONB NOT NULL,
  updated_by TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

```

## 11. Registro Consolidado de Decisões de Arquitetura (Decision Log)

| ID | O que foi decidido | Alternativas Consideradas | Por que esta opção foi escolhida | 
| ----- | ----- | ----- | ----- | 
| **DEC-01** | Construir uma **Aplicação Web SPA (React + TypeScript)** em vez de planilha Excel/Sheets. | 1\. Google Sheets + Apps Script  2\. Excel com VBA | Para uma equipe de $3$ pessoas, a aplicação web impede que fórmulas sejam apagadas acidentalmente, resolve a herança de salas entre turnos (Sábado Manhã $\rightarrow$ Tarde) e funciona no celular pelos corredores. | 
| **DEC-02** | Executar o **Motor de Alocação no Cliente (In-Memory TypeScript)** com estado Local-First (`Zustand` + `Supabase`). | Backend dedicado processando cada clique via API. | Com $29$ máquinas e $33$ salas, o cálculo em memória leva menos de $5\text{ ms}$, funciona offline se a internet oscilar nos andares da clínica e mantém o custo em R\$ 0,00. | 
| **DEC-03** | Adotar modelo **Híbrido (Automático + Human-in-the-Loop)** para cursos com exigência de transdutor/software específico. | Automação $100\%$ rígida sem exceção. | Cursos como *Avaliação do Fígado* (elastografia) ou *Hemodinâmica Neonatal* (sonda setorial neonatal) dependem de validação humana das máquinas antes do cálculo. | 
| **DEC-04** | Trava rígida anti-duplicidade com códigos internos únicos (`V6-01` a `V6-04`, `V7-01`, `V4-01`) e exportação limpa (`V6`, `V7`, `V4`) no WhatsApp. | Não diferenciar unidades internamente. | Evita furos de estoque reais (como alocar o único `V7` e o único `V4` em dois cursos ao mesmo tempo no Domingo), mantendo o texto de WhatsApp limpo como a equipe já utiliza. | 
| **DEC-05** | Alocação sequencial padrão ($1$ a $23$) com filtro opcional de **Salto de Salas Distantes dos Computadores de Laudo**. | Tornar o salto das salas `1-5` e `9-10` fixo em todas as semanas. | Geralmente todos os consultórios são usados, mas em finais de semana específicos a equipe precisa pular salas distantes dos computadores de laudo para melhorar a logística da turma. | 
| **DEC-06** | Adotar o **Design System Oficial Nexus (Verde `#00A859`/`#10B981`, Branco `#FFFFFF` e Preto `#09090B`)** e preparar o schema para a futura **Planta Baixa**. | Paleta genérica e lista estática de salas. | Alinha o sistema à identidade visual oficial da *Academia Nexus* e deixa o objeto `ConsultingRoom` pronto para renderizar a planta baixa quando for enviada. | 
