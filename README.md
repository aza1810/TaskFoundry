# Habitworks

Idle RPG habit tracker + step-powered **mini Factorio**.

Build a grid factory: mining drills, transport belts, inserters, furnaces, and chests.
**Every step you log is one mining cycle on every burner drill.**

## Play

```bash
npm install
npm run dev
```

### Loop
1. **Factory** — place a drill on an ore patch (iron / copper / coal)
2. **Steps** — log steps to mine; fuel drills with coal
3. **Belts + inserters** — move ore into furnaces, plates into chests
4. **Craft** — hand-craft more belts/machines from plates & gears
5. **Habits** — daily checks restock inventory for expansion

### Controls
| Key | Action |
|-----|--------|
| 1–5 | Drill / Belt / Inserter / Furnace / Chest |
| R | Rotate place direction |
| Q / X | Remove tool |
| Click | Place / remove |
| Shift-click | Rotate entity |
| Right-click chest | Collect into inventory |

Progress autosaves in `localStorage`.

## Stack

Vite · React · TypeScript
