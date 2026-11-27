# Groundsman

A squad planner for long-running Football Manager saves. Import your squad from FM, plan depth for every position in your formation, see how the squad looks over the next few seasons, and catch contract and ageing problems before they arrive.

Groundsman is an unofficial fan project. It is not affiliated with or endorsed by Sports Interactive or SEGA.

## What it does

- **Depth chart.** Pick a formation and line up first choice and cover for every position, with each player's familiarity there.
- **Squad.** The whole squad as one ledger: positions, age, contract, ability and potential as FM records them. Add, edit or remove players by hand.
- **Season timeline.** The current season and the three after it, position by position. Players drop off when their contracts end, and positions that thin out are flagged.
- **Import from FM27.** Save a squad view from FM as a web page, text file or CSV and drop it in. Any custom view works as long as it has Player, Position and Age. Re-import later to update the save; your own edits are kept.
- **Saves and backup.** Keep several saves side by side, switch between them, and back them up to a file.

Groundsman shows FM's numbers as recorded. It doesn't guess how players will develop.

## Your data

Everything stays in your browser. There are no accounts and nothing is uploaded. Saves live in the browser's local storage, so use the backup on the Saves screen to move to another browser or device.

## Importing a squad

1. In FM27, open the squad view you want to use.
2. Press Ctrl+P and save it as a web page, text file or CSV.
3. In Groundsman, open Import and drop the file in, or paste its contents.

FM24 and FM26 exports are planned.

## Status

Early development. Planned work is tracked in [issues](https://github.com/adnan-jasarevic/groundsman/issues).

## Development

Requires Node.js 22 or newer. Built with Angular.

```sh
npm install
npm start                  # dev server at http://localhost:4200
npm run build              # production build to dist/
npm test -- --watch=false  # unit tests (Vitest)
npm run lint               # ESLint with Angular rules
```

### Development data

In development builds, the app opens on a sample squad based on Manchester United's 2026/27 first team when no save exists yet. The data is illustrative only. Names, ages, nationalities and main positions follow public squad listings, but contract years, secondary positions, familiarity and ability ratings are made-up estimates. They are not assessments of real players and do not come from Football Manager.

## Credits

The app uses the [Barlow](https://github.com/jpt/barlow) and Barlow Condensed typefaces by Jeremy Tribby, self-hosted from `public/fonts` under the SIL Open Font License 1.1. The licence text is in `public/fonts/OFL.txt`.
