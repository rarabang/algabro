import { faceCameraOnce, createSignTexture } from './signs.js';
import * as THREE from '../vendor/three.module.js';
import { splitQuantity } from './puzzles.js';

export function createAnimalPuzzle(parent, puzzle, onChange, registerTarget = () => {}, unregisterTarget = () => {}, cameraPosition = { x: 4, z: 25.4 }) {
  const targets = [], entries = [];
  const feedBowls = [];
  const tallyBoards = [];
  const updateTallies = () => tallyBoards.forEach(update => update());
  let feedPurchased = false;
  let selectedScoops = 1;
  const feedTotal = puzzle.kind === 'feed' ? puzzle.objects.length * puzzle.values.f : 0;
  let feedRemaining = feedTotal;
  let refreshFeedSupply = () => {};
  const reportFeed = () => {
    const equal = entries.length > 0 && entries.every(item => item.value === entries[0].value);
    onChange({ f: equal ? entries[0].value : '' }, { type: 'feed-sharing', remaining: feedRemaining });
  };
  const material = color => new THREE.MeshStandardMaterial({ color, roughness: 1 });
  const wool = material('#e8dfc7'), face = material('#79614a'), gold = material('#d7a646'), red = material('#b94a36');
  const geometry = new THREE.SphereGeometry(1, 12, 8);
  const coinGeometry = new THREE.CylinderGeometry(.24, .24, .08, 12);
  function part(group, shape, surface, x, y, z, scale = [1, 1, 1]) {
    const mesh = new THREE.Mesh(shape, surface); mesh.position.set(x, y, z); mesh.scale.set(...scale); group.add(mesh); return mesh;
  }
  const unitMaterials = new Map();
  const feedSignMaterials = new Map();
  function markedMaterial(unit) {
    if (unitMaterials.has(unit)) return unitMaterials.get(unit);
    const surface = document.createElement('canvas'); surface.width = 128; surface.height = 128;
    const ctx = surface.getContext('2d'); ctx.fillStyle = '#d7b975'; ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#433a28'; ctx.font = 'bold 64px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(unit), 64, 64);
    const texture = new THREE.CanvasTexture(surface); texture.colorSpace = THREE.SRGBColorSpace;
    const result = new THREE.MeshStandardMaterial({ map: texture, roughness: 1 });
    unitMaterials.set(unit, result); return result;
  }
  function feedSignMaterial(text) {
    if (feedSignMaterials.has(text)) return feedSignMaterials.get(text);
    const texture = createSignTexture(text);
    const result = new THREE.MeshStandardMaterial({ map: texture, roughness: 1 });
    feedSignMaterials.set(text, result); return result;
  }
  function makeFeedBag(parentGroup, x, y, z, size, marking) {
    const bag = new THREE.Group(); bag.position.set(x, y, z); bag.scale.setScalar(size); parentGroup.add(bag);
    const body = part(bag, new THREE.CylinderGeometry(.48, .68, 1.2, 8), material('#b99a68'), 0, .8, 0);
    part(bag, new THREE.CylinderGeometry(.43, .43, .12, 12), material('#8b693d'), 0, 1.45, 0);
    const rim = part(bag, new THREE.TorusGeometry(.47, .07, 6, 12), material('#d6b782'), 0, 1.48, 0);
    rim.rotation.x = Math.PI / 2;
    const boardFace = new THREE.Group();
    boardFace.position.set(marking === '+10' ? 1.55 : 0, marking === '+10' ? 1.35 : .8, marking === '+10' ? .5 : .8);
    bag.add(boardFace);
    if (marking === '+10') part(bag, new THREE.BoxGeometry(.11, 1.1, .11), material('#6c4a2e'), 1.55, .68, .35);
    const width = marking === '+10' ? 1.85 : .95;
    const height = marking === '+10' ? .7 : .56;
    body.userData.signTarget = part(boardFace, new THREE.BoxGeometry(width, height, .14), material('#875c36'), 0, 0, 0);
    const lettering = part(boardFace, new THREE.PlaneGeometry(width - .12, height - .12), feedSignMaterial(marking === '+1' ? '+1' : marking === '+10' ? '+10' : '10'), 0, 0, .09);
    faceCameraOnce(boardFace, cameraPosition);
    return body;
  }
  function drawTokens(entry) {
    for (const target of entry.tokenTargets) {
      unregisterTarget(target);
      const index = targets.indexOf(target); if (index >= 0) targets.splice(index, 1);
    }
    entry.tokenTargets = [];
    entry.tokens.clear();
    const units = puzzle.kind === 'eggs' ? Array(entry.value).fill(1) : splitQuantity(entry.value);
    units.forEach((unit, i) => {
      const bundle = unit > 1;
      const x = (i % 5 - 2) * .55, y = .6 + Math.floor(i / 20) * .4, z = Math.floor(i % 20 / 5) * .65;
      const token = unit === 10 && (puzzle.kind === 'feed' || puzzle.kind === 'animals')
        ? makeFeedBag(entry.tokens, x, y - .2, z, .45, '10')
        : part(entry.tokens, bundle ? new THREE.BoxGeometry(.65, .35, .65) : geometry,
          bundle ? puzzle.kind === 'trade' ? material('#957044') : markedMaterial(unit) : puzzle.kind === 'eggs' ? wool : puzzle.kind === 'trade' ? red : gold,
          x, y, z, bundle ? [1, 1, 1] : puzzle.kind === 'eggs' ? [.17, .23, .17] : [.15, .15, .15]);
      if (bundle && puzzle.kind === 'trade') {
        for (let apple = 0; apple < 10; apple++) {
          part(token, geometry, red, (apple % 5 - 2) * .11, .27, (Math.floor(apple / 5) - .5) * .22, [.075, .075, .075]);
        }
      }
      token.userData.action = () => change(entry, -unit);
      targets.push(token); entry.tokenTargets.push(token); registerTarget(token);
      if (token.userData.signTarget) {
        token.userData.signTarget.userData.action = token.userData.action;
        targets.push(token.userData.signTarget); entry.tokenTargets.push(token.userData.signTarget); registerTarget(token.userData.signTarget);
      }
    });
  }
  function change(entry, amount) {
    if (puzzle.kind === 'trade' && feedPurchased) {
      onChange({ n: entry.value }, { type: 'already-purchased', balance: entry.balance, feedPurchased });
      return;
    }
    if (puzzle.kind === 'feed') {
      const moved = amount > 0 ? Math.min(amount, feedRemaining) : -Math.min(-amount, entry.value);
      entry.value += moved;
      feedRemaining -= moved;
      entry.bounce = .3;
      drawTokens(entry);
      refreshFeedSupply();
      reportFeed();
      return;
    }
    const value = Math.max(0, Math.min(entry.spec.capacity ?? 100, entry.value + amount));
    if (entry.value === value) return;
    const linked = puzzle.kind === 'eggs' ? [entry] : entries.filter(item => item.spec.variable === entry.spec.variable);
    linked.forEach(item => { item.value = value; item.bounce = .3; drawTokens(item); });
    updateTallies();
    const proposed = Object.fromEntries(Object.keys(puzzle.values).map(variable => [variable,
      puzzle.kind === 'eggs' ? entries.reduce((sum, item) => sum + item.value, 0) : entries.find(item => item.spec.variable === variable)?.value || 0]));
    if (puzzle.kind === 'trade') {
      entry.balance = entry.spec.initialMoney + value * entry.spec.price;
      entry.updateCoins();
      onChange(proposed, { type: 'sale', balance: entry.balance, feedPurchased });
    } else {
      onChange(proposed, puzzle.kind === 'animals'
        ? { type: 'feed', species: entry.spec.species, value,
          portions: [...new Map(entries.map(item => [item.spec.variable,
            { species: item.spec.species, value: item.value }])).values()] } : '');
    }
  }
  const rows = [...new Set(puzzle.objects.map(spec => spec.row))];
  rows.forEach(row => {
    const count = puzzle.objects.filter(spec => spec.row === row).length;
    const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(count * 7, .08, 8)), new THREE.LineBasicMaterial({ color: '#655035' }));
    outline.position.set(0, .18, puzzle.kind === 'animals' ? -12 + row * 9 : -3);
    parent.add(outline);
  });
  if (puzzle.kind === 'animals') {
    const bucket = new THREE.Group();
    bucket.position.set(-11, 2.25, 10);
    parent.add(bucket);
    const metal = material('#657b79');
    part(bucket, new THREE.CylinderGeometry(1.4, 1, 2, 20, 1, true), metal, 0, 1, 0);
    part(bucket, new THREE.CylinderGeometry(1, 1, .15, 20), metal, 0, .1, 0);
    const rim = part(bucket, new THREE.TorusGeometry(1.4, .12, 8, 24), metal, 0, 2, 0);
    rim.rotation.x = Math.PI / 2;
    part(bucket, new THREE.TorusGeometry(1.4, .08, 8, 24, Math.PI), metal, 0, 2, 0);
    const signpost = new THREE.Group();
    signpost.position.set(2.7, 0, 0);
    bucket.add(signpost);
    part(signpost, new THREE.BoxGeometry(.2, 3.6, .2), material('#6c4a2e'), 0, 1.8, 0);
    const signFace = new THREE.Group();
    signFace.position.set(0, 3, .3);
    // Fixed orientation for the game's camera; the sign does not billboard.
    signpost.add(signFace);
    faceCameraOnce(signFace, cameraPosition);
    const board = part(signFace, new THREE.BoxGeometry(3.8, 1.15, .18), material('#875c36'), 0, 0, 0);
    const caption = part(signFace, new THREE.PlaneGeometry(3.55, .95), feedSignMaterial('CLEAR ALL'), 0, 0, .11);
    const clear = () => {
      entries.forEach(entry => {
        entry.value = 0;
        entry.bounce = .3;
        drawTokens(entry);
      });
      updateTallies();
      onChange(Object.fromEntries(Object.keys(puzzle.values).map(variable => [variable, 0])), { type: 'feed-clear' });
    };
    const target = part(bucket, new THREE.CylinderGeometry(1.8, 1.8, 3.5, 12), new THREE.MeshBasicMaterial({ visible: false }), 0, 1.5, 0);
    for (const object of [target, board, caption]) {
      object.userData.action = clear;
      targets.push(object);
    }
    for (const amount of [1, 10]) {
      const x = -16, z = amount === 1 ? -10 : 0;
      const supply = makeFeedBag(parent, x, .25, z, 1.8, amount === 10 ? '+10' : '+1');
      const choose = () => {
        selectedScoops = amount;
        feedBowls.forEach(({ bowl, glow }) => {
          const active = true;
          bowl.material.emissive.set(active ? '#d9b84c' : '#000000');
          bowl.material.emissiveIntensity = active ? .65 : 0;
          glow.visible = active;
        });
        onChange({}, { type: 'feed-supply', amount });
      };
      for (const target of [supply, supply.userData.signTarget]) {
        target.userData.action = choose; targets.push(target);
      }
    }
  }
  puzzle.objects.forEach((spec, i) => {
    const root = new THREE.Group(); root.position.set((spec.column - (spec.columns - 1) / 2) * 7, .3, puzzle.kind === 'animals' ? -14 + spec.row * 9 : -5); parent.add(root);
    if (spec.quantity) {
      const signX = spec.column === 0 ? -3.8 : 3.8;
      const boardFace = new THREE.Group();
      boardFace.position.set(signX, 3.2, .2);
      root.add(boardFace);
      faceCameraOnce(boardFace, cameraPosition);
      part(boardFace, new THREE.BoxGeometry(3.6, 1, .18), material('#875c36'), 0, 0, 0);
      part(boardFace, new THREE.PlaneGeometry(3.35, .8), feedSignMaterial(`${spec.quantity} ${spec.species === 'hen' ? 'HENS' : spec.species === 'goat' ? 'GOATS' : 'SHEEP'}`), 0, 0, .11);
      part(root, new THREE.BoxGeometry(.15, 3.2, .15), material('#6c4a2e'), signX, 1.6, -.15);
    }
    const model = new THREE.Group();
    model.rotation.y = Math.atan2(root.position.x - cameraPosition.x, root.position.z - cameraPosition.z);
    root.add(model);
    const hen = spec.species === 'hen';
    const goat = spec.species === 'goat';
    const coat = goat ? face : wool;
    const eyes = material('#252922');
    part(model, geometry, coat, 0, 1.5, 0, hen ? [.8, .9, 1] : [1.1, .9, 1.6]);
    part(model, geometry, hen ? wool : face, 0, 2, -1.4, hen ? [.45, .5, .45] : [.5, .65, .65]);
    if (!hen && !goat) {
      for (let ring = 0; ring < 3; ring++) for (let puff = 0; puff < 7; puff++) {
        const angle = puff / 7 * Math.PI * 2;
        part(model, geometry, wool, Math.cos(angle) * .85, 1.5 + Math.sin(angle) * .65, -.9 + ring * .85, [.5, .5, .5]);
      }
    }
    for (const side of [-1, 1]) {
      part(model, new THREE.CylinderGeometry(.1, .1, 1, 6), hen ? gold : face, side * .5, .6, .5);
      if (hen) {
        for (let toe = -1; toe <= 1; toe++) part(model, new THREE.BoxGeometry(.07, .07, .4), gold, side * .5 + toe * .1, .12, .3);
        part(model, geometry, wool, side * .72, 1.5, .1, [.2, .6, .8]);
      } else {
        part(model, new THREE.CylinderGeometry(.1, .1, 1, 6), face, side * .5, .6, -.8);
        for (const z of [.5, -.8]) part(model, new THREE.BoxGeometry(.27, .18, .3), eyes, side * .5, .15, z);
        part(model, geometry, face, side * .6, 2.25, -1.4, [.45, .14, .23]);
      }
      part(model, geometry, eyes, side * (hen ? .32 : .35), 2.2, -1.8, [.075, .075, .075]);
      if (goat) {
        const horn = part(model, new THREE.ConeGeometry(.15, .9, 6), gold, side * .32, 2.85, -1.2);
        horn.rotation.x = .4;
      }
    }
    if (hen) {
      part(model, new THREE.ConeGeometry(.2, .5, 4), gold, 0, 2, -2).rotation.x = -Math.PI / 2;
      for (let bump = 0; bump < 3; bump++) part(model, geometry, red, 0, 2.5 + (bump === 1 ? .1 : 0), -1.65 + bump * .22, [.14, .25, .18]);
      part(model, geometry, red, 0, 1.7, -1.75, [.14, .23, .12]);
      for (let feather = -1; feather <= 1; feather++) {
        const tail = part(model, geometry, wool, feather * .18, 2, 1, [.17, .6, .25]); tail.rotation.x = .6;
      }
    } else {
      part(model, geometry, coat, 0, 1.7, 1.65, [.2, .35, .3]);
      if (goat) part(model, new THREE.ConeGeometry(.2, .6, 6), face, 0, 1.4, -1.6).rotation.z = Math.PI;
    }
    if (spec.quantity) {
      // Fit the exact clue quantity into a compact flock, leaving the plate in front.
      const columns = Math.min(4, spec.quantity);
      const flockRows = Math.ceil(spec.quantity / columns);
      const template = model.clone(true);
      const place = (animal, index) => {
        animal.scale.setScalar(.38);
        animal.position.set((index % columns - (columns - 1) / 2) * 1.4, 0,
          (Math.floor(index / columns) - (flockRows - 1) / 2) * 1.5);
      };
      place(model, 0);
      for (let animal = 1; animal < spec.quantity; animal++) {
        const copy = template.clone(true);
        place(copy, animal);
        root.add(copy);
      }
    }
    const bowl = part(root, puzzle.kind === 'trade' ? new THREE.BoxGeometry(3, .25, 2.4) : new THREE.CylinderGeometry(1.5, 1.2, .35, 16), material('#ae8056'), 0, .3, 4);
    if (puzzle.kind === 'animals') {
      const glow = part(root, new THREE.TorusGeometry(2.15, .2, 8, 32), material('#f4d66d'), 0, .52, 4);
      glow.rotation.x = Math.PI / 2;
      glow.visible = false;
      feedBowls.push({ bowl, glow });
    }
    const tokens = new THREE.Group(); tokens.position.z = 4; root.add(tokens);
    const entry = { root, tokens, spec, value: 0, balance: spec.initialMoney || 0, bounce: 0, tokenTargets: [] }; entries.push(entry);
    const target = part(root, new THREE.BoxGeometry(4, 4, 5), new THREE.MeshBasicMaterial({ visible: false }), 0, 2, 0);
    target.userData.action = () => change(entry, puzzle.kind === 'animals' ? selectedScoops : 1);
    if (puzzle.kind === 'feed') target.userData.feedAction = 'give';
    targets.push(target);
    let bundle;
    if (puzzle.kind === 'trade') {
      bundle = part(root, puzzle.kind === 'trade' ? new THREE.BoxGeometry(2, .8, 1.3) : new THREE.BoxGeometry(1.1, .9, 1.1),
        puzzle.kind === 'trade' ? material('#957044') : markedMaterial(10), puzzle.kind === 'trade' ? -7 : 3, .8, 3);
    }
    if (puzzle.kind === 'trade') {
      // Apples move from the stand to the sale tray; the money then buys the bag beside the sheep.
      part(root, new THREE.BoxGeometry(7, .35, 4), material('#9b7045'), -8.5, .22, 2);
      for (const x of [-11, -6]) for (const z of [.3, 3.7]) part(root, new THREE.BoxGeometry(.25, 1.1, .25), material('#765238'), x, -.38, z);
      for (let apple = 0; apple < 10; apple++) {
        part(root, geometry, red, -7 + (apple % 5 - 2) * .32, 1.35, 3 + (Math.floor(apple / 5) - .5) * .48, [.14, .14, .14]);
      }
    }
    if (bundle) { bundle.userData.action = () => change(entry, 10); targets.push(bundle); }
    if (bundle?.userData.signTarget) {
      bundle.userData.signTarget.userData.action = bundle.userData.action;
      targets.push(bundle.userData.signTarget);
    }
    bowl.userData.action = () => change(entry, puzzle.kind === 'animals' ? selectedScoops : -1);
    if (puzzle.kind === 'feed') bowl.userData.feedAction = 'return';
    targets.push(bowl);
    if (puzzle.kind === 'trade') {
      const singleApple = part(root, geometry, red, -10, 1.1, 1, [.6, .6, .6]);
      part(root, new THREE.CylinderGeometry(.07, .08, .28, 6), face, -10, 1.7, 1);
      const purse = part(root, new THREE.CylinderGeometry(1.1, .9, .5, 14), material('#80613c'), 6.25, .55, 1);
      part(root, new THREE.TorusGeometry(1.1, .1, 6, 18), gold, 6.25, .8, 1).rotation.x = Math.PI / 2;
      const coins = new THREE.Group(); coins.position.set(6.25, .85, 1); root.add(coins);
      entry.updateCoins = () => {
        coins.clear();
        for (let coin = 0; coin < Math.min(12, Math.floor(entry.balance)); coin++) {
          part(coins, coinGeometry, gold, (coin % 4 - 1.5) * .4, .06 + Math.floor(coin / 4) * .1, (Math.floor(coin / 2) % 2 - .5) * .5);
        }
      };
      entry.updateCoins();
      const feedBag = new THREE.Group(); feedBag.position.set(11.25, .2, 2); root.add(feedBag);
      part(feedBag, new THREE.BoxGeometry(2.1, 2.7, 1.25), material('#c7ad79'), 0, 1.35, 0);
      part(feedBag, new THREE.BoxGeometry(2.2, .28, 1.35), material('#a68958'), 0, 2.65, 0);
      part(feedBag, new THREE.BoxGeometry(1.35, .58, .08), material('#6c8658'), 0, 1.5, .66);
      part(root, new THREE.BoxGeometry(3.1, .2, 2.4), material('#9b7045'), 11.25, .18, 2);
      const feedTarget = part(feedBag, new THREE.BoxGeometry(2.7, 3.2, 2), new THREE.MeshBasicMaterial({ visible: false }), 0, 1.4, 0);
      feedTarget.userData.action = () => {
        const balance = entry.balance;
        if (feedPurchased) {
          onChange({ n: entry.value }, { type: 'already-purchased', balance, feedPurchased });
          return;
        }
        if (balance < entry.spec.feedCost) {
          onChange({ n: entry.value }, { type: 'short', balance, missing: entry.spec.feedCost - balance });
          return;
        }
        feedPurchased = true;
        feedBag.position.set(0, .2, 1);
        entry.balance -= entry.spec.feedCost;
        entry.updateCoins();
        onChange({ n: entry.value }, { type: 'purchase', balance: entry.balance, feedPurchased });
      };
      feedTarget.userData.tradeAction = 'buy-feed';
      targets.push(feedTarget);
      singleApple.userData.action = () => change(entry, 1); targets.push(singleApple);
      singleApple.userData.tradeAction = 'sell-one';
      bundle.userData.tradeAction = 'sell-ten';
      target.userData.action = () => { entry.bounce = .3; };
      purse.userData.action = () => onChange({ n: entry.value }, { type: 'balance', balance: entry.balance, feedPurchased });
      purse.userData.tradeAction = 'check-balance';
      targets.push(purse);
    }
  });
  if (puzzle.kind === 'feed') {
    const supply = new THREE.Group(); supply.position.set(-14, .3, 5); parent.add(supply);
    part(supply, new THREE.CylinderGeometry(2.4, 2, 1.4, 16), material('#b99a68'), 0, 1, 0);
    const scoops = new THREE.Group(); supply.add(scoops);
    refreshFeedSupply = () => {
      scoops.clear();
      for (let i = 0; i < feedRemaining; i++) {
        part(scoops, geometry, gold, (i % 5 - 2) * .65, 1.8 + Math.floor(i / 25) * .3,
          (Math.floor(i / 5) % 5 - 2) * .65, [.22, .15, .22]);
      }
    };
    refreshFeedSupply();
    const target = part(supply, new THREE.CylinderGeometry(2.6, 2.6, 4, 16), new THREE.MeshBasicMaterial({ visible: false }), 0, 2, 0);
    target.userData.action = reportFeed;
    targets.push(target);
  }
  if (puzzle.kind === 'animals') {
    rows.forEach(row => {
      const rowEntries = entries.filter(entry => entry.spec.row === row);
      const clue = rowEntries.reduce((sum, entry) => sum + entry.spec.quantity * puzzle.values[entry.spec.variable], 0);
      const post = new THREE.Group();
      post.position.set(13, .25, -12 + row * 9);
      parent.add(post);
      part(post, new THREE.BoxGeometry(.22, 4, .22), material('#6c4a2e'), 0, 2, 0);
      const boardFace = new THREE.Group(); boardFace.position.set(0, 4, .25); post.add(boardFace);
      faceCameraOnce(boardFace, cameraPosition);
      const frame = part(boardFace, new THREE.BoxGeometry(5.6, 2.9, .2), material('#875c36'), 0, 0, 0);
      const surface = document.createElement('canvas'); surface.width = 960; surface.height = 480;
      const ctx = surface.getContext('2d');
      ctx.scale(2, 2);
      const texture = new THREE.CanvasTexture(surface); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
      const panel = part(boardFace, new THREE.PlaneGeometry(5.4, 2.7), new THREE.MeshStandardMaterial({ map: texture, roughness: 1 }), 0, 0, .12);
      const total = () => rowEntries.reduce((sum, entry) => sum + entry.spec.quantity * entry.value, 0);
      const update = () => {
        const current = total();
        frame.material.color.set(current === clue ? '#4d8252' : '#875c36');
        ctx.clearRect(0, 0, 480, 240);
        ctx.fillStyle = '#fff7e5'; ctx.fillRect(0, 0, 480, 240);
        ctx.fillStyle = '#344d41'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 58px sans-serif';
        ctx.fillText(`GOAL: ${clue}`, 240, 72);
        ctx.font = 'bold 54px sans-serif';
        ctx.fillText(`${current} scoops`, 240, 170);
        texture.needsUpdate = true;
      };
      const explain = () => {
        const calculation = rowEntries.map(entry => `${entry.spec.quantity} ${entry.spec.species} × ${entry.value}`).join(' + ');
        onChange({}, { type: 'feed-tally', message: `Row ${row + 1}: ${calculation} = ${total()} scoops. Clue: ${clue} scoops.` });
      };
      for (const target of [frame, panel]) { target.userData.action = explain; targets.push(target); }
      tallyBoards.push(update);
      update();
    });
  }
  return { targets, update(delta, reduced) { entries.forEach(entry => { entry.bounce = Math.max(0, entry.bounce - delta); entry.root.position.y = .3 + (reduced ? 0 : Math.sin(entry.bounce / .3 * Math.PI) * .4); }); } };
}
