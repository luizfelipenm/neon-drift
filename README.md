# NEON DRIFT

Twin-stick shooter neon feito para jogar no celular com o **controle de PS5 (DualSense)**. Também funciona com controle de Xbox, teclado + mouse ou toque na tela.

HTML5 + Canvas puro, sem dependências nem build. Instalável como app (PWA) e funciona offline.

## Controles

| Ação | DualSense | Teclado | Toque |
|---|---|---|---|
| Mover | L3 / D-pad | WASD / setas | lado esquerdo |
| Mirar e atirar | R3 | mouse (clique) | lado direito |
| Atirar para frente | R2 / R1 | — | — |
| Dash | ✕ / L1 / L2 | Espaço / Shift | botão DASH |
| Bomba | △ | E / Q | botão BOMB |
| Pausar | Options | Esc / P | botão II |

No menu: □ liga/desliga o som, ○ a vibração e △ o microfone.

## Áudio e microfone do controle

Com o microfone ligado, **grite para soltar a bomba** (medidor 🎤 no canto; recarga de 3 s).

- **DualSense por cabo USB-C no PC (Chrome/Edge):** o som do jogo sai no alto-falante do controle e o microfone dele é usado.
- **DualSense por Bluetooth (celular):** o áudio do controle não é acessível fora do PS5, então o jogo usa o microfone e o som do próprio aparelho.

## Conteúdo

- 7 tipos de inimigo: perseguidor, errante, divisor, atirador, investida (dasher), tanque e minis
- Chefão a cada 5 ondas, com 3 fases e padrões de tiro diferentes
- Power-ups: Rajada (R), Leque (S), Escudo (O) e Bomba (◆)
- Multiplicador por combo, vida extra a cada 25 mil pontos, top 5 local
- Vibração do controle (dual-rumble) em abates, dano, bombas e no chefão
- Microfone: grito = bomba

## Conectar o DualSense

1. Segure **Create + PS** até a luz piscar.
2. Pareie por Bluetooth no celular (Android ou iOS 14.5+).
3. Abra o jogo e aperte qualquer botão.

## Rodar local

```bash
npx serve .
```

---
Feito por **ZIUL** · [@luizfelipenm](https://github.com/luizfelipenm)
