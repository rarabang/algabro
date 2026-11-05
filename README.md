# Algabro

## Run locally

Requires Node.js 20 or newer. No dependency installation or build is needed; Three.js is vendored with its MIT license.

```sh
cd algabro
npm start
```

Open http://localhost:3000. To use another port, run `PORT=8080 npm start`. Use the HTTP server rather than opening `index.html` directly, because browser modules require HTTP.

## Structure

- `dist/index.html` and `dist/src/style.css`: the farm interface.
- `dist/src/game.js`: the overhead scene, Uncle Fil, interactive baskets, apples, and result flow.
- `dist/src/algebra.js`: equation parsing and answer checking.
- `dist/vendor/`: local Three.js modules and license.
- `scripts/server.mjs`: local static server.

## Checks

Run `npm test` from `algabro/` for the algebra and legacy movement tests. Run `npm run check` for JavaScript syntax checks.
