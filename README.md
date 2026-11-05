# Algabro

The **Beginning scene / Start menu** is the illustrated bedroom. Select the speech bubble to play the character animation and enter the **Game**, the 3D farm viewed from above.

In the game, Uncle Fil asks how many apples are in each of three equal baskets. Each new game randomly gives every basket 2–6 apples, with the total adjusted to match. Click a basket to lift it, then click its counting mat to dump the apples. Click an apple to mark and count it. Click a dumped basket to repack it. The interface stays in a side panel beside the field.

Enter an equation showing the basket relationship (for example `3b = 15`, `18 = 3x`, or `a+a+a = 12`) and the letter's value, then select **Submit answer**. Any single A–Z letter is accepted. Submission returns to the bedroom and opens Uncle Fil's note, which grades the equation and solution separately. Close the report to see it as a clickable paper on the desk. Results remain available during the current page session.

Both scenes use a landscape layout. The camera is fixed; interaction uses clicks and answer fields. The handwritten equation parser supports numbers, one letter, parentheses, and `+ - * /`, with implicit multiplication such as `3x`. It never executes input as code.

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
