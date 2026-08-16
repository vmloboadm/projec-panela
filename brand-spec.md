# Brand Spec — Panela da Roça

Restaurante e Churrascaria tradicional desde 1997, Campos dos Goytacazes/RJ.

## Paleta (OKLch)

```css
:root {
  --bg:      oklch(15% 0.02 40);      /* marrom quase preto */
  --surface: oklch(22% 0.025 40);     /* marrom escuro, cards elevados */
  --fg:      oklch(95% 0.01 60);      /* creme quente, nunca branco puro */
  --muted:   oklch(65% 0.02 50);      /* bege terroso para texto secundário */
  --border:  oklch(35% 0.03 45);      /* marrom médio, divisores sutis */
  --accent:  oklch(62% 0.14 45);      /* laranja terracota/fogo, primária */
  
  --red-tijolo: oklch(48% 0.16 28);   /* vermelho tijolo, secundária */
  --verde-pago: oklch(55% 0.10 140);  /* verde terroso para status "pago" */
  --vermelho-atrasado: oklch(48% 0.16 28); /* mesma secundária, status "atrasado" */
}
```

## Tipografia

- **Display (marca, login, onboarding):** `'Rye', 'Alfa Slab One', Georgia, serif` — western/rústica desgastada, uso pontual.
- **Body (operacional, dados, números):** `'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif` — legibilidade máxima.
- **Mono (valores financeiros):** `'JetBrains Mono', ui-monospace, monospace` — opcional para destacar cifras.

## Postura visual

1. **Login/Onboarding:** fundo escuro `--bg`, textura sutil de madeira/fogo via `background-image` opacity baixa, tipografia display grande, logo placeholder reservado no centro superior.
2. **Telas operacionais (Dashboard, Lançamentos, Contas a Pagar, Confirmações):** fundo `--bg`, cards `--surface` com `border-radius: 12px`, bordas `--border` 1px, sem texturas — o dado financeiro é protagonista, não decoração.
3. **Hierarquia de cor:**
   - **Primária (--accent laranja):** CTAs principais, FAB, badges de alerta.
   - **Secundária (--red-tijolo):** botões de ação destrutiva (excluir), badges críticos.
   - **Status:** verde terroso (pago), vermelho tijolo (atrasado), laranja (pendente próximo ao vencimento).
4. **Touch targets:** mínimo 44px (mobile-first).
5. **Espaçamento:** generoso entre seções (24-32px), confortável dentro de cards (16-20px).
6. **Logo:** placeholder textual "Panela da Roça" até receber o arquivo real — slot reservado 240×80px no header, alinhado à esquerda, com espaço para futuro swap.

## Sistema

Direção customizada para churrascaria tradicional: rusticidade na identidade (login/marca), clareza operacional nas telas de uso diário (dados financeiros exigem contraste, legibilidade de números, status óbvios). Paleta terrosa com laranja fogo como acento, evita branco frio e verde saturado de semáforo.
