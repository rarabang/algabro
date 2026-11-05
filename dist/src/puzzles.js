export const VALUE_RANGES = [[1, 3], [4, 9], [10, 24], [25, 39], [40, 69], [70, 99]];
export function valueRange(level) { return VALUE_RANGES[Math.max(0, Math.min(5, level - 1))]; }
export function generateRemainderPuzzle(basketCount, applesPerBasket, random = Math.random) {
  // Leave fewer apples than would fill another basket.
  applesPerBasket = Math.max(2, applesPerBasket);
  const leftoverApples = 1 + Math.floor(random() * (applesPerBasket - 1));
  return { basketCount, applesPerBasket, leftoverApples, totalApples: basketCount * applesPerBasket + leftoverApples };
}
export function splitQuantity(value) {
  const result = [];
  for (const unit of [100, 10, 1]) {
    const count = Math.floor(value / unit);
    for (let i = 0; i < count; i++) result.push(unit);
    value %= unit;
  }
  return result;
}
const money = value => `$${value.toFixed(2)}`;
const integer = (min, max, random) => min + Math.floor(random() * (max - min + 1));
const ratios = [[1, 1], [1, 2], [2, 1], [2, 3], [3, 2]];
const choose = (items, random) => items[Math.floor(random() * items.length)];

// Difficulty measures given number sizes and distinct unknowns, not puzzle themes.
export function rateDifficulty(numbers, variables) {
  const largest = Math.max(...numbers.map(Math.abs));
  return Math.min(6, (largest <= 10 ? 1 : largest <= 25 ? 2 : 3) + 2 * (new Set(variables).size - 1));
}

export function generateAdvancedPuzzle(level, random = Math.random) {
  const pick = max => 1 + Math.floor(random() * max);
  const [minimum, maximum] = valueRange(level);
  const sample = () => minimum + Math.floor(random() * (maximum - minimum + 1));
  const count = level <= 3 ? 1 : level <= 5 ? 2 : 3;
  const commerce = random() < .5;
  const priceStep = level === 1 ? 1 : level === 2 ? .5 : .25;
  const amount = () => commerce ? 1 + priceStep * Math.floor(random() * (2 / priceStep + 1)) : sample();
  const a = count === 1 && !commerce ? Math.max(2, amount()) : amount(), b = amount(), c = amount();
  let prompt, equations, values, numbers, basketQuantity, leftoverApples, commerceAppleQuantity, saleBundles, basketClues, saleDetails;
  if (count === 1) {
    const quantity = level === 1 ? integer(2, 3, random) : level === 2 ? integer(3, 5, random) : commerce ? integer(10, 19, random) : integer(6, 9, random);
    const remainderChoices = Array.from({ length: Math.max(0, a - 1) }, (_, i) => i + 1).filter(value => value !== quantity);
    const fee = commerce ? (level === 1 ? 1 : pick(3)) : remainderChoices[Math.floor(random() * remainderChoices.length)];
    const total = commerce ? quantity * a - fee : quantity * a + fee;
    prompt = commerce
      ? `I sell ${quantity} apples for the same price each. After paying ${money(fee)} to transport them, I keep ${money(total)}. How much did I charge for each apple? Let p be the price of one apple in dollars.`
      : `I picked ${total} apples. I put the same number in each of ${quantity} baskets, with ${fee} left unpacked. How many apples are in each basket? Let a be that number.`;
    if (!commerce) { basketQuantity = quantity; leftoverApples = fee; }
    else { commerceAppleQuantity = quantity; saleDetails = { fee, total }; }
    values = commerce ? { p: a } : { a };
    equations = [`${quantity}${commerce ? 'p' : 'a'}${commerce ? '-' : '+'}${fee}=${total}`];
    numbers = [quantity, fee, total];
  } else if (count === 2) {
    const first = choose(ratios, random);
    const secondRatio = choose(ratios.filter(([red, other]) => first[0] * other !== red * first[1]), random);
    const scale1 = commerce ? integer(3, 5, random) : 1;
    const scale2 = commerce ? integer(3, 5, random) : 1;
    const [r1, o1] = first.map(n => n * scale1);
    const [r2, o2] = secondRatio.map(n => n * scale2);
    const other = commerce ? 'g' : 'b';
    const total1 = r1 * a + o1 * b, total2 = r2 * a + o2 * b;
    prompt = commerce
      ? `At my farm stand, a red apple costs r dollars and a green apple costs g dollars. ${r1} red apples and ${o1} green apples cost ${money(total1)}. ${r2} red apples and ${o2} green apples cost ${money(total2)}. What are r and g?`
      : `I pack red and blue baskets. Each red basket holds r apples, and each blue basket holds b apples. ${r1} red baskets and ${o1} blue baskets hold ${total1} apples. ${r2} red baskets and ${o2} blue baskets hold ${total2} apples. How many apples fit in each basket? Find r and b.`;
    equations = [`${r1}r+${o1}${other}=${total1}`, `${r2}r+${o2}${other}=${total2}`];
    values = { r: a, [other]: b };
    if (!commerce) basketClues = [{ counts: { r: r1, b: o1 }, total: total1 }, { counts: { r: r2, b: o2 }, total: total2 }];
    if (commerce) saleBundles = [{ counts: { r: r1, g: o1 }, total: total1 }, { counts: { r: r2, g: o2 }, total: total2 }];
    numbers = [r1, o1, r2, o2, total1, total2];
  } else {
    // Pick varied pair quantities whose three equations uniquely determine r, g, and y.
    let pairCounts;
    do {
      pairCounts = [
        { r: integer(1, 3, random), g: integer(1, 3, random), y: 0 },
        { r: 0, g: integer(1, 3, random), y: integer(1, 3, random) },
        { r: integer(1, 3, random), g: 0, y: integer(1, 3, random) },
      ];
    } while (pairCounts[0].r * pairCounts[1].g * pairCounts[2].y
      + pairCounts[0].g * pairCounts[1].y * pairCounts[2].r === 0);
    const totals = pairCounts.map(counts => counts.r * a + counts.g * b + counts.y * c);
    const clues = pairCounts.map((counts, i) => ({ counts, total: totals[i] }));
    const clueText = (clue, i, nouns) => `${clue.counts.r} red ${nouns}, ${clue.counts.g} green ${nouns}, and ${clue.counts.y} yellow ${nouns} ${commerce ? 'cost' : 'hold'} ${commerce ? money(clue.total) : clue.total}${i < 2 ? '. ' : '. '}`;
    prompt = commerce
      ? `At my farm stand, red, green, and yellow apples cost r, g, and y dollars each. ${clues.map((clue, i) => clueText(clue, i, 'apples')).join('')} What is the price of each colour?`
      : `I pack red, green, and yellow baskets. They hold r, g, and y apples. ${clues.map((clue, i) => clueText(clue, i, 'baskets')).join('')} How many apples fit in each basket?`;
    equations = clues.map(({ counts, total }) => `${counts.r ? `${counts.r}r` : ''}${counts.r && counts.g ? '+' : ''}${counts.g ? `${counts.g}g` : ''}${counts.y ? `${counts.r || counts.g ? '+' : ''}${counts.y}y` : ''}=${total}`);
    values = { r: a, g: b, y: c };
    if (!commerce) basketClues = clues;
    if (commerce) saleBundles = clues.map(({ counts, total }) => ({ counts, total }));
    numbers = totals;
  }
  return { prompt, equations, values, commerce, saleBundles, basketQuantity, leftoverApples, commerceAppleQuantity, basketClues, saleDetails, difficulty: rateDifficulty(numbers, Object.keys(values)) };
}

export function generateAnimalPuzzle(level, random = Math.random) {
  const pick = max => 1 + Math.floor(random() * max);
  const [minimum, maximum] = valueRange(level);
  const sample = () => minimum + Math.floor(random() * (maximum - minimum + 1));
  const portion = () => 1 + Math.floor(random() * 10);
  const a = level >= 4 ? portion() : sample(), b = level >= 4 ? portion() : sample(), c = level >= 4 ? portion() : sample();
  const kinds = level <= 3 ? ['feed', 'eggs', 'trade'] : ['animals'];
  const kind = kinds[Math.floor(random() * kinds.length)];
  let prompt, equations, values, objects, numbers, animalGroups;
  if (kind === 'feed') {
    const sheep = integer(2, 4, random);
    const total = sheep * a;
    prompt = `I’m feeding ${sheep} sheep. I have ${total} scoops of feed and want to give each sheep the same amount. Let f be the scoops each sheep gets. How many scoops is f?`;
    equations = [`${sheep}f=${total}`]; values = { f: a }; numbers = [sheep, total];
    objects = Array.from({ length: sheep }, () => ({ species: 'sheep', variable: 'f', unit: 'scoops' }));
  } else if (kind === 'eggs') {
    const hens = integer(2, level === 1 ? 3 : 4, random);
    prompt = `My ${hens} hens lay ${a} eggs each. If e is the total number of eggs, what is e?`;
    equations = [`e=${hens}*${a}`]; values = { e: hens * a }; numbers = [hens, a, hens * a];
    objects = Array.from({ length: hens }, () => ({ species: 'hen', variable: 'e', unit: 'eggs', capacity: a }));
  } else if (kind === 'trade') {
    const price = integer(2, 4, random) * (level === 1 ? 1 : level === 2 ? .5 : .25), initialMoney = integer(1, 3, random), earned = price * a, cost = earned + initialMoney;
    prompt = `A bag of sheep feed costs ${money(cost)}. I already have ${money(initialMoney)} and earn ${money(price)} for each apple I sell. Let n be the number of apples I need to sell to buy the feed. What is n?`;
    equations = [`${price}n+${initialMoney}=${cost}`]; values = { n: a }; numbers = [price, cost, initialMoney];
    objects = [{ species: 'sheep', variable: 'n', unit: 'apples sold', price, initialMoney, feedCost: cost }];
  } else {
    const three = level === 6;
    const [low, high] = level === 4 ? [2, 5] : level === 5 ? [6, 9] : [10, 15];
    const sheep = low + Math.floor(random() * (high - low));
    const extra = 1 + Math.floor(random() * (high - sheep));
    const hens = low + Math.floor(random() * (high - low + 1));
    const group = (species, variable, quantity) => ({ species, variable, quantity, capacity: 10 });
    animalGroups = [[group('sheep', 's', sheep + extra), group('hen', 'h', hens)],
      [group('sheep', 's', sheep), group('hen', 'h', hens)]];
    const first = (sheep + extra) * a + hens * b, second = sheep * a + hens * b;
    prompt = `My ${three ? 'sheep, hens, and goats' : 'sheep and hens'} eat feed each day. Animals of the same kind get equal portions. ${sheep + extra} sheep and ${hens} hens eat ${first} scoops a day. ${sheep} sheep and ${hens} hens eat ${second} scoops a day.`;
    equations = [`${sheep + extra}s+${hens}h=${first}`, `${sheep}s+${hens}h=${second}`];
    values = { s: a, h: b }; numbers = [sheep + extra, hens, first, second];
    if (three) {
      const goats = low + Math.floor(random() * (high - low + 1));
      const total = goats * c + sheep * a;
      prompt += ` ${goats} goats and ${sheep} sheep eat ${total} scoops a day.`;
      equations.push(`${goats}g+${sheep}s=${total}`); values.g = c; numbers.push(total);
      animalGroups.push([group('goat', 'g', goats), group('sheep', 's', sheep)]);
    }
    prompt += ` How many scoops does one animal of each kind eat per day? Let s be the sheep’s portion, h the hen’s portion${three ? ', and g the goat’s portion' : ''}.`;
  }
  // Each row represents one clue; repeated species share a single proposed amount.
  const groups = kind === 'animals' ? animalGroups : [objects];
  objects = groups.flatMap((group, row) => group.map((object, column) => ({ ...object, unit: object.unit || 'scoops', row, column, columns: group.length })));
  return { prompt, equations, values, objects, kind, difficulty: rateDifficulty(numbers, Object.keys(values)), animal: true };

}
