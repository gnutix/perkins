# Six Points

A Perkins brailler trainer for French braille (non abrégé), made for a phone held sideways.

**Use it:** https://gnutix.github.io/perkins/
On iPhone, open it in Safari, then *Partager › Sur l'écran d'accueil* to get it full screen.
Each launch loads the latest version when online, and the last copy keeps working offline (`sw.js`).

## Modes

- **Libre** — type on the six keys (3 2 1 · 4 5 6) like on the Perkins: press the keys of a sign together, and it is written when all of them are released. Each braille cell shows its French letter underneath, with the capital sign (4-6) and number sign (6 + Antoine digits) applied.
- **Exercices** — type a French text; every mistake stops the typing. *Montrer* / *Indice* lights up the keys to press. Lessons go from a–j to a La Fontaine fable, and *Mon texte* takes any text.
- **Points faibles** — at the top of the exercise list. Each sign keeps its last 20 tries (a mistake or a hint counts as missed, along with what was typed instead); a sign with 5 tries or more, missed at least twice and in at least 15 % of them, shows up there, and so do the pairs typed one for the other (*h ↔ d*). *S'entraîner* makes a drill of about 60 characters: those signs alone, contrasts (*hd dh hdh*) and common words that contain them, made of signs already met when there are enough such words. *Choisir mes lettres* does the same with letters picked by hand. The record can be erased in *Réglages*.

- **Progrès** — from the exercise list. Practice time today, this week and per day over 4 weeks, days in a row, accuracy and speed week by week, every sign coloured by how often it is missed at first try (with its typing time), the signs mixed up (from exercises, and from corrections in free typing: a cell erased and retyped), reading and free typing figures, and lessons finished.

Every sign typed (exercises, free typing, reading) goes into a journal on the phone (IndexedDB `sixpoints`, with a summary per day), never anywhere else. Each event first lands in a small outbox in `localStorage`, so nothing is lost when iOS closes the connection of a page left in the background; it moves into IndexedDB as soon as it can, and a retried event is never counted twice.

On a computer: `S D F` = dots 3 2 1, `J K L` = dots 4 5 6, plus `Space`, `Enter` and `Backspace`.

## Development

Everything is in `index.html` (no build step). Serve the folder and open it:

```bash
python3 -m http.server 8765
```
