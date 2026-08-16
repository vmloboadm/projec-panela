# Panela da Roça — Plano Completo de Melhorias

> Data: 30/07/2026 | Projeto: Sistema Financeiro Panela da Roça
> Base: ~3.800 linhas, 80+ arquivos, Next.js 16 + Supabase + OmniRoute AI

---

## Sumário

1. [🔥 Críticos — Segurança & Estabilidade](#1--críticos--segurança--estabilidade)
2. [🎯 80/20 — Maior Impacto com Menos Esforço](#2--8020--maior-impacto-com-menos-esforço)
3. [🏗️ Arquitetura & Refatoração](#3--arquitetura--refatoração)
4. [🧠 IA & Automação](#4--ia--automação)
5. [📱 UX & Mobile](#5--ux--mobile)
6. [📊 Relatórios & Analytics](#6--relatórios--analytics)
7. [🧪 Testes & Qualidade](#7--testes--qualidade)
8. [🚀 Deploy & DevOps](#8--deploy--devops)
9. [📋 Roadmap Sugerido](#9--roadmap-sugerido)

---

## 1. 🔥 Críticos — Segurança & Estabilidade

### 1.1 API sem autenticação real
- **Hoje**: Quase nenhuma API route valida o token do usuário. Usam `getAdmin()` (service_role key) diretamente.
- **Impacto**: Qualquer um com o link pode chamar as APIs e acessar/mutar dados.
- **Solução**: Middleware global ou helper `requireAuth(request)` que extrai e valida o Bearer token antes de qualquer operação.

### 1.2 Service Role Key no .env.local versionada
- **Hoje**: `.env.local` com `SERVICE_ROLE_KEY` e `OMNIRoute_API_KEY` está no repo.
- **Impacto**: Chaves expostas no GitHub se o repositório for público.
- **Solução**: Adicionar `.env.local` ao `.gitignore`, rotacionar chaves, usar `.env.example`.

### 1.3 Sem transação em operações compostas
- **Hoje**: `pagarConta()` faz PUT (status pago) + POST (lancamento) em sequência. Se o segundo falha, a conta fica paga mas sem lançamento.
- **Impacto**: Inconsistência financeira — dinheiro "some".
- **Solução**: Usar RPC do Supabase (transação SQL) ou pelo menos try/catch com rollback manual.

### 1.4 CSV import sem validação
- **Hoje**: `/api/importar` parseia CSV e insere direto. Sem validação de schema, tipos ou duplicatas.
- **Impacto**: CSV mal formatado pode corromper dados financeiros.
- **Solução**: Validar com Zod antes de inserir, rejeitar linhas inválidas com relatório.

### 1.5 Soft delete sem restore
- **Hoje**: DELETE em lancamentos seta `deleted_at`. Não há undelete nem visibilidade de itens deletados.
- **Impacto**: Se um delete acidental ocorrer, não há como recuperar.
- **Solução**: Página "Lixeira" com restore, ou no mínimo um log de deletions.

---

## 2. 🎯 80/20 — Maior Impacto com Menos Esforço

### 2.1 React Query (TanStack Query)
- **Esforço**: 3h
- **Impacto**: 🔥🔥🔥🔥🔥
- **O que fazer**: Substituir todos os `useEffect + fetch` por `useQuery` e `useMutation`
- **Benefícios**:
  - Cache automático (dados não refetcham ao navegar)
  - Dedup de chamadas (2 componentes não fazem 2 chamadas)
  - Refetch automático em background (polling nativo)
  - Loading/error states padronizados
  - Mutations com optimistic updates
- **Arquivos afetados**: dashboard, lancamentos, churrasco, contas-a-pagar, fechamento
- **Como implementar**: Sem provider global, usar `useQuery` diretamente nas páginas

### 2.2 useCallback nas api functions do useAuth
- **Esforço**: 15min
- **Impacto**: 🔥🔥🔥🔥🔥
- **O que fazer**: Envolver `apiGet, apiPost, apiPut, apiDelete, apiUpload` em `useCallback`
- **Benefícios**: Referências estáveis → sem re-renders em cascata → fim do flickering
- **Risco**: Nenhum. É uma mudança puramente mecânica.

### 2.3 Error Boundary global + Toasts
- **Esforço**: 1h
- **Impacto**: 🔥🔥🔥🔥
- **O que fazer**: 
  - ErrorBoundary component que captura erros não tratados
  - Sistema de toasts (react-hot-toast ou similar leve)
  - Tratamento centralizado de erros de API
- **Benefícios**: Usuário nunca vê tela branca ou console.error silencioso

### 2.4 Validação de formulários com Zod
- **Esforço**: 2h
- **Impacto**: 🔥🔥🔥
- **O que fazer**:
  - Schema de validação para cada formulário
  - Erros inline nos campos
  - Prevenir envio de dados inválidos
- **Arquivos**: novo-lancamento, contas-a-pagar, configuracoes, fechamento

### 2.5 Estado global compartilhado
- **Esforço**: 2h
- **Impacto**: 🔥🔥🔥🔥
- **O que fazer**: Contexto simples `DashboardDataContext` ou usar React Query (que já resolve isso)
- **Benefícios**: Dashboard → Lançamentos → Fechamento compartilham dados sem refetch

### 2.6 Navegação SPA (router.push em vez de window.location)
- **Esforço**: 1h
- **Impacto**: 🔥🔥🔥
- **O que fazer**: Substituir `window.location.href` por `router.push()` e `<Link>`
- **Benefícios**: Sem reload completo da página, transições suaves, performance

---

## 3. 🏗️ Arquitetura & Refatoração

### 3.1 Unificar frontend (React ou Static HTML)
- **Hoje**: Duas frentes — React pages (`.tsx`) e static HTML (`.html`) convivem. Rewrites no next.config.ts enviam tudo pros HTML.
- **Decisão necessária**: Escolher UM caminho.
  - **Opção A**: Remover rewrites e usar React puro (recomendado)
  - **Opção B**: Remover React pages e evoluir o static HTML com htmx/alpine
  - **Opção C**: Manter ambos mas com um padrão claro (ex: React para páginas financeiras, HTML para landing)

### 3.2 Centralizar SQL queries em arquivo único
- **Hoje**: SQL espalhado em 26 API routes. Mudar schema = caçar query por query.
- **Solução**: `src/lib/queries.ts` com funções nomeadas (ex: `getLancamentos()`, `createLancamento()`)

### 3.3 Tipagem forte (eliminar `any`)
- **Hoje**: Uso extensivo de `any` nos componentes (dashboard, useAuth, Shared)
- **Solução**: Tipos compartilhados em `src/types/` para Lancamento, ContaPagar, Categoria, ResumoGestao

### 3.4 CSS Modules ou Tailwind utilitário
- **Hoje**: CSS global de 454 linhas + dezenas de `style={{}}` inline
- **Solução**: Migrar para CSS modules ou usar Tailwind utility classes consistentemente

### 3.5 Remover dead code
- `src/components/ui/` (Card, Spinner, DashboardChart, Button — não usados)
- `src/app/api/contas/route.py` (1 linha `print("hello")`)
- Componentes não importados

### 3.6 Layout componentizado
- **Hoje**: Cada página repete header + TabBar + AuthGuard wrapper
- **Solução**: Layout aninhado do Next.js App Router

### 3.7 Repetição de fetch headers
- **Hoje**: Cada API route repete `getAdmin().from(...)`
- **Solução**: Helper `executeQuery(query, params)` que centraliza log, cache e error handling

---

## 4. 🧠 IA & Automação

### 4.1 OCR real para fotos/boletos
- **Hoje**: IA routes de foto/audio/boleto não processam arquivo real — só mandam metadados.
- **Solução**: Integrar Tesseract.js (OCR) ou Gemini Vision para extrair texto de imagens.

### 4.2 Classificador automático de despesas
- **Hoje**: IA pergunta usa contexto do resumo mensal. Não aprende com o tempo.
- **Solução**: Histórico de categorização por palavra-chave. Sugestão automática ao digitar descrição.

### 4.3 Reconciliação bancária automática
- **Solução**: Upload de extrato bancário (OFX/CSV) → IA cruza com lançamentos → sugere match.

### 4.4 Previsão de fluxo de caixa
- **Solução**: Baseado em contas a pagar recorrentes + média de receitas dos últimos 3 meses, projetar 30 dias à frente.

### 4.5 Alertas inteligentes
- **Hoje**: Insight route existe mas não é usada na UI.
- **Solução**: Notificação no dashboard quando despesa >30% acima da média, ou quando break-even está longe.

---

## 5. 📱 UX & Mobile

### 5.1 PWA (Progressive Web App)
- **O que**: manifest.json + service worker + ícones
- **Benefício**: "Adicionar à tela inicial" no celular, experiência de app nativo

### 5.2 Modo offline (básico)
- **O que**: Service worker cacheia páginas principais, permite visualizar último estado conhecido
- **Limitação**: App financeiro — gravação offline é complexa. Foco em leitura offline.

### 5.3 Pull-to-refresh
- **O que**: Gestual nativo para recarregar dados no dashboard e lançamentos

### 5.4 Haptic feedback
- **O que**: Vibração sutil ao pagar conta, excluir lançamento, fechar dia

### 5.5 Dark mode toggle
- **Hoje**: Só dark mode. Adicionar toggle claro/escuro.

### 5.6 Acessibilidade
- **O que**: ARIA labels, contraste, font-size ajustável, navegação por teclado

### 5.7 Onboarding / Tour inicial
- **O que**: Primeiro acesso mostra um mini-tutorial das 7 páginas

---

## 6. 📊 Relatórios & Analytics

### 6.1 Comparativo mês a mês
- **Hoje**: Dashboard só mostra o mês atual.
- **Solução**: Seletor de mês + gráfico comparativo (ex: faturamento últimos 6 meses).

### 6.2 Lucro por dia da semana
- **Hoje**: Não há.
- **Solução**: Gráfico de calor (heatmap) mostrando qual dia da semana dá mais lucro.

### 6.3 Ticket médio por período
- **Hoje**: Só no resumo mensal.
- **Solução**: Evolução do ticket médio nos últimos 30 dias.

### 6.4 Custo por kg (churrasco)
- **Hoje**: Sabe o preço por kg.
- **Solução**: Relatório de margem por tipo de carne (preço venda - preço compra) / preço venda.

### 6.5 Exportação avançada
- **Hoje**: CSV simples.
- **Solução**: PDF formatado (faturamento mensal), Excel (.xlsx) com múltiplas abas.

### 6.6 Dashboard executivo
- **O que**: Visão "semanal" com indicadores-chave, meta de faturamento, desvio de orçamento

---

## 7. 🧪 Testes & Qualidade

### 7.1 Playwright E2E — Login + CRUD Lançamento
- **Esforço**: 3h
- **O que**: Teste que loga, cria um lançamento, verifica no dashboard, deleta

### 7.2 Testes unitários das API routes
- **O que**: Testar cada endpoint com Vitest + supertest — foco em gestão/resumo e lançamentos

### 7.3 Teste de migração
- **O que**: Script que aplica migrations + seed data + verifica constraints

### 7.4 Lint + TypeScript strict mode
- **O que**: Ativar `strict: true` completo no tsconfig, resolver todos os `any`

### 7.5 Husky + lint-staged
- **O que**: Prevent commit de código com erros de lint/type

---

## 8. 🚀 Deploy & DevOps

### 8.1 Systemd para cloudflared
- **Hoje**: Tunnel inicia manual com nohup. Se morre, sistema fica offline.
- **Solução**: Serviço systemd com `Restart=always`

### 8.2 Healthcheck endpoint
- **O que**: `GET /api/health` que verifica DB + AI + retorna status
- **Uso**: Monitoramento externo (cron job a cada 5 min)

### 8.3 Logs estruturados
- **Hoje**: console.error apenas.
- **Solução**: Winston/Pino com níveis (info, warn, error) e formato JSON

### 8.4 Rate limiting
- **O que**: Prevenir abuso nas APIs (especialmente IA — chamadas custam dinheiro)

### 8.5 CI/CD básico
- **O que**: GitHub Action que roda build + lint + testes a cada push

### 8.6 Backup automático do banco
- **O que**: Script semanal que exporta Supabase para arquivo SQL

---

## 9. 📋 Roadmap Sugerido

### Semana 1 — Estabilização (🔥)
| Dia | Tarefa | Esforço |
|-----|--------|---------|
| 1 | `useCallback` nas api functions | 15min |
| 1 | Error Boundary + Toasts | 1h |
| 1 | Zod nos formulários | 2h |
| 2 | React Query no dashboard | 2h |
| 2 | React Query nas outras páginas | 1h |
| 3 | SPA navigation (router.push) | 1h |
| 3 | Estado global compartilhado | 1h |
| 4 | Centralizar SQL em queries.ts | 2h |
| 4 | Tipagem forte (eliminar any) | 2h |

### Semana 2 — Arquitetura
| Dia | Tarefa | Esforço |
|-----|--------|---------|
| 1 | Decidir React vs Static HTML | — |
| 1 | Refatorar layout aninhado | 1h |
| 2 | CSS Modules / Tailwind | 3h |
| 2 | Remover dead code | 30min |
| 3 | Autenticação real nas APIs | 2h |
| 3 | Transação em operações compostas | 1h |
| 4 | Gitignore + rotacionar chaves | 30min |
| 4 | CSV import com validação | 1h |

### Semana 3 — IA & UX
| Dia | Tarefa | Esforço |
|-----|--------|---------|
| 1 | PWA (manifest + service worker) | 1h |
| 1 | OCR real via Tesseract.js | 3h |
| 2 | Classificador automático de despesas | 2h |
| 2 | Previsão fluxo de caixa | 2h |
| 3 | Pull-to-refresh | 1h |
| 3 | Comparativo mês a mês | 1h |
| 4 | Alertas inteligentes | 1h |
| 4 | Onboarding / Tour inicial | 1h |

### Semana 4 — Qualidade & Deploy
| Dia | Tarefa | Esforço |
|-----|--------|---------|
| 1 | Playwright E2E (login + CRUD) | 3h |
| 1 | Testes unitários API routes | 2h |
| 2 | Systemd cloudflared | 1h |
| 2 | Healthcheck endpoint | 30min |
| 2 | CI/CD (GitHub Action) | 1h |
| 3 | Rate limiting | 1h |
| 3 | Backup automático | 30min |
| 4 | Husky + lint-staged | 30min |
| 4 | Ajustes finais de UX | 2h |

---

## Resumo 80/20

Para **estabilizar o sistema esta semana**, foque em:

```
1. useCallback no useAuth          → 15min  → fim do flickering
2. React Query no dashboard       → 2h     → dados estáveis, sem refetch louco
3. Error Boundary + Toasts        → 1h     → fim das telas brancas
4. Navegação SPA (router.push)    → 1h     → sem reload completo
5. Zod nos formulários            → 2h     → sem dados inválidos
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total: ~6h → 80% dos problemas resolvidos
```

---

## Métricas de Sucesso

| Indicador | Hoje | Meta | Prazo |
|-----------|------|------|-------|
| Páginas com flickering | 7/7 | 0/7 | Sem 1 |
| Erros não tratados | ~15 pontos | 0 | Sem 1 |
| `any` types | ~30+ | 0 | Sem 2 |
| Testes | 0 | 3 E2E + 10 unit | Sem 4 |
| Cobertura APIs com auth | ~10% | 100% | Sem 2 |
| Tempo de build | 8s | <6s | Sem 2 |

---

*Documento gerado em 30/07/2026 — Próxima revisão: 06/08/2026*
