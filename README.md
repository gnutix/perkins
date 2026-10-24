# Six Points

A Perkins brailler trainer for French braille (non abrégé), made for a phone held sideways.

**Use it:** https://gnutix.github.io/perkins/
On iPhone, open it in Safari, then *Partager › Sur l'écran d'accueil* to get it full screen.

## Modes

- **Libre** — type on the six keys (3 2 1 · 4 5 6) like on the Perkins: press the keys of a sign together, and it is written when all of them are released. Each braille cell shows its French letter underneath, with the capital sign (4-6) and number sign (6 + Antoine digits) applied.
- **Exercices** — type a French text; every mistake stops the typing. *Montrer* / *Indice* lights up the keys to press. Lessons go from a–j to a La Fontaine fable, and *Mon texte* takes any text.

On a computer: `S D F` = dots 3 2 1, `J K L` = dots 4 5 6, plus `Space`, `Enter` and `Backspace`.

## Development

Everything is in `index.html` (no build step). Serve the folder and open it:

```bash
python3 -m http.server 8765
```
