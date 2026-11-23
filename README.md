# Groundsman

A squad planner for long-running Football Manager saves. Plan depth for every position in your formation, see how the squad looks in future seasons, catch contract and ageing risks early, and check where transfer targets would fit.

Groundsman is an unofficial fan project. It is not affiliated with or endorsed by Sports Interactive or SEGA.

## Status

Early development.

## Development

Requires Node.js 22 or newer.

```sh
npm install
npm start               # dev server at http://localhost:4200
npm run build           # production build to dist/
npm test -- --watch=false  # unit tests (Vitest)
npm run lint            # ESLint with Angular rules
```

### Development data

Until squad import lands, the app opens on a development squad based on Manchester United's 2026/27 first team. The data is illustrative only. Names, ages, nationalities and main positions follow public squad listings, but contract years, secondary positions, familiarity and star ratings are made-up estimates. They are not assessments of real players and do not come from Football Manager.

## Credits

The app uses the [Barlow](https://github.com/jpt/barlow) and Barlow Condensed typefaces by Jeremy Tribby, self-hosted from `public/fonts` under the SIL Open Font License 1.1. The licence text is in `public/fonts/OFL.txt`.
