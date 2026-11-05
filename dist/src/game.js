import { appleGridPosition } from './apple-layout.js';
import { faceCameraOnce, createSignTexture } from './signs.js';
import { createAmbientAnimals } from './animals.js';
import { normalizeProgress, finishDay } from './progress.js';
import * as THREE from '../vendor/three.module.js';
import { createAnimalPuzzle } from './animal-puzzles.js';
import { generateAdvancedPuzzle, generateAnimalPuzzle, generateRemainderPuzzle, valueRange } from './puzzles.js';
import { assessSystem } from './algebra.js';
import { assessAnswer } from './algebra.js';
import { playSound, setSoundEnabled } from './audio.js';
import { createFarmScenery } from './scenery.js';

const canvas = document.querySelector('#world');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#dce8d0');
const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 500);
const puzzleCameraPosition = new THREE.Vector3(4, 32.4, 25.4);
const puzzleCameraTarget = new THREE.Vector3(4, 0, -7);
const uncleCameraTarget = new THREE.Vector3(4, 4.2, -22.7);
// A level view of Fil leaves the distant forest, mountains, and sky in the opening frame.
const uncleCameraPosition = new THREE.Vector3(4, 4.4, -15);
let cameraIntroStart = 0;
let cameraIntroActive = false;
let promptIntro = null;
function finishPromptIntro() {
  if (!promptIntro) return;
  promptIntro.words.forEach(word => { word.style.visibility = 'visible'; });
  promptIntro = null;
  cameraIntroActive = false;
  camera.position.copy(puzzleCameraPosition); camera.lookAt(puzzleCameraTarget);
  document.body.classList.remove('camera-moving');
  document.querySelector('#question-intro').classList.remove('visible');
}
// Consume the skip click before it reaches any farm object or form control.
document.addEventListener('click', event => {
  if (!promptIntro) return;
  if (event.target.closest('#question-intro')) return;
  event.preventDefault(); event.stopImmediatePropagation();
  finishPromptIntro();
}, true);
let cameraReturnStart = 0;
let cameraReturnActive = false;
let cameraReturnFrom = new THREE.Vector3();
let cameraReturnTarget = new THREE.Vector3();
const farmBackground = new THREE.Color('#dce8d0');
camera.position.copy(puzzleCameraPosition);
camera.lookAt(puzzleCameraTarget);
scene.add(new THREE.HemisphereLight('#f7f8e7', '#776b48', 2.1));
const sun = new THREE.DirectionalLight('#fff0ce', 2.4);
sun.position.set(-24, 40, 18);
scene.add(sun);

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 1, ...extra });
const soil = mat('#88734c');
const grass = mat('#78915f');
const understoryMats = ['#718950', '#84965b', '#9a9b5b', '#627d4b'].map(mat);
const mulchMat = mat('#69563d');
const fruitMat = mat('#c75a3c');
const trunkMat = mat('#765238');
const leafMats = ['#486e42', '#587c49', '#698650'].map(mat);
const field = new THREE.Group();
scene.add(field);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), grass);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.08;
scene.add(ground);
const { sky: farmSky } = createFarmScenery(scene);

const fieldBase = new THREE.Mesh(new THREE.BoxGeometry(160, 0.35, 160), grass);
fieldBase.position.y = 0.02;
fieldBase.receiveShadow = true;
field.add(fieldBase);
// Irregular groundcover patches replace the uniform crop furrows.
let seed = 31;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const gardenPaths = [
  [[18,-18],[14,-13],[9,-8],[4,-3],[0,5],[-8,14],[-12,28],[-10,46],[-4,67]],
  [[-12,28],[-25,31],[-38,38],[-50,50],[-60,66]],
  [[0,5],[15,8],[30,12],[42,22],[53,37],[62,55]],
  [[0,5],[8,18],[11,34],[8,50],[5,68]]
];
function distanceToSegment(px, pz, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - a[0] - t * dx, pz - a[1] - t * dz);
}
function onPath(x, z, margin = 3) {
  return gardenPaths.some(path => path.slice(1).some((point, i) => distanceToSegment(x, z, path[i], point) < margin));
}
const coverGeometry = new THREE.IcosahedronGeometry(1, 0);
const cover = new THREE.InstancedMesh(coverGeometry, understoryMats[0], 1800);
const coverColors = understoryMats.map(material => material.color);
const dummyCover = new THREE.Object3D();
let coverIndex = 0;
for (let i = 0; i < 1800; i++) {
  const x = (rand() - .5) * 150;
  const z = (rand() - .5) * 150;
  if ((Math.abs(x) < 25 && z > -28 && z < 18) || onPath(x, z, 2.8)) continue;
  const size = .35 + rand() * .65;
  dummyCover.position.set(x, .25, z);
  dummyCover.scale.set(size * 1.5, size * .32, size);
  dummyCover.rotation.set(0, rand() * Math.PI, 0);
  dummyCover.updateMatrix();
  cover.setMatrixAt(coverIndex, dummyCover.matrix);
  cover.setColorAt(coverIndex++, coverColors[Math.floor(rand() * coverColors.length)]);
}
cover.count = coverIndex;
cover.instanceMatrix.needsUpdate = true;
field.add(cover);
const pathMaterial = mat('#b59a6a');
for (const points of gardenPaths) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, .22, z)));
  const segments = 100, halfWidth = 2.15, vertices = [], indices = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, center = curve.getPoint(t), tangent = curve.getTangent(t);
    const length = Math.hypot(tangent.x, tangent.z) || 1;
    const nx = -tangent.z / length, nz = tangent.x / length;
    vertices.push(center.x + nx * halfWidth, center.y, center.z + nz * halfWidth);
    vertices.push(center.x - nx * halfWidth, center.y, center.z - nz * halfWidth);
    if (i < segments) { const n = i * 2; indices.push(n,n+2,n+1,n+1,n+2,n+3); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const pathMesh = new THREE.Mesh(geometry, pathMaterial); pathMesh.receiveShadow = true; scene.add(pathMesh);
}

// A diverse tree belt frames the cultivated area.
const trunkGeo = new THREE.CylinderGeometry(.28, .42, 2.2, 7);
const crownGeo = new THREE.IcosahedronGeometry(1.55, 1);
for (let i = -18; i <= 18; i++) {
  for (const [x,z] of [[i*4.5,-88],[i*4.5,88],[-88,i*4.5],[88,i*4.5]]) {
    const tree = new THREE.Group();
    tree.position.set(x, 0, z);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.1;
    trunk.castShadow = true;
    tree.add(trunk);
    const crown = new THREE.Mesh(crownGeo, leafMats[Math.floor(rand()*leafMats.length)]);
    crown.position.set((rand()-.5)*.45, 2.7, (rand()-.5)*.45);
    crown.scale.set(.92+rand()*.24, .9+rand()*.35, .92+rand()*.24);
    crown.castShadow = true;
    tree.add(crown);
    scene.add(tree);
  }
}

// Mixed fruit trees and understory form widely spaced agroforestry alleys.
const orchardTrunk = new THREE.CylinderGeometry(.38, .62, 4.2, 7);
const orchardCanopy = new THREE.IcosahedronGeometry(2.35, 1);
const fruitGeometry = new THREE.SphereGeometry(.18, 7, 5);
for (const x of [-68, -48, -30, 32, 50, 68]) {
  for (let row = 0; row < 7; row++) {
    const z = -70 + row * 22 + (Math.abs(x) % 3) * 2;
    if (Math.abs(x) < 35 && z > -29 && z < 18) continue;
    if (Math.hypot(x - 18, z + 18) < 13 || onPath(x, z, 6)) continue;
    const tree = new THREE.Group();
    tree.position.set(x + (rand() - .5) * 3, 0, z + (rand() - .5) * 3);
    const trunk = new THREE.Mesh(orchardTrunk, trunkMat); trunk.position.y = 2.1; trunk.castShadow = true; tree.add(trunk);
    const canopy = new THREE.Mesh(orchardCanopy, leafMats[Math.floor(rand() * leafMats.length)]);
    canopy.position.set((rand() - .5) * .6, 4.6, (rand() - .5) * .6);
    canopy.scale.set(.9 + rand() * .3, .8 + rand() * .25, .9 + rand() * .3); canopy.castShadow = true; tree.add(canopy);
    for (let fruit = 0; fruit < 4; fruit++) {
      const angle = fruit * Math.PI / 2 + rand();
      const apple = new THREE.Mesh(fruitGeometry, fruitMat);
      apple.position.set(Math.cos(angle) * 1.7, 3.7 + rand() * 1.5, Math.sin(angle) * 1.7);
      tree.add(apple);
    }
    const mulch = new THREE.Mesh(new THREE.CircleGeometry(3.2, 16), mulchMat);
    mulch.rotation.x = -Math.PI / 2; mulch.position.y = .22; tree.add(mulch);
    for (let plant = 0; plant < 6; plant++) {
      const angle = plant / 6 * Math.PI * 2;
      const companion = new THREE.Mesh(coverGeometry, understoryMats[(plant + row) % understoryMats.length]);
      companion.position.set(Math.cos(angle) * 3.5, .42, Math.sin(angle) * 3.5);
      companion.scale.set(.75, .5, .8); tree.add(companion);
    }
    scene.add(tree);
  }
}

// A staggered layer of mixed secondary trees is GPU-instanced in a few batches.
const treeSpots = [];
for (let column = 0; column < 13; column++) for (let row = 0; row < 13; row++) {
  const x = -72 + column * 12;
  const z = -72 + row * 12 + (column % 2) * 5;
  if (Math.abs(x) < 30 && z > -30 && z < 20) continue;
  if (Math.hypot(x - 18, z + 18) < 14 || onPath(x, z, 6)) continue;
  treeSpots.push({ x: x + (rand() - .5) * 4, z: z + (rand() - .5) * 4, size: .75 + rand() * .65 });
}
const treeCapacity = treeSpots.length;
const secondaryTrunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.3, .52, 3.6, 6), trunkMat, treeCapacity);
const secondaryCrownGeometries = [new THREE.IcosahedronGeometry(1.8, 1), new THREE.SphereGeometry(1.55, 8, 6), new THREE.ConeGeometry(1.65, 3.6, 7)];
const secondaryCrowns = secondaryCrownGeometries.map(geometry => leafMats.map(material => new THREE.InstancedMesh(geometry, material, treeCapacity)));
const secondaryFruit = new THREE.InstancedMesh(new THREE.SphereGeometry(.16, 6, 4), fruitMat, treeCapacity * 3);
const treeDummy = new THREE.Object3D();
const crownCounts = secondaryCrownGeometries.map(() => leafMats.map(() => 0));
let secondaryFruitCount = 0;
let secondaryTrunkCount = 0;
for (const tree of treeSpots) {
  const type = Math.floor(rand() * secondaryCrownGeometries.length);
  const color = Math.floor(rand() * leafMats.length);
  const crownIndex = crownCounts[type][color]++;
  const scale = tree.size;
  treeDummy.position.set(tree.x, 1.8 * scale, tree.z); treeDummy.scale.set(scale, scale, scale); treeDummy.updateMatrix();
  secondaryTrunks.setMatrixAt(secondaryTrunkCount++, treeDummy.matrix);
  const crown = secondaryCrowns[type][color];
  treeDummy.position.set(tree.x, 3.8 * scale, tree.z);
  treeDummy.scale.set(scale * 1.8, scale * (type === 2 ? 2.2 : 1.7), scale * 1.8);
  treeDummy.rotation.set(0, rand() * Math.PI, 0); treeDummy.updateMatrix(); crown.setMatrixAt(crownIndex, treeDummy.matrix);
  for (let fruit = 0; fruit < 3; fruit++) {
    const angle = fruit / 3 * Math.PI * 2;
    treeDummy.position.set(tree.x + Math.cos(angle) * scale * 1.35, 3.5 * scale, tree.z + Math.sin(angle) * scale * 1.35);
    treeDummy.scale.setScalar(scale); treeDummy.updateMatrix(); secondaryFruit.setMatrixAt(secondaryFruitCount++, treeDummy.matrix);
  }
}
secondaryTrunks.count = secondaryTrunkCount; secondaryTrunks.instanceMatrix.needsUpdate = true;
secondaryFruit.count = secondaryFruitCount; secondaryFruit.instanceMatrix.needsUpdate = true;
scene.add(secondaryTrunks, secondaryFruit);
for (let type = 0; type < secondaryCrowns.length; type++) for (let color = 0; color < leafMats.length; color++) {
  const crown = secondaryCrowns[type][color];
  crown.count = crownCounts[type][color]; crown.instanceMatrix.needsUpdate = true; scene.add(crown);
}

// Low-poly produce is batched into a few instanced meshes and does not cast shadows.
// Scatter decorative produce over the visible field while reserving the puzzle area.
const produceCapacity = 84;
const produceDummy = new THREE.Object3D();
const berries = new THREE.InstancedMesh(new THREE.SphereGeometry(.62, 7, 5), mat('#d64d54'), produceCapacity);
const pumpkins = new THREE.InstancedMesh(new THREE.SphereGeometry(.95, 8, 6), mat('#e58b3a'), produceCapacity);
const carrots = new THREE.InstancedMesh(new THREE.ConeGeometry(.43, 1.8, 6), mat('#ed9d3e'), produceCapacity);
const carrotLeaves = new THREE.InstancedMesh(new THREE.ConeGeometry(.36, .9, 5), mat('#628b4e'), produceCapacity);
const produceCounts = [0, 0, 0];
const producePositions = [];
for (let attempt = 0; attempt < 1200 && producePositions.length < produceCapacity; attempt++) {
  const x = (rand() - .5) * 78;
  const z = -34 + rand() * 72;
  // Keep baskets, counting mats, and Uncle Fil unobstructed.
  if ((Math.abs(x) < 19 && z > -29 && z < 15) || Math.hypot(x - 4, z + 23) < 8 || onPath(x, z, 3)) continue;
  if (producePositions.some(point => Math.hypot(point.x - x, point.z - z) < 4.1)) continue;
  producePositions.push({ x, z });
}
for (const [positionIndex, { x, z }] of producePositions.entries()) {
  const type = positionIndex % 3;
  const index = produceCounts[type]++;
  produceDummy.position.set(x, type === 0 ? .6 : type === 1 ? .84 : .9, z);
  produceDummy.scale.set(type === 1 ? 1.2 : 1.15, type === 0 ? 1.1 : 1.05, type === 1 ? 1.2 : 1.15);
  produceDummy.rotation.set(type === 1 ? rand() * .15 : 0, rand() * Math.PI, type === 1 ? rand() * .15 : .16);
  produceDummy.updateMatrix();
  if (type === 0) berries.setMatrixAt(index, produceDummy.matrix);
  else if (type === 1) pumpkins.setMatrixAt(index, produceDummy.matrix);
  else {
    carrots.setMatrixAt(index, produceDummy.matrix);
    produceDummy.position.y = 2; produceDummy.scale.set(1, 1, 1);
    produceDummy.rotation.set(0, rand() * Math.PI, .18); produceDummy.updateMatrix();
    carrotLeaves.setMatrixAt(index, produceDummy.matrix);
  }
}
for (const [index, produce] of [berries, pumpkins, carrots, carrotLeaves].entries()) {
  produce.count = produceCounts[index === 3 ? 2 : index];
  produce.instanceMatrix.needsUpdate = true;
  scene.add(produce);
}

const $ = selector => document.querySelector(selector);
const interactive = [];
const baskets = [];
const tweens = [];
const puzzleVisuals = new THREE.Group();
scene.add(puzzleVisuals);
const puzzleGroupMaterial = new THREE.MeshBasicMaterial({ color: '#c9a65b' });
const puzzle = { basketCount: 3, applesPerBasket: 4, totalApples: 12 };
const puzzleTypes = [
  { id: 'share', prompt: p => `Share <strong>${p.totalApples} apples</strong> equally among ${p.basketCount} baskets. How many apples go in each basket? Let b be the number per basket.`, expected: p => ({ left: [p.basketCount, 0], right: [0, p.totalApples] }), answer: p => p.applesPerBasket, placeholder: () => 'Write an equation from the question', explain: p => `Let b mean apples in one basket. Then ${p.basketCount}b = ${p.totalApples}, so b = ${p.totalApples} ÷ ${p.basketCount} = ${p.applesPerBasket}.` },
  { id: 'total', prompt: p => `There are ${p.basketCount} baskets with <strong>${p.applesPerBasket} apples in each</strong>. How many apples are there altogether? Let a be the total.`, expected: p => ({ left: [0, p.basketCount * p.applesPerBasket], right: [1, 0] }), answer: p => p.totalApples, placeholder: () => 'Write an equation from the question', explain: p => `Let a mean the total. ${p.basketCount} groups of ${p.applesPerBasket} make a = ${p.basketCount} × ${p.applesPerBasket} = ${p.totalApples}.` },
  { id: 'groups', prompt: p => `I picked <strong>${p.totalApples} apples</strong>. I put exactly ${p.groupSize} apples in each basket. How many baskets do I need? Let n be the number of baskets.`, expected: p => ({ left: [p.groupSize, 0], right: [0, p.totalApples] }), answer: p => p.totalApples / p.groupSize, placeholder: () => 'Write an equation from the question', explain: p => `Let n mean the number of baskets. ${p.groupSize} apples in each gives ${p.groupSize}n = ${p.totalApples}, so n = ${p.totalApples} ÷ ${p.groupSize} = ${p.totalApples / p.groupSize}.` },
  { id: 'leftover', prompt: p => `I have <strong>${p.totalApples} apples</strong>. I set 2 aside, then put the rest equally into ${p.basketCount} baskets. How many apples go in each basket? Let b be that number.`, expected: p => ({ left: [p.basketCount, 2], right: [0, p.totalApples] }), answer: p => p.applesPerBasket, placeholder: () => 'Write an equation from the question', explain: p => `Let b mean apples in one basket. ${p.basketCount} equal baskets and 2 extra make ${p.basketCount}b + 2 = ${p.totalApples}, so b = (${p.totalApples} − 2) ÷ ${p.basketCount} = ${p.applesPerBasket}.` },
  { id: 'remainder', prompt: p => `I have <strong>${p.totalApples} apples</strong>. I put <strong>${p.applesPerBasket} apples in each of ${p.basketCount} baskets</strong>. How many apples remain unpacked? Let r be that number.`, expected: p => ({ left: [1, p.basketCount * p.applesPerBasket], right: [0, p.totalApples] }), answer: p => p.totalApples - p.basketCount * p.applesPerBasket, placeholder: () => 'Write an equation from the question', explain: p => `Let r mean the leftover apples. Then ${p.basketCount} × ${p.applesPerBasket} + r = ${p.totalApples}, so r = ${p.totalApples} − ${p.basketCount * p.applesPerBasket} = ${p.totalApples - p.basketCount * p.applesPerBasket}.` },
  { id: 'compare', prompt: p => `One basket has <strong>3 more apples</strong> than another. Together they have ${p.totalApples} apples. How many apples are in the smaller basket? Let x be that number.`, expected: p => ({ left: [2, 3], right: [0, p.totalApples] }), answer: p => (p.totalApples - 3) / 2, placeholder: () => 'Write an equation from the question', explain: p => `Let x be the smaller amount. Then x + (x + 3) = ${p.totalApples}, so x = ${(p.totalApples - 3) / 2}.` }
];
let dayProgress;
try { dayProgress = normalizeProgress(JSON.parse(localStorage.getItem('algabro-days') || '{}')); }
catch { dayProgress = normalizeProgress(); }
function updateIntroCalendar() {
  const day = Math.max(1, dayProgress.day);
  $('#intro-calendar-day').textContent = day;
  $('#intro-calendar-day').setAttribute('font-size', day < 100 ? '52' : day < 10000 ? '36' : '24');
  if (day >= 10000) $('#intro-calendar-day').setAttribute('textLength', '98');
  else $('#intro-calendar-day').removeAttribute('textLength');
  $('#intro-calendar-day').setAttribute('lengthAdjust', 'spacingAndGlyphs');
  $('#intro-calendar').setAttribute('aria-label', `Day ${day}`);
}
updateIntroCalendar();
let dayFinished = false;
function saveProgress() {
  updateIntroCalendar();
  try { localStorage.setItem('algabro-days', JSON.stringify(dayProgress)); } catch { /* Play continues when storage is unavailable. */ }
}
let basketSpot = null;
let animalPuzzleObjects = null;
let advancedPuzzle = null;
let packingScene = null;
let currentPuzzleType = puzzleTypes[0];
const isDistributing = () => ['share', 'groups', 'leftover', 'remainder'].includes(currentPuzzleType.id);
let availableBaskets = 3;
let matchedPairs = 0;
let comparisonApple = null;
let selectedApple = null;
let shareApples = [];
function selectShareApple(apple) {
  playSound('select');
  if (selectedApple) {
    selectedApple.userData.highlight.visible = false;
    const restY = selectedApple.userData.selectionRestY;
    if (restY !== undefined) animate(selectedApple, [selectedApple.position.x, restY, selectedApple.position.z]);
  }
  selectedApple = selectedApple === apple ? null : apple;
  if (selectedApple) {
    selectedApple.userData.highlight.visible = true;
    selectedApple.userData.selectionRestY ??= selectedApple.position.y;
    animate(selectedApple, [selectedApple.position.x, selectedApple.userData.selectionRestY + 1.2, selectedApple.position.z]);
  }
  updateControls();
}
function canPlaceApple(destination) {
  if (!selectedApple || selectedApple.userData.shareBasket === destination) return false;
  if (destination === null) return true;
  if (destination === 'leftover') {
    return currentPuzzleType.id === 'leftover'
      && shareApples.filter(apple => apple.userData.shareBasket === 'leftover').length < 2;
  }
  if (destination >= availableBaskets) return false;
  const capacity = currentPuzzleType.id === 'groups' ? puzzle.groupSize : currentPuzzleType.id === 'remainder' ? puzzle.applesPerBasket : Infinity;
  return baskets[destination].activeApples.length < capacity;
}
function placeShareApple(destination, requestedQuantity = 1) {
  if (!canPlaceApple(destination)) return;
  const source = selectedApple.userData.shareBasket;
  const quantity = currentPuzzleType.id === 'groups' && source === null && typeof destination === 'number' ? requestedQuantity : 1;
  const capacity = destination === null ? Infinity
    : destination === 'leftover' ? 2 - shareApples.filter(apple => apple.userData.shareBasket === 'leftover').length
      : currentPuzzleType.id === 'groups' ? puzzle.groupSize - baskets[destination].activeApples.length
        : currentPuzzleType.id === 'remainder' ? puzzle.applesPerBasket - baskets[destination].activeApples.length : Infinity;
  const moving = [selectedApple, ...shareApples.filter(apple => apple !== selectedApple && apple.userData.shareBasket === source)].slice(0, Math.min(quantity, capacity));
  moving.forEach(apple => { apple.userData.shareBasket = destination; });
  selectedApple.userData.highlight.visible = false;
  selectedApple = null;
  layoutShareApples();
  playSound('repack');
  updateControls();
}
function layoutShareApples() {
  const loose = shareApples.filter(apple => apple.userData.shareBasket === null);
  const leftovers = shareApples.filter(apple => apple.userData.shareBasket === 'leftover');
  for (const basket of baskets) basket.activeApples = [];
  shareApples.forEach(apple => {
    const destination = apple.userData.shareBasket;
    const items = destination === null ? loose : destination === 'leftover' ? leftovers : baskets[destination].activeApples;
    if (typeof destination === 'number') items.push(apple);
    const i = typeof destination === 'number' ? items.length - 1 : items.indexOf(apple);
    scene.attach(apple);
    animate(apple, destination === null
      ? appleGridPosition(i, { width: 13, depth: 7, radius: .7, centerZ: -8, baseY: 1.15 })
      : destination === 'leftover' ? [10 + (i % 3) * 1.6, .85, -11 + Math.floor(i / 3) * 1.6]
      : [baskets[destination].x + (i % 3 - 1) * 1.35, 2.5 + Math.floor(i / 9) * 1.4, baskets[destination].z - 1 + Math.floor(i % 9 / 3) * 1.35]);
    apple.userData.hitTarget.scale.setScalar(.48);
  });
}
function showPuzzleArrangement() {
  if (basketSpot) {
    const index = interactive.indexOf(basketSpot); if (index >= 0) interactive.splice(index, 1);
    basketSpot = null;
  }
  if (animalPuzzleObjects) {
    animalPuzzleObjects.targets.forEach(target => { const index = interactive.indexOf(target); if (index >= 0) interactive.splice(index, 1); });
    animalPuzzleObjects = null;
  }
  selectedApple = null;
  packingScene = null;
  selected = null;
  matchedPairs = 0;
  comparisonApple = null;
  availableBaskets = currentPuzzleType.id === 'groups' ? 0 : currentPuzzleType.id === 'compare' ? 2 : puzzle.basketCount;
  shareApples = [];
  tweens.length = 0;
  for (let i = interactive.length - 1; i >= 0; i--) {
    if (interactive[i].userData.shareTray || interactive[i].userData.packingApple) interactive.splice(i, 1);
  }
  puzzleVisuals.clear();
  baskets.forEach((basket, index) => {
    const slots = currentPuzzleType.id === 'groups' ? puzzle.basketCount : currentPuzzleType.id === 'compare' ? 2 : puzzle.basketCount;
    const columns = Math.min(slots, 3);
    const row = Math.floor(index / columns);
    const rowSize = Math.min(columns, slots - row * columns);
    basket.x = (index % columns - (rowSize - 1) / 2) * 6.5;
    basket.z = (isDistributing() ? 8 : -8) + row * 7;
    if (!advancedPuzzle && currentPuzzleType.id === 'share') {
      // A single row keeps every destination visible beside the answer panel.
      basket.x = -2 + (index - (slots - 1) / 2) * 4.8;
      basket.z = 2;
    }
    basket.matMesh.position.z = basket.z + 12;
    basket.matEdge.position.z = basket.z + 12;
    basket.dropCue.position.z = basket.z + 12;
    basket.matMesh.position.x = basket.x; basket.matEdge.position.x = basket.x; basket.dropCue.position.x = basket.x;
    basket.container.visible = index < availableBaskets;
    basket.dumped = false; basket.count = 0;
    basket.container.position.set(basket.x, 1, basket.z);
    basket.container.rotation.z = 0;
    basket.liftAt = 0;
    basket.matMesh.visible = !isDistributing() && basket.container.visible;
    basket.matEdge.visible = !isDistributing() && basket.container.visible;
  });
  const requiredApples = advancedPuzzle ? 0 : puzzle.totalApples;
  const sourceBasket = baskets[0];
  while (baskets.reduce((sum, basket) => sum + basket.apples.length, 0) < requiredApples) {
    sourceBasket.apples.push(sourceBasket.createApple(sourceBasket.apples.length));
  }
  const apples = baskets.flatMap(basket => basket.apples);
  for (const basket of baskets) basket.activeApples = [];
  for (const apple of apples) {
    const tweenIndex = tweens.findIndex(tween => tween.object === apple);
    if (tweenIndex >= 0) tweens.splice(tweenIndex, 1);
    apple.userData.highlight.visible = false;
    apple.userData.hitTarget.scale.setScalar(1);
    apple.visible = false;
    apple.userData.hitTarget.visible = false;
    const hitIndex = interactive.indexOf(apple.userData.hitTarget);
    if (hitIndex >= 0) interactive.splice(hitIndex, 1);
  }
  if (advancedPuzzle?.animal) {
    baskets.forEach(basket => { basket.container.visible = false; basket.matMesh.visible = false; basket.matEdge.visible = false; });
    animalPuzzleObjects = createAnimalPuzzle(puzzleVisuals, advancedPuzzle, (proposed, event) => {
      Object.entries(proposed).forEach(([variable, value]) => { const input = $(`#system-value-${variable}`); if (input) input.value = value; });
      if (event) playSound(event.type === 'short' ? 'retry'
        : ['sale', 'purchase'].includes(event.type) ? 'trade'
          : event.type === 'feed-clear' ? 'dump' : 'count');
      if (event?.type === 'feed-sharing') {
        showFilMessage(`There are ${event.remaining} scoops of feed left.`);
        reactFil();
      } else if (event?.type === 'feed') {
        showFilMessage(event.portions.map(({ species, value }) =>
          `Each ${species} has ${value} ${value === 1 ? 'scoop' : 'scoops'}.`).join(' '));
        reactFil();
      } else if (event?.type === 'feed-clear') {
        const species = [...new Set(advancedPuzzle.objects.map(object => object.species))];
        showFilMessage(`All plates cleared. ${species.map(kind => `Each ${kind} has 0 scoops.`).join(' ')}`);
        reactFil();
      } else if (event?.type === 'feed-tally') {
        showFilMessage(event.message);
        reactFil();
      } else if (event?.type === 'feed-supply') {
        showFilMessage(`Tap a plate to add ${event.amount} ${event.amount === 1 ? 'scoop' : 'scoops'} to each animal of that kind.`);
      }
      if (advancedPuzzle.kind === 'trade') {
        if (event.type === 'sale') {
          const earnings = proposed.n * advancedPuzzle.objects[0].price;
          showFilMessage(`${proposed.n} ${proposed.n === 1 ? 'apple' : 'apples'} sold for $${earnings.toFixed(2)}`);
        } else if (event.type === 'balance') showFilMessage(`You have $${event.balance.toFixed(2)}`);
        else if (event.type === 'short') showFilMessage('Not enough money for the feed yet.');
        else if (event.type === 'purchase') showFilMessage('Feed bought!');
        else if (event.type === 'already-purchased') showFilMessage('Feed already bought');
      }
    }, target => interactive.push(target), target => { const index = interactive.indexOf(target); if (index >= 0) interactive.splice(index, 1); }, puzzleCameraPosition);
    interactive.push(...animalPuzzleObjects.targets);
    return;
  }
  if (advancedPuzzle) {
    const colors = ['#bd5949', advancedPuzzle.commerce || Object.keys(advancedPuzzle.values).length === 3 ? '#668951' : '#6389b5', '#d0af45'];
    if (advancedPuzzle.commerceAppleQuantity) {
      baskets.forEach(basket => { basket.container.visible = false; });
      const quantity = advancedPuzzle.commerceAppleQuantity;
      mesh(new THREE.BoxGeometry(14, .3, 10), mat('#e8d8ad'), 4, .3, -8, puzzleVisuals);
      const saleTotal = { count: 0 };
      const coinPile = new THREE.Group(); coinPile.position.set(14, .5, -8); puzzleVisuals.add(coinPile);
      const updateSaleCounter = () => {
        coinPile.clear();
        const cents = Math.round(saleTotal.count * advancedPuzzle.values.p * 100);
        for (let coin = 0; coin < cents; coin++) {
          const x = (coin % 5 - 2) * .32;
          const z = (Math.floor(coin / 5) % 5 - 2) * .32;
          const y = Math.floor(coin / 25) * .12;
          mesh(new THREE.CylinderGeometry(.18, .18, .09, 12), mat('#d7ad45'), x, y, z, coinPile);
        }
        showFilMessage(`${saleTotal.count} ${saleTotal.count === 1 ? 'apple' : 'apples'} sold · $${(cents / 100).toFixed(2)}`);
      };
      for (let index = 0; index < quantity; index++) {
        const position = appleGridPosition(index, { width: 14, depth: 10, radius: .56, centerX: 4, centerZ: -8, baseY: 1.1 });
        const apple = mesh(appleGeo, appleMat, ...position, puzzleVisuals);
        apple.scale.setScalar(.8);
        apple.userData.sold = false;
        const target = mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ visible: false }), ...position, puzzleVisuals);
        target.userData.action = () => {
          if (apple.userData.sold) return;
          apple.userData.sold = true;
          apple.visible = false;
          saleTotal.count++;
          updateSaleCounter();
        };
        interactive.push(target);
      }
      return;
    }
    if (advancedPuzzle.basketQuantity) {
      createPackingScene(advancedPuzzle);
      return;
    }
    const variables = Object.keys(advancedPuzzle.values);
    if (advancedPuzzle.commerce) {
      baskets.forEach(basket => {
        basket.container.visible = false;
        basket.matMesh.visible = false;
        basket.matEdge.visible = false;
        basket.dropCue.visible = false;
      });
      createSaleBundles(advancedPuzzle.saleBundles);
      return;
    }
    createColoredBasketScene(variables, colors);
    return;
  }
  let groups;
  if (isDistributing()) {
    groups = [{ count: puzzle.totalApples, owner: 0, x: 0, z: 8, loose: true }];
  } else if (currentPuzzleType.id === 'total') {
    groups = Array.from({ length: puzzle.basketCount }, (_, i) => ({ count: puzzle.applesPerBasket, owner: i, basket: i }));
  } else {
    const smaller = (puzzle.totalApples - 3) / 2;
    groups = [{ count: smaller, owner: 0, basket: 0 }, { count: smaller + 3, owner: 1, basket: 1 }];
  }
  let appleIndex = 0;
  for (const group of groups) {
    if (group.ring) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.45, .08, 5, 24), puzzleGroupMaterial);
      ring.rotation.x = Math.PI / 2; ring.position.set(group.x, .16, group.z); puzzleVisuals.add(ring);
    }
    for (let i = 0; i < group.count; i++) {
      const apple = apples[appleIndex++];
      const owner = baskets[group.owner];
      apple.userData.ownerIndex = group.owner;
      apple.userData.counted = false;
      apple.material = appleMat;
      apple.userData.hitTarget.userData.action = () => countApple(apple.userData.ownerIndex, apple);
      owner.activeApples.push(apple);
      if (group.basket !== undefined) {
        const basket = baskets[group.basket];
        basket.container.attach(apple);
        apple.position.set((i % 4 - 1.5) * .58, 1.15 + Math.floor(i / 4) * .58, (i % 2 ? .48 : -.48));
      } else {
        puzzleVisuals.add(apple);
        const col = i % 4, row = Math.floor(i / 4);
        apple.position.set(group.x + (col - Math.min(group.count, 4) / 2 + .5) * .9, .62, group.z + row * .95);
      }
      apple.visible = true;
      apple.userData.hitTarget.visible = true;
      if (!interactive.includes(apple.userData.hitTarget)) interactive.push(apple.userData.hitTarget);
    }
  }
  if (isDistributing()) {
    shareApples = apples.slice(0, puzzle.totalApples);
    shareApples.forEach(apple => {
      apple.userData.shareBasket = null;
      apple.userData.hitTarget.userData.action = () => selectShareApple(apple);
    });
    const tray = mesh(new THREE.BoxGeometry(13, .2, 7), mat('#e8d8ad'), 0, .35, -8, puzzleVisuals);
    tray.userData.action = () => placeShareApple(null);
    interactive.push(tray);
    tray.userData.shareTray = true;
    if (currentPuzzleType.id === 'leftover') {
      const area = mesh(new THREE.BoxGeometry(6, .2, 7), mat('#d9c2df'), 11, .35, -8, puzzleVisuals);
      area.userData.shareTray = true;
      area.userData.destination = 'leftover';
      area.userData.action = () => placeShareApple('leftover');
      interactive.push(area);
      for (let i = 0; i < 2; i++) {
        const slot = new THREE.Mesh(new THREE.TorusGeometry(.8, .045, 5, 24), puzzleGroupMaterial);
        slot.rotation.x = Math.PI / 2;
        slot.position.set(10 + i * 1.6, .48, -11);
        puzzleVisuals.add(slot);
      }
    }
    if (currentPuzzleType.id === 'groups') {
      basketSpot = mesh(new THREE.CylinderGeometry(2.6, 2.6, .15, 24), new THREE.MeshStandardMaterial({ color: '#f3c94f', transparent: true, opacity: .4 }), baskets[0].x, .3, 8, puzzleVisuals);
      basketSpot.userData.action = () => {
        if (availableBaskets >= puzzle.basketCount) return;
        baskets[availableBaskets++].container.visible = true;
        if (availableBaskets < puzzle.basketCount) basketSpot.position.set(baskets[availableBaskets].x, .3, baskets[availableBaskets].z);
        updateControls();
      };
      interactive.push(basketSpot);
    }
    layoutShareApples();
  }
}
function createColoredBasketScene(variables, colors) {
  baskets.forEach(basket => {
    basket.container.visible = false;
    basket.matMesh.visible = false;
    basket.matEdge.visible = false;
    basket.dropCue.visible = false;
  });
  const names = { r: 'red', b: 'blue', g: 'green', y: 'yellow' };
  const bag = new THREE.Group(); bag.position.set(-13, 0, 5); puzzleVisuals.add(bag);
  const sack = mesh(new THREE.SphereGeometry(2.8, 20, 14), mat('#ba9362'), 0, 2.1, 0, bag);
  sack.scale.set(1, .95, .8);
  for (let i = 0; i < 7; i++) mesh(appleGeo, appleMat, Math.cos(i * 2.4) * 1.2, 4 + (i % 2) * .35, Math.sin(i * 2.4), bag);
  const total = advancedPuzzle.basketClues.flatMap(clue => Object.values(clue.counts)).reduce((sum, count) => sum + count, 0)
    * Math.max(...Object.values(advancedPuzzle.values));
  const readyApple = mesh(appleGeo, appleMat, 0, 4, 0, bag); readyApple.visible = false;
  let holdingApple = false, refilling = false, remaining = total;
  const groups = [];
  const report = () => {
    const clue = groups[activeRow];
    const totals = Object.fromEntries(variables.map(variable => [variable, clue.baskets[variable].reduce((sum, basket) => sum + basket.apples.length, 0)]));
    const colourCounts = variables.filter(variable => clue.baskets[variable].length > 0)
      .map(variable => `${totals[variable]} in ${names[variable]}`);
    showFilMessage(`${colourCounts.join(' and ')} baskets`);
    variables.forEach(variable => {
      const basket = groups.flatMap(group => group.baskets[variable])[0];
      const input = $(`#system-value-${variable}`);
      if (input) input.value = String(basket?.apples.length ?? 0);
    });
  };
  let activeRow = 0;
  const register = (object, action) => { object.userData.shareTray = true; object.userData.action = action; interactive.push(object); };
  const refill = () => {
    if (refilling || !remaining) return;
    refilling = true;
    readyApple.position.set(0, 4, 0); readyApple.visible = true;
    animate(readyApple, [0, 7.5, 0], 0, () => {
      holdingApple = true; refilling = false;
    }, 360);
  };
  const bagTarget = mesh(new THREE.SphereGeometry(3.5, 12, 8), new THREE.MeshBasicMaterial({ visible: false }), 0, 2.5, 0, bag);
  register(bagTarget, () => { if (holdingApple) { holdingApple = false; readyApple.visible = false; readyApple.position.set(0, 4, 0); remaining++; showFilMessage('Apple returned to the bag.'); } else refill(); });
  advancedPuzzle.basketClues.forEach((clue, row) => {
    const root = new THREE.Group(); root.position.set(3, 0, -18 + row * 8); puzzleVisuals.add(root);
    const rowState = { baskets: {} }; groups.push(rowState);
    const basketGap = 2.35;
    const basketCount = variables.reduce((sum, variable) => sum + clue.counts[variable], 0);
    let basketIndex = 0;
    for (const variable of variables) {
      rowState.baskets[variable] = [];
      for (let i = 0; i < clue.counts[variable]; i++) {
        const basketRoot = new THREE.Group();
        basketRoot.position.set((basketIndex++ - (basketCount - 1) / 2) * basketGap, 0, 0); root.add(basketRoot);
        const color = colors[variables.indexOf(variable)];
        mesh(new THREE.CylinderGeometry(.98, .86, .3, 16), mat(color), 0, .3, 0, basketRoot);
        mesh(new THREE.CylinderGeometry(.98, .86, 1, 16, 1, true), new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 1 }), 0, .9, 0, basketRoot);
        const fruit = new THREE.Group(); basketRoot.add(fruit);
        const hit = mesh(new THREE.CylinderGeometry(1.08, 1.08, 2.8, 12), new THREE.MeshBasicMaterial({ visible: false }), 0, 1.2, 0, basketRoot);
        const basket = { fruit, variable, hit, apples: [] }; rowState.baskets[variable].push(basket);
        register(hit, () => {
          activeRow = row;
          if (!holdingApple || !remaining) { report(); return; }
          const matching = groups.flatMap(group => group.baskets[variable]);
          if (remaining < matching.length) { showFilMessage('There are not enough apples for every basket.'); return; }
          holdingApple = false; readyApple.visible = false; remaining -= matching.length;
          matching.forEach(targetBasket => {
            const targetFruit = targetBasket.fruit;
            const apple = mesh(appleGeo, appleMat, 0, 2.5, 0, targetFruit); apple.scale.setScalar(.5);
            apple.position.copy(targetFruit.worldToLocal(bag.localToWorld(new THREE.Vector3(0, 7.5, 0))));
            targetBasket.apples.push(apple);
            animate(apple, [0, 2.5 + (targetBasket.apples.length - 1) * .55, 0]);
            register(apple, () => { apple.removeFromParent(); targetBasket.apples.pop(); remaining += matching.length; report(); });
          });
          refill(); report();
        });
      }
    }
    const rowHit = mesh(new THREE.BoxGeometry(17, .15, 5), new THREE.MeshBasicMaterial({ visible: false }), 0, .2, 0, root);
    register(rowHit, () => { activeRow = row; report(); });
  });
  // Clear broom returns every placed apple to the shared supply.
  const broom = new THREE.Group(); broom.position.set(14, .5, 7); puzzleVisuals.add(broom);
  mesh(new THREE.BoxGeometry(.25, 3, .25), trunkMat, 0, 1.5, 0, broom);
  mesh(new THREE.BoxGeometry(2, .35, .8), mat('#d7b975'), 0, .2, 0, broom);
  const broomHit = mesh(new THREE.BoxGeometry(3, 3.5, 2), new THREE.MeshBasicMaterial({ visible: false }), 0, 1.5, 0, broom);
  const returnAllApples = () => {
    groups.forEach(group => Object.values(group.baskets).flat().forEach(basket => {
      basket.apples.forEach(apple => apple.removeFromParent());
      basket.apples.length = 0;
    }));
    remaining = total; holdingApple = false; readyApple.visible = false;
    report();
    showFilMessage('All apples returned. Try again.');
  };
  register(broomHit, returnAllApples);
  // A wooden sign beside the broom explains its action within the farm scene.
  mesh(new THREE.BoxGeometry(.35, 4, .35), trunkMat, 2, 2, 0, broom);
  const sign = new THREE.Group(); sign.position.set(2, 4, 0); broom.add(sign);
  faceCameraOnce(sign, puzzleCameraPosition);
  const board = mesh(new THREE.BoxGeometry(8, 1.9, .25), trunkMat, 0, 0, 0, sign);
  const caption = mesh(new THREE.PlaneGeometry(7.6, 1.5), new THREE.MeshBasicMaterial({
    map: createSignTexture('Return all apples', { aspect: 7.6 / 1.5 })
  }), 0, 0, .14, sign);
  register(board, returnAllApples);
  register(caption, returnAllApples);
}

function createPackingScene(question) {
  baskets.forEach(basket => {
    basket.container.visible = false;
    basket.matMesh.visible = false;
    basket.matEdge.visible = false;
    basket.dropCue.visible = false;
  });
  const source = { x: -15, z: 8, radius: 5.2, apples: [] };
  const destinations = Array.from({ length: question.basketQuantity }, (_, index) => {
    const row = Math.floor(index / 3);
    const columns = Math.min(3, question.basketQuantity - row * 3);
    return { x: 5 + (index % 3 - (columns - 1) / 2) * 6.3, z: -15 + row * 6.5, apples: [] };
  });
  packingScene = { source, destinations, selected: null };
  function basket(group, large = false) {
    const radius = large ? 5.2 : 2.2;
    const base = mesh(new THREE.CylinderGeometry(radius, radius * .86, .45, 32), wicker, group.x, .7, group.z, puzzleVisuals);
    base.receiveShadow = true;
    mesh(new THREE.CylinderGeometry(radius, radius * .86, 1.55, 32, 1, true),
      new THREE.MeshStandardMaterial({ color: '#ad7b45', roughness: 1, side: THREE.DoubleSide }), group.x, 1.6, group.z, puzzleVisuals);
    const rim = mesh(new THREE.TorusGeometry(radius, .18, 6, 32), darkWicker, group.x, 2.35, group.z, puzzleVisuals);
    rim.rotation.x = Math.PI / 2;
    const target = mesh(new THREE.CylinderGeometry(radius * .95, radius * .95, .25, 24),
      new THREE.MeshBasicMaterial({ visible: false }), group.x, 2.45, group.z, puzzleVisuals);
    target.userData.packingBasket = group;
    target.userData.shareTray = true;
    interactive.push(target);
  }
  basket(source, true);
  destinations.forEach(group => basket(group));
  for (const group of [source, ...destinations]) {
    group.sign = label('', 2.8);
    group.sign.position.set(group.x, 4, group.z); puzzleVisuals.add(group.sign);
    faceCameraOnce(group.sign, puzzleCameraPosition);
  }
  const total = question.basketQuantity * question.values.a + question.leftoverApples;
  for (let index = 0; index < total; index++) {
    const apple = mesh(appleGeo, appleMat, 0, 0, 0, puzzleVisuals);
    apple.scale.setScalar(.38);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, .13, 5, 20),
      new THREE.MeshBasicMaterial({ color: '#f6d76b', transparent: true, opacity: .95 }));
    ring.rotation.x = Math.PI / 2;
    ring.visible = false;
    apple.add(ring);
    const target = mesh(new THREE.SphereGeometry(1.2, 8, 6),
      new THREE.MeshBasicMaterial({ visible: false }), 0, 0, 0, apple);
    target.userData.packingApple = apple;
    target.userData.highlight = ring;
    apple.userData.highlight = ring;
    apple.userData.group = source;
    source.apples.push(apple);
    interactive.push(target);
  }
  layoutPackingScene(true);
}
function layoutPackingScene(immediate = false) {
  if (!packingScene) return;
  const { source, destinations } = packingScene;
  source.sign.userData.setText(`Unpacked: ${source.apples.length}`);
  destinations.forEach(group => group.sign.userData.setText(`${group.apples.length} apples`));
  const sourceSlots = [];
  for (let z = -7; z <= 7; z++) for (let x = -7; x <= 7; x++) {
    if (x * x + z * z <= 53) sourceSlots.push([x * .62, z * .62]);
  }
  source.apples.forEach((apple, index) => {
    const [x, z] = sourceSlots[index % sourceSlots.length];
    const layer = Math.floor(index / sourceSlots.length);
    const position = [source.x + x, 2.55 + layer * .52, source.z + z];
    if (immediate) apple.position.set(...position);
    else animate(apple, position);
  });
  destinations.forEach(group => group.apples.forEach((apple, index) => {
    const col = index % 5;
    const row = Math.floor(index / 5) % 5;
    const layer = Math.floor(index / 25);
    const position = [group.x + (col - 2) * .7, 2.55 + layer * .52, group.z + (row - 2) * .7];
    if (immediate) apple.position.set(...position);
    else animate(apple, position);
  }));
}
function packingHit(hit) {
  if (!packingScene) return false;
  const apple = hit?.object.userData.packingApple;
  const group = hit?.object.userData.packingBasket;
  if (apple) {
    playSound('select');
    reactFil();
    if (packingScene.selected) packingScene.selected.userData.highlight.visible = false;
    packingScene.selected = packingScene.selected === apple ? null : apple;
    if (packingScene.selected) packingScene.selected.userData.highlight.visible = true;
    showFilMessage(`${apple.userData.group.apples.length} apples`);
    return true;
  }
  if (!group) return false;
  reactFil();
  if (!packingScene.selected && group !== packingScene.source && packingScene.source.apples.length) {
    packingScene.selected = packingScene.source.apples.at(-1);
  }
  if (packingScene.selected && packingScene.selected.userData.group !== group) {
    const selected = packingScene.selected;
    const oldGroup = selected.userData.group;
    oldGroup.apples.splice(oldGroup.apples.indexOf(selected), 1);
    group.apples.push(selected);
    selected.userData.group = group;
    selected.userData.highlight.visible = false;
    packingScene.selected = null;
    layoutPackingScene();
    playSound('repack');
  }
  showFilMessage(`${group.apples.length} apples`);
  return true;
}
let selected = null;
function mesh(geometry, material, x, y, z, parent = scene) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(x, y, z);
  parent.add(object);
  return object;
}
function label(text, width = 9, color = '#344d41') {
  const measure = document.createElement('canvas').getContext('2d');
  const height = width * .36;
  const dimensions = value => {
    measure.font = 'bold 100px sans-serif';
    return { height, width: height * (measure.measureText(value).width + 32) / 128,
      aspect: (measure.measureText(value).width + 32) / 128 };
  };
  let size = dimensions(text);
  let texture = createSignTexture(text, { background: '#fff7e5', color, aspect: size.aspect });
  const sprite = new THREE.Mesh(new THREE.PlaneGeometry(size.width, size.height), new THREE.MeshStandardMaterial({ map: texture, roughness: 1 }));
  const backing = new THREE.Mesh(new THREE.BoxGeometry(size.width + .12, size.height + .12, .16), mat('#875c36'));
  backing.position.z = -.1;
  sprite.add(backing);
  sprite.userData.setText = value => {
    const previous = texture;
    size = dimensions(value);
    texture = createSignTexture(value, { background: '#fff7e5', color, aspect: size.aspect });
    sprite.material.map = texture;
    sprite.geometry.dispose(); backing.geometry.dispose();
    sprite.geometry = new THREE.PlaneGeometry(size.width, size.height);
    backing.geometry = new THREE.BoxGeometry(size.width + .12, size.height + .12, .16);
    previous.dispose();
  };
  return sprite;
}
function speechBubble(text, width = 12) {
  const surface = document.createElement('canvas'); surface.width = 512; surface.height = 160;
  const ctx = surface.getContext('2d');
  let texture = new THREE.CanvasTexture(surface); texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(width, width * .32, 1); sprite.renderOrder = 5;
  sprite.userData.setText = value => {
    const font = 'bold 38px sans-serif';
    ctx.font = font;
    const lines = [];
    let line = '';
    for (const word of String(value).split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > 440) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
    const bodyWidth = Math.max(160, Math.ceil(Math.max(...lines.map(item => ctx.measureText(item).width))) + 56);
    const bodyHeight = lines.length * 48 + 32;
    surface.width = bodyWidth + 24;
    surface.height = bodyHeight + 40;
    sprite.userData.bubbleAspect = surface.width / surface.height;
    sprite.userData.bubbleHeight = surface.height;
    sprite.scale.set(width, width / sprite.userData.bubbleAspect, 1);
    ctx.clearRect(0, 0, surface.width, surface.height);
    ctx.font = font;
    ctx.fillStyle = '#fff7e5'; ctx.strokeStyle = '#8c7444'; ctx.lineWidth = 5;
    const center = surface.width / 2;
    ctx.beginPath();
    ctx.moveTo(center - 22, bodyHeight);
    ctx.lineTo(center, surface.height - 5);
    ctx.lineTo(center + 22, bodyHeight);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(12, 8, bodyWidth, bodyHeight, 24); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#344d41'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach((item, index) => ctx.fillText(item, center, 48 + index * 48));
    // Resized canvas textures need fresh GPU storage, including mipmaps.
    const previousTexture = texture;
    texture = new THREE.CanvasTexture(surface);
    texture.colorSpace = THREE.SRGBColorSpace;
    sprite.material.map = texture;
    sprite.material.needsUpdate = true;
    previousTexture.dispose();
  };
  sprite.userData.setText(text);
  return sprite;
}
const wicker = mat('#b5854d');
const darkWicker = mat('#80562f');
const appleMat = mat('#c94935');
const countedMat = mat('#e7b949');
const appleGeo = new THREE.SphereGeometry(.7, 12, 8);

function createSaleBundles(bundles) {
  const skins = { r: '#c64738', g: '#78a64e', y: '#e8bc43' };
  const names = { r: 'red', g: 'green', y: 'yellow' };
  bundles.forEach((bundle, index) => {
    const stand = new THREE.Group();
    stand.position.set((index - (bundles.length - 1) / 2) * 11, 0, -7);
    puzzleVisuals.add(stand);
    mesh(new THREE.BoxGeometry(10, .5, 9), wicker, 0, 2, 0, stand);
    for (const x of [-4, 4]) for (const z of [-3.5, 3.5]) {
      mesh(new THREE.BoxGeometry(.45, 2, .45), trunkMat, x, 1, z, stand);
    }
    const counts = Object.fromEntries(Object.keys(bundle.counts).map(variable => [variable, 0]));
    const reportCount = () => {
      const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
      const details = Object.entries(counts).map(([variable, count]) => `${count} ${names[variable]}`).join(' + ');
      showFilMessage(`Bundle ${index + 1}: ${details} = ${total} ${total === 1 ? 'apple' : 'apples'} selected.`);
    };
    const colourGroups = Object.entries(bundle.counts).filter(([, quantity]) => quantity > 0);
    const groupWidth = 10 / colourGroups.length;
    colourGroups.forEach(([variable, quantity], groupIndex) => {
      const skin = mat(skins[variable]);
      for (let i = 0; i < quantity; i++) {
        const fruit = new THREE.Group();
        fruit.position.set(...appleGridPosition(i, {
          width: groupWidth - .4, depth: 8.2, radius: .385, gap: .35,
          centerX: -5 + groupWidth * (groupIndex + .5), baseY: 2.65,
        }));
        stand.add(fruit);
        const apple = mesh(appleGeo, skin, 0, 0, 0, fruit);
        apple.scale.setScalar(.55);
        mesh(new THREE.CylinderGeometry(.04, .06, .25, 6), trunkMat, 0, .5, 0, fruit);
        // Keep a narrow, stationary target covering both resting and raised fruit.
        const target = mesh(new THREE.CylinderGeometry(.4, .4, 1.6, 12), new THREE.MeshBasicMaterial({ visible: false }),
          fruit.position.x, fruit.position.y + .35, fruit.position.z, stand);
        const halo = mesh(new THREE.TorusGeometry(.65, .06, 8, 24),
          new THREE.MeshBasicMaterial({ color: '#f3c94f' }), 0, -.35, 0, fruit);
        halo.rotation.x = Math.PI / 2;
        halo.visible = false;
        const rest = fruit.position.clone();
        let counted = false;
        target.userData.action = () => {
          counted = !counted;
          counts[variable] += counted ? 1 : -1;
          halo.visible = counted;
          animate(fruit, [rest.x, rest.y + (counted ? .7 : 0), rest.z]);
          reportCount();
          reactFil();
        };
        interactive.push(target);
      }
    });
    const standTarget = mesh(new THREE.BoxGeometry(10, .6, 9), new THREE.MeshBasicMaterial({ visible: false }), 0, 2, 0, stand);
    standTarget.userData.shareTray = true;
    standTarget.userData.action = () => {
      const detail = colourGroups.map(([variable, count]) => `${count} ${names[variable]}`).join(' and ');
      showFilMessage(`${detail} apples cost $${bundle.total.toFixed(2)}.`);
      reactFil();
    };
    interactive.push(standTarget);
  });
}

function createMarketApple(variable, x) {
  const varieties = {
    r: { name: 'RED', skin: '#c64738' },
    g: { name: 'GREEN', skin: '#78a64e' },
    y: { name: 'YELLOW', skin: '#e8bc43' }
  };
  const variety = varieties[variable];
  const display = new THREE.Group();
  display.position.set(x, 0, -8);
  puzzleVisuals.add(display);
  mesh(new THREE.CylinderGeometry(2.5, 2.65, .4, 24), wicker, 0, .5, 0, display);
  const apple = mesh(new THREE.SphereGeometry(1.35, 20, 14), mat(variety.skin), 0, 2, 0, display);
  apple.scale.set(1.05, .88, .95);
  for (const side of [-1, 1]) {
    const lobe = mesh(new THREE.SphereGeometry(.7, 12, 10), mat(variety.skin), side * .55, 2.72, 0, display);
    lobe.scale.set(1, .42, .9);
  }
  const stem = mesh(new THREE.CylinderGeometry(.08, .12, .55, 8), trunkMat, 0, 3.35, 0, display);
  stem.rotation.z = -.2;
  const leaf = mesh(new THREE.SphereGeometry(.4, 10, 8), mat('#477a3f'), .4, 3.48, 0, display);
  leaf.scale.set(1, .13, .5);
  leaf.rotation.z = .35;
  const priceTag = label(`${variety.name}  ${variable} = $?`, 5.8);
  priceTag.position.set(0, 4.8, .2);
  display.add(priceTag);
  mesh(new THREE.BoxGeometry(.16, 3, .16), trunkMat, 0, 3.3, 0, display);
  faceCameraOnce(priceTag, puzzleCameraPosition);
}

function animate(object, position, rotationZ = 0, onComplete = null, duration = 650) {
  const prior = tweens.findIndex(t => t.object === object);
  if (prior >= 0) tweens.splice(prior, 1);
  tweens.push({ object, from: object.position.clone(), to: new THREE.Vector3(...position), rotation: object.rotation.z, targetRotation: rotationZ, start: performance.now(), onComplete, duration });
}
function updateControls() {
  if (advancedPuzzle) return;
  const sharing = isDistributing();
  baskets.forEach((basket, index) => {
    const active = sharing ? canPlaceApple(index) : selected === index && !basket.dumped;
    basket.dropCue.visible = !sharing && active;
    basket.ring.material.opacity = active ? .95 : .36;
    basket.ring.material.color.set(active ? '#f3c94f' : '#d8c47d');
    basket.matMesh.material.color.set(active || hovered === basket.matMesh ? '#f4dfa0' : '#e8d8ad');
    basket.matEdge.material.color.set(active ? '#f3c94f' : '#b28b42');
  });
  for (const target of interactive.filter(object => object.userData.shareTray)) {
    const eligible = sharing && canPlaceApple(target.userData.destination ?? null);
    target.material.emissive.set(eligible ? '#66501b' : '#000000');
    target.material.emissiveIntensity = eligible ? .55 : 0;
  }
  if (basketSpot) basketSpot.visible = currentPuzzleType.id === 'groups' && availableBaskets < puzzle.basketCount;
}
function pickBasket(index) {
  if (advancedPuzzle) return;
  if (index >= availableBaskets) return;
  if (isDistributing()) { placeShareApple(index, currentPuzzleType.id === 'groups' ? puzzle.basketCount : 1); return; }
  reactFil();
  if (selected === index && baskets[index].dumped) { repack(index); return; }
  if (selected !== null && selected !== index && !baskets[selected].dumped) {
    const old = baskets[selected]; old.liftAt = 0; animate(old.container, [old.x, 1, old.z]);
  }
  selected = index;
  playSound('lift');
  const basket = baskets[index];
  if (!basket.dumped) { animate(basket.container, [basket.x, 5, basket.z]); basket.liftAt = performance.now() + 650; }
  updateControls();
}
function dump(index) {
  if (advancedPuzzle || index >= availableBaskets || isDistributing()) return;
  reactFil();
  if (selected !== index) { pickBasket(index); return; }
  const basket = baskets[index];
  if (basket.dumped) return;
  basket.dumped = true;
  playSound('dump');
  basket.liftAt = 0;
  animate(basket.container, [basket.x, 3, basket.z + 3], Math.PI / 2.4);
  basket.activeApples.forEach((apple, i) => {
    scene.attach(apple);
    animate(apple, appleGridPosition(i, {
      width: 8, depth: 10, radius: .7, centerX: basket.x, centerZ: basket.z + 12, baseY: 1.15,
    }));
  });
  updateControls();
}
function repack(index) {
  if (currentPuzzleType.id === 'compare') { showPuzzleArrangement(); updateControls(); return; }
  reactFil();
  const basket = baskets[index];
  const hadCount = basket.count > 0;
  basket.dumped = false; basket.count = 0;
  playSound('repack');
  basket.activeApples.forEach((apple, i) => {
    apple.material = appleMat; apple.userData.counted = false;
    basket.container.attach(apple);
    animate(apple, [(i % 2 ? .7 : -.7), .9, (i < 2 ? -.65 : .65)]);
  });
  animate(basket.container, [basket.x, 1, basket.z]);
  basket.liftAt = 0;
  selected = null;
  if (hadCount) updateAppleCounter();
  updateControls();
}
function countApple(index, apple) {
  reactFil();
  const basket = baskets[index];
  if (!basket.dumped || apple.userData.counted) return;
  selected = index; apple.userData.counted = true;
  apple.material = countedMat;
  basket.count++;
  playSound('count', basket.count);
  updateAppleCounter();
  updateControls();
}
for (let index = 0; index < 6; index++) {
  const x = (index - 1.5) * 8;
  const container = new THREE.Group(); container.position.set(x, 1, -8); scene.add(container);
  const selectionRing = new THREE.Mesh(new THREE.TorusGeometry(2.7, .13, 6, 32), new THREE.MeshBasicMaterial({ color: '#d8c47d', transparent: true, opacity: .36 }));
  selectionRing.rotation.x = Math.PI / 2; selectionRing.position.y = -.8; container.add(selectionRing);
  // Open basket: a base, a woven sidewall, rim, and raised handle.
  mesh(new THREE.CylinderGeometry(2, 1.7, .3, 20), wicker, 0, 0, 0, container);
  mesh(new THREE.CylinderGeometry(2.2, 1.7, 1.8, 20, 1, true), new THREE.MeshStandardMaterial({ color: '#ad7b45', roughness: 1, side: THREE.DoubleSide }), 0, .9, 0, container);
  for (let y = .3; y <= 1.8; y += .45) {
    const ring = mesh(new THREE.TorusGeometry(1.7 + y * .27, .09, 5, 24), darkWicker, 0, y, 0, container); ring.rotation.x = Math.PI / 2;
  }
  const handle = mesh(new THREE.TorusGeometry(2.1, .16, 6, 24, Math.PI), wicker, 0, 1.7, 0, container);
  handle.rotation.y = Math.PI / 2;
  const target = mesh(new THREE.CylinderGeometry(2.8, 2.8, 4, 12), new THREE.MeshBasicMaterial({ visible: false }), 0, 1.5, 0, container);
  target.userData.action = () => pickBasket(index); target.userData.basketIndex = index; interactive.push(target);
  const matMesh = mesh(new THREE.BoxGeometry(8, .12, 10), mat('#e8d8ad'), x, .35, 4);
  const matEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(8.15, .14, 10.15)), new THREE.LineBasicMaterial({ color: '#b28b42', transparent: true, opacity: .72 }));
  matEdge.position.set(x, .42, 4); scene.add(matEdge);
  const dropCue = new THREE.Group(); dropCue.position.set(x, 2.25, 4); dropCue.visible = false;
  const cueMaterial = new THREE.MeshStandardMaterial({ color: '#e8c45b', emissive: '#8e6d1c', emissiveIntensity: .75, roughness: .65 });
  mesh(new THREE.CylinderGeometry(.12, .12, .72, 8), cueMaterial, 0, .18, 0, dropCue);
  const arrowHead = mesh(new THREE.ConeGeometry(.42, .62, 7), cueMaterial, 0, -.38, 0, dropCue); arrowHead.rotation.z = Math.PI;
  scene.add(dropCue);
  matMesh.userData.action = () => dump(index); interactive.push(matMesh);
  const createApple = i => {
    const column = i % 4, row = Math.floor(i / 4);
    const apple = mesh(appleGeo, appleMat, (column - 1.5) * .58, .9 + row * .5, (row % 2 ? .48 : -.48), container);
    const appleRing = new THREE.Mesh(new THREE.TorusGeometry(.92, .09, 5, 20), new THREE.MeshBasicMaterial({ color: '#f6d76b', transparent: true, opacity: .9 }));
    appleRing.rotation.x = Math.PI / 2; appleRing.position.y = .04; appleRing.visible = false; apple.add(appleRing);
    mesh(new THREE.CylinderGeometry(.06, .07, .32, 5), trunkMat, 0, .65, 0, apple);
    const appleTarget = mesh(new THREE.SphereGeometry(1.65, 10, 8), new THREE.MeshBasicMaterial({ visible: false }), 0, 0, 0, apple);
    appleTarget.userData.action = () => countApple(index, apple); appleTarget.userData.highlight = appleRing;
    apple.userData.hitTarget = appleTarget; apple.userData.highlight = appleRing;
    return apple;
  };
  const apples = Array.from({ length: 10 }, (_, i) => createApple(i));
  baskets.push({ x, container, createApple, apples, activeApples: apples, ring: selectionRing, matMesh, matEdge, dropCue, dumped: false, count: 0 });
}

// Uncle Fil is assembled from simple 3D shapes, with a face angled toward the overhead camera.
const fil = new THREE.Group(); fil.position.set(4, .3, -23); scene.add(fil);
const shirt = mat('#73969b'), skin = mat('#d2a078'), denim = mat('#415e77'), hat = mat('#dbc17e');
const filTorso = new THREE.Group(); filTorso.position.y = 2; fil.add(filTorso);
const filHead = new THREE.Group(); filHead.position.set(0, 3.7, -.3); fil.add(filHead);
const filArms = [];
mesh(new THREE.CapsuleGeometry(.95, 1.3, 4, 8), shirt, 0, 0, 0, filTorso);
for (const side of [-1, 1]) {
  const arm = new THREE.Group(); arm.position.set(side * .78, .25, .12); filTorso.add(arm); filArms.push({ group: arm, side });
  mesh(new THREE.CylinderGeometry(.35, .4, 1.25, 7), shirt, 0, -.42, .03, arm);
  mesh(new THREE.SphereGeometry(.34, 8, 6), skin, 0, -1.2, .03, arm);
}
mesh(new THREE.SphereGeometry(.9, 12, 10), skin, 0, 0, 0, filHead);
const filHat = new THREE.Group(); filHat.position.set(0, .5, -.7); filHat.rotation.set(-.5, 0, 0); filHead.add(filHat);
mesh(new THREE.CylinderGeometry(1.55, 1.55, .15, 16), hat, 0, 0, 0, filHat);
mesh(new THREE.CylinderGeometry(.8, 1, .8, 12), hat, 0, .3, 0, filHat);
for (const x of [-.32, .32]) mesh(new THREE.SphereGeometry(.1, 6, 4), mat('#343b2c'), x, .7, .4, filHead);
let filReactionUntil = 0;
function reactFil(now = performance.now()) { filReactionUntil = now + 850; }
const appleCounter = speechBubble('0 apples'); appleCounter.position.set(4, 9, -23); appleCounter.visible = false; scene.add(appleCounter);
function sizeCounterBubble() {
  const viewHeight = canvas.clientHeight || Math.min(innerWidth, innerHeight);
  const viewWidth = canvas.clientWidth || Math.max(innerWidth, innerHeight);
  // Start at Fil's anchor each frame so clamping never accumulates camera movement.
  appleCounter.position.set(4, 9, -23);
  camera.updateMatrixWorld();
  const depth = -appleCounter.position.clone().applyMatrix4(camera.matrixWorldInverse).z;
  if (depth <= 0) return;
  const visibleWorldHeight = 2 * depth * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const bubblePixels = Math.max(72, Math.min(88, viewHeight * .2)) * (appleCounter.userData.bubbleHeight / 152);
  const padding = 12;
  const heightPixels = Math.min(bubblePixels, viewHeight - padding * 2,
    (viewWidth - padding * 2) / appleCounter.userData.bubbleAspect);
  const worldHeight = visibleWorldHeight * Math.max(1, heightPixels) / viewHeight;
  appleCounter.scale.set(worldHeight * appleCounter.userData.bubbleAspect, worldHeight, 1);
  const projected = appleCounter.position.clone().project(camera);
  const halfWidth = appleCounter.scale.x / (visibleWorldHeight * camera.aspect);
  const halfHeight = worldHeight / visibleWorldHeight;
  const limitX = Math.max(0, 1 - halfWidth - padding * 2 / viewWidth);
  const limitY = Math.max(0, 1 - halfHeight - padding * 2 / viewHeight);
  projected.x = THREE.MathUtils.clamp(projected.x, -limitX, limitX);
  projected.y = THREE.MathUtils.clamp(projected.y, -limitY, limitY);
  appleCounter.position.copy(projected.unproject(camera));
}
let counterHideAt = 0;
function updateAppleCounter() {
  if (currentPuzzleType.id === 'compare') {
    showFilMessage(`${baskets[0].count} in the first basket, ${baskets[1].count} in the second.`);
    return;
  }
  const total = baskets.reduce((sum, basket) => sum + basket.count, 0);
  showFilMessage(`${total} ${total === 1 ? 'apple' : 'apples'}`);
}
function showFilMessage(message) {
  appleCounter.userData.setText(message);
  appleCounter.visible = true; appleCounter.material.opacity = 1;
  counterHideAt = performance.now() + Math.max(2400, message.length * 55);
}
const filTarget = mesh(new THREE.SphereGeometry(2.5, 8, 6), new THREE.MeshBasicMaterial({ visible: false }), 0, 2, 0, fil);
filTarget.userData.action = () => { reactFil(); playSound('message'); };
interactive.push(filTarget);

function isVisibleTarget(object) {
  for (let item = object; item; item = item.parent) if (!item.visible) return false;
  return true;
}
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hovered = null;
function setPointerFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  pointer.set(...(innerHeight > innerWidth ? [y * 2 - 1, x * 2 - 1] : [x * 2 - 1, 1 - y * 2]));
  raycaster.setFromCamera(pointer, camera);
}
function interactionHit() {
  const hits = raycaster.intersectObjects(interactive.filter(isVisibleTarget), false);
  return hits.find(hit => hit.object.userData.basketApple)
    || (isDistributing() ? hits.find(hit => shareApples.includes(hit.object.parent)) : null) || hits[0];
}
canvas.addEventListener('pointermove', event => {
  setPointerFromEvent(event);
  if (shareDrag && (shareDrag.moving || Math.hypot(event.clientX - shareDrag.x, event.clientY - shareDrag.y) >= 8)) {
    if (!shareDrag.moving) {
      shareDrag.moving = true;
      if (selectedApple !== shareDrag.apple) selectShareApple(shareDrag.apple);
      const tweenIndex = tweens.findIndex(tween => tween.object === shareDrag.apple);
      if (tweenIndex >= 0) tweens.splice(tweenIndex, 1);
    }
    const point = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -4), point)) shareDrag.apple.position.copy(point);
    canvas.style.cursor = 'grabbing';
    updateControls();
    return;
  }
  const next = interactionHit()?.object || null;
  if (hovered?.userData.highlight && hovered.parent !== selectedApple) hovered.userData.highlight.visible = false;
  hovered = next;
  if (hovered?.userData.highlight) hovered.userData.highlight.visible = true;
  canvas.style.cursor = hovered ? 'pointer' : 'default';
  updateControls();
});
canvas.addEventListener('pointerleave', () => {
  if (hovered?.userData.highlight && hovered.parent !== selectedApple) hovered.userData.highlight.visible = false;
  hovered = null; canvas.style.cursor = 'default'; updateControls();
});
let shareDrag = null;
let suppressShareClick = false;
canvas.addEventListener('pointerdown', event => {
  if (!isDistributing() || promptIntro || cameraIntroActive || !document.body.classList.contains('started')) return;
  setPointerFromEvent(event);
  const hit = interactionHit()?.object;
  if (hit && shareApples.includes(hit.parent)) {
    shareDrag = { apple: hit.parent, x: event.clientX, y: event.clientY, moving: false };
    canvas.setPointerCapture(event.pointerId);
  }
});
canvas.addEventListener('pointercancel', () => { if (shareDrag?.moving) layoutShareApples(); shareDrag = null; });
canvas.addEventListener('pointerup', event => {
  if (!shareDrag) return;
  const drag = shareDrag;
  shareDrag = null;
  if (!drag.moving) return;
  suppressShareClick = true;
  setTimeout(() => { suppressShareClick = false; }, 0);
  if (selectedApple !== drag.apple) selectShareApple(drag.apple);
  setPointerFromEvent(event);
  const target = raycaster.intersectObjects(interactive.filter(object => isVisibleTarget(object) && (object.userData.basketIndex !== undefined || object.userData.shareTray)), false)[0]?.object;
  if (target) placeShareApple(target.userData.shareTray ? target.userData.destination ?? null : target.userData.basketIndex);
  layoutShareApples();
});
canvas.addEventListener('click', event => {
  if (suppressShareClick) return;
  if (!document.body.classList.contains('started') || cameraIntroActive || promptIntro) return;
  setPointerFromEvent(event);
  if (packingScene) {
    const targets = interactive.filter(object => isVisibleTarget(object) && (object.userData.packingApple || object.userData.packingBasket));
    const hits = raycaster.intersectObjects(targets, false);
    const basketHit = packingScene.selected && hits.find(hit => hit.object.userData.packingBasket);
    packingHit(basketHit || hits[0]);
    return;
  }
  const hit = interactionHit();
  hit?.object.userData.action?.();
});

let soundEnabled = true;
$('#reset-progress').addEventListener('click', () => $('#reset-dialog').showModal());
$('#cancel-reset').addEventListener('click', () => $('#reset-dialog').close());
$('#confirm-reset').addEventListener('click', () => {
  dayProgress = normalizeProgress();
  dayFinished = false;
  saveProgress();
  $('#reset-dialog').close();
  document.body.classList.remove('started', 'camera-moving', 'returning');
  $('#game-screen').inert = true;
  $('#opening-scene').hidden = false;
});
$('#sound-toggle').addEventListener('click', () => {
  soundEnabled = !soundEnabled; setSoundEnabled(soundEnabled);
  $('#sound-toggle').textContent = soundEnabled ? '♫' : '♪';
  $('#sound-toggle').setAttribute('aria-pressed', String(soundEnabled));
  $('#sound-toggle').setAttribute('aria-label', soundEnabled ? 'Mute sound' : 'Turn sound on');
  $('#sound-toggle').title = soundEnabled ? 'Mute sound' : 'Turn sound on';
  if (soundEnabled) playSound('count');
});
function resetPuzzle() {
  shareDrag = null;
  const chosenLevel = dayProgress.level;
  const themeRoll = Math.random();
  advancedPuzzle = chosenLevel === 1 ? null
    : chosenLevel === 2 ? (themeRoll < .5 ? generateAnimalPuzzle(chosenLevel) : null)
    : themeRoll < .25 ? null : themeRoll < .5 ? generateAnimalPuzzle(chosenLevel) : generateAdvancedPuzzle(chosenLevel);
  const [minimum, maximum] = valueRange(chosenLevel);
  const sample = () => minimum + Math.floor(Math.random() * (maximum - minimum + 1));
  const basketRange = chosenLevel <= 2 ? [3, 3] : chosenLevel <= 4 ? [3, 5] : [4, 6];
  puzzle.basketCount = basketRange[0] + Math.floor(Math.random() * (basketRange[1] - basketRange[0] + 1));
  puzzle.applesPerBasket = sample();
  puzzle.totalApples = puzzle.basketCount * puzzle.applesPerBasket;
  currentPuzzleType = puzzleTypes[Math.floor(Math.random() * puzzleTypes.length)];
  // Group puzzles use the level’s selected basket count.
  puzzle.groupSize = sample();
  if (currentPuzzleType.id === 'groups') puzzle.totalApples = puzzle.groupSize * puzzle.basketCount;
  if (currentPuzzleType.id === 'compare') puzzle.totalApples = 2 * sample() + 3;
  if (currentPuzzleType.id === 'leftover') puzzle.totalApples += 2;
  if (currentPuzzleType.id === 'remainder') {
    Object.assign(puzzle, generateRemainderPuzzle(puzzle.basketCount, puzzle.applesPerBasket));
  }
  showPuzzleArrangement();
  const prompt = advancedPuzzle ? advancedPuzzle.prompt : currentPuzzleType.prompt(puzzle);
  $('#day-label').textContent = `Day ${dayProgress.day}`;
  $('#equation').closest('label').hidden = !!advancedPuzzle;
  $('#solution').closest('label').hidden = !!advancedPuzzle;
  $('#equation').required = !advancedPuzzle; $('#solution').required = !advancedPuzzle;
  $('#system-fields').replaceChildren();
  if (advancedPuzzle) {
    advancedPuzzle.equations.forEach((_, i) => addAnswerField(`Equation ${i + 1}`, `system-equation-${i}`, 'Use the clues to write an equation'));
    Object.keys(advancedPuzzle.values).forEach(variable => addAnswerField(`${variable} =`, `system-value-${variable}`, advancedPuzzle.animal ? 'Your proposed amount' : advancedPuzzle.commerce ? 'Dollars per apple' : 'Apples per basket'));
  }
  const question = prompt.replace(/<[^>]*>/g, '');
  $('.question-panel p').innerHTML = prompt;
  $('#trade-status')?.remove();
  $('#question-intro').textContent = '';
  const dayHeading = document.createElement('span'); dayHeading.className = 'day-heading'; dayHeading.textContent = `Day ${dayProgress.day}`;
  const introPrompt = document.createElement('p'); introPrompt.innerHTML = prompt;
  $('#question-intro').append(dayHeading, introPrompt);
  $('#question-intro').setAttribute('aria-label', question);
  $('#equation').placeholder = currentPuzzleType.placeholder(puzzle);
  $('#answer-form').reset();
  updateControls();
}
function addAnswerField(caption, id, placeholder) {
  const labelElement = document.createElement('label'); labelElement.textContent = caption;
  const input = document.createElement('input'); input.id = id; input.required = true; input.maxLength = 160;
  input.autocomplete = 'off'; input.placeholder = placeholder;
  labelElement.append(input); $('#system-fields').append(labelElement);
}

document.addEventListener('game-start', () => {
  dayProgress.day++;
  dayFinished = false;
  saveProgress();
  resetPuzzle();
  cameraReturnActive = false;
  scene.background.copy(farmBackground);
  farmSky.material.color.set('#ffffff');
  sun.color.set('#fff0ce'); sun.intensity = 2.4;
  const introCard = $('#question-intro');
  introCard.classList.remove('visible');
  void introCard.offsetWidth;
  introCard.classList.add('visible');
  introCard.scrollTop = 0;
  introCard.tabIndex = 0;
  const paragraph = introCard.querySelector('p');
  const words = paragraph.textContent.trim().split(/\s+/).map(text => {
    const word = document.createElement('span'); word.textContent = text; word.style.visibility = 'hidden';
    return word;
  });
  paragraph.replaceChildren(...words.flatMap((word, i) => i ? [document.createTextNode(' '), word] : [word]));
  promptIntro = { words, shown: 0, start: performance.now(), finishedAt: null };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    camera.position.copy(puzzleCameraPosition); camera.lookAt(puzzleCameraTarget); cameraIntroActive = false;
    document.body.classList.remove('camera-moving');
    return;
  }
  camera.position.copy(uncleCameraPosition); camera.lookAt(uncleCameraTarget);
  cameraIntroStart = performance.now(); cameraIntroActive = true;
  document.body.classList.add('camera-moving');
});

const report = $('#results-dialog');
function openReport() { if (!report.open) report.showModal(); }
function finishFarmReturn() {
  cameraReturnActive = false;
  document.body.classList.remove('camera-moving');
  document.body.classList.remove('returning', 'started');
  document.dispatchEvent(new Event('bedroom-return'));
  openReport();
}
$('#result-paper').addEventListener('click', openReport);
$('#result-paper').addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openReport(); }
});
$('#close-results').addEventListener('click', () => report.close());
$('#answer-form').addEventListener('submit', event => {
  event.preventDefault();
  const equation = advancedPuzzle ? advancedPuzzle.equations.map((_, i) => $(`#system-equation-${i}`).value.trim()).join('; ') : $('#equation').value.trim();
  const namedSolutions = advancedPuzzle ? Object.fromEntries(Object.keys(advancedPuzzle.values).map(variable => [variable, $(`#system-value-${variable}`).value.trim()])) : null;
  const solution = advancedPuzzle ? Object.entries(namedSolutions).map(([key, value]) => `${key} = ${value}`).join(', ') : $('#solution').value.trim();
  if (!equation || !solution) return;
  const correctValue = advancedPuzzle ? Object.entries(advancedPuzzle.values).map(([key, value]) => `${key} = ${value}`).join(', ') : currentPuzzleType.answer(puzzle);
  const result = advancedPuzzle ? assessSystem(equation.split('; '), namedSolutions, advancedPuzzle) : assessAnswer(equation, solution, { basketCount: puzzle.basketCount, totalApples: puzzle.totalApples, expected: currentPuzzleType.expected(puzzle), answer: correctValue, correctDetail: 'Your equation matches the relationship in this question.' });
  if (!dayFinished) {
    dayProgress = finishDay(dayProgress, result.equationCorrect && result.solutionCorrect);
    dayFinished = true;
    saveProgress();
  }
  playSound(result.equationCorrect && result.solutionCorrect ? 'submit' : 'retry');
  $('#results-title').textContent = result.equationCorrect && result.solutionCorrect ? 'Thank you for working so hard. Get some rest!' : 'The customer reported me a scammer! I need to try again.';
  $('#submitted-answer').textContent = `You wrote: ${equation} · Your letter's value: ${solution}`;
  $('#equation-result').textContent = `${result.equationCorrect ? '✓ Algebraic Equation correct.' : 'Try the equation again.'} ${result.detail}`;
  $('#solution-result').textContent = result.solutionCorrect ? `✓ Solution correct: ${correctValue}.` : `Something went wrong. Try again! The correct value is ${correctValue}.`;
  $('#result-explanation').textContent = advancedPuzzle ? `${advancedPuzzle.equations.join('; ')}. Therefore ${correctValue}.` : currentPuzzleType.explain(puzzle);
  $('#paper-summary').textContent = `${Number(result.equationCorrect) + Number(result.solutionCorrect)} / 2 correct · click to read`;
  $('#result-paper').style.display = '';
  cameraIntroActive = false; $('#question-intro').classList.remove('visible');
  document.body.classList.add('camera-moving');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // Show the same landscape as a still frame when camera motion is disabled.
    camera.position.copy(puzzleCameraPosition).add(new THREE.Vector3(0, 17.5, 27));
    camera.lookAt(4, 40, -7);
    farmSky.material.color.set('#f5f2ea');
    document.body.classList.add('returning');
    document.querySelector('#game-screen').inert = true;
    setTimeout(finishFarmReturn, 1200);
  } else {
    document.body.classList.add('returning');
    document.querySelector('#game-screen').inert = true;
    filReactionUntil = performance.now() + 3000;
    cameraReturnFrom.copy(camera.position);
    cameraReturnTarget.copy(puzzleCameraTarget);
    cameraReturnStart = performance.now(); cameraReturnActive = true;
  }
});
updateControls();

function resize() {
  const width = canvas.clientWidth || Math.max(innerWidth, innerHeight);
  const height = canvas.clientHeight || Math.min(innerWidth, innerHeight);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}
window.addEventListener('resize', resize);
resize();
const ambientAnimals = createAmbientAnimals(scene, puzzleCameraPosition);
let animalFrameTime = null;
renderer.setAnimationLoop(now => {
  const animalDelta = animalFrameTime === null ? 0 : (now - animalFrameTime) / 1000;
  animalFrameTime = now;
  if (!document.hidden && document.body.classList.contains('started')) {
    animalPuzzleObjects?.update(Math.min(animalDelta, .05), matchMedia('(prefers-reduced-motion: reduce)').matches);
    ambientAnimals.update(animalDelta, matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  if (promptIntro) {
    const intro = promptIntro;
    const count = Math.min(intro.words.length, Math.floor((now - intro.start) / 230) + 1);
    if (count > intro.shown) {
      for (let i = intro.shown; i < count; i++) intro.words[i].style.visibility = 'visible';
      playSound('mumble', count);
      intro.shown = count;
      const card = $('#question-intro');
      const wordBounds = intro.words[count - 1].getBoundingClientRect();
      const cardBounds = card.getBoundingClientRect();
      const bottomPadding = parseFloat(getComputedStyle(card).paddingBottom);
      const overflow = wordBounds.bottom - (cardBounds.top + card.clientTop + card.clientHeight - bottomPadding);
      if (overflow > 0) card.scrollTop += overflow;
    }
    if (intro.shown === intro.words.length && intro.finishedAt === null) intro.finishedAt = now;
    if (!cameraIntroActive && intro.finishedAt !== null && now - intro.finishedAt >= 900) finishPromptIntro();
  }
  const seconds = now * .001;
  if (cameraReturnActive) {
    const t = Math.min(1, (now - cameraReturnStart) / 3000);
    const eased = t * t * (3 - 2 * t);
    const destination = cameraReturnFrom.clone().add(new THREE.Vector3(0, 17.5, 27));
    camera.position.lerpVectors(cameraReturnFrom, destination, eased);
    const focus = cameraReturnTarget.clone().lerp(new THREE.Vector3(4, 40, -7), eased);
    camera.lookAt(focus);
    scene.background.copy(farmBackground).lerp(new THREE.Color('#f2b96e'), eased * .68);
    farmSky.material.color.set('#ffffff').lerp(new THREE.Color('#ffcf9e'), eased * .28);
    sun.color.set('#fff0ce').lerp(new THREE.Color('#ffb75e'), eased * .62);
    sun.intensity = 2.4 + eased * .35;
    // Hold the wide landscape for a moment before showing the bedroom report.
    if (now - cameraReturnStart >= 4200) {
      finishFarmReturn();
    }
  }
  const reaction = Math.max(0, Math.min(1, (filReactionUntil - now) / 850));
  const reactionEase = reaction * reaction * (3 - 2 * reaction);
  // Small transform-only motions keep the idle animation cheap.
  fil.position.y = .3 + Math.sin(seconds * 2.2) * .045;
  filTorso.scale.y = 1 + Math.sin(seconds * 2.2 - .4) * .012;
  filHead.rotation.x = Math.sin(seconds * .75) * .035 - reactionEase * .12;
  filHead.rotation.y = Math.sin(seconds * .48) * .06;
  const introWaveTime = (now - cameraIntroStart) / 1000;
  const firstWave = THREE.MathUtils.smoothstep(introWaveTime, .25, .65) * (1 - THREE.MathUtils.smoothstep(introWaveTime, 2.4, 2.8));
  const secondWave = THREE.MathUtils.smoothstep(introWaveTime, 3.2, 3.6) * (1 - THREE.MathUtils.smoothstep(introWaveTime, 5.3, 5.7));
  const introWave = cameraIntroActive ? Math.max(firstWave, secondWave) : 0;
  const returnWaveTime = (now - cameraReturnStart) / 1000;
  const returnWave = cameraReturnActive
    ? Math.max(
      THREE.MathUtils.smoothstep(returnWaveTime, .05, .3) * (1 - THREE.MathUtils.smoothstep(returnWaveTime, 1.25, 1.55)),
      THREE.MathUtils.smoothstep(returnWaveTime, 1.35, 1.6) * (1 - THREE.MathUtils.smoothstep(returnWaveTime, 2.55, 2.9))
    ) : 0;
  for (const arm of filArms) {
    const idleSwing = Math.sin(seconds * 1.1 + arm.side) * .025;
    const gesture = arm.side < 0 ? 1 : -.35;
    const wave = arm.side < 0
      ? introWave * (-1.4 + Math.sin(introWaveTime * 9) * .24) + returnWave * (-1.4 + Math.sin(returnWaveTime * 11) * .28)
      : 0;
    arm.group.rotation.z = idleSwing + gesture * Math.sin(reactionEase * Math.PI * .72) * .72 + wave;
    arm.group.rotation.x = reactionEase * -.12;
  }
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tween = tweens[i];
    const t = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : Math.min(1, (now - tween.start) / tween.duration);
    const eased = t * t * (3 - 2 * t);
    tween.object.position.lerpVectors(tween.from, tween.to, eased);
    tween.object.rotation.z = tween.rotation + (tween.targetRotation - tween.rotation) * eased;
    if (t === 1) {
      tweens.splice(i, 1);
      tween.onComplete?.();
    }
  }
  sizeCounterBubble();
  if (appleCounter.visible && now > counterHideAt) {
    appleCounter.material.opacity = Math.max(0, 1 - (now - counterHideAt) / 350);
    if (appleCounter.material.opacity === 0) appleCounter.visible = false;
  }
  const pulse = matchMedia('(prefers-reduced-motion: reduce)').matches ? .5 : Math.sin(now * .003) * .5 + .5;
  for (const basket of baskets) {
    const pulseScale = 1 + pulse * .14;
    basket.ring.scale.setScalar(pulseScale);
    basket.matEdge.material.opacity = basket.dropCue.visible ? .9 + pulse * .1 : .58 + pulse * .2;
    basket.dropCue.position.y = 2.15 + pulse * .28;
    basket.dropCue.scale.setScalar(1 + pulse * .1);
    if (basket.dumped) {
      const nextApple = basket.activeApples.find(apple => !apple.userData.counted);
      for (const apple of basket.activeApples) {
        const ring = apple.userData.highlight;
        if (!ring) continue;
        ring.visible = apple === comparisonApple || apple === nextApple || hovered === apple.userData.hitTarget;
        if (apple === nextApple) {
          ring.scale.setScalar(1 + pulse * .4);
          ring.material.opacity = .2 + pulse * .8;
        }
      }
    }
  }
  if (cameraIntroActive) {
    // Let the landscape read behind Fil before the camera climbs over the field.
    const t = THREE.MathUtils.clamp((now - cameraIntroStart - 2000) / 8000, 0, 1);
    const eased = t * t * (3 - 2 * t);
    const focus = new THREE.Vector3().lerpVectors(uncleCameraTarget, puzzleCameraTarget, eased);
    camera.position.lerpVectors(uncleCameraPosition, puzzleCameraPosition, eased);
    camera.lookAt(focus);
    if (t >= 1) {
      cameraIntroActive = false;
      document.body.classList.remove('camera-moving');
    }
  }
  if (selected !== null && !baskets[selected].dumped && now >= baskets[selected].liftAt) {
    baskets[selected].container.position.y = 5 + Math.sin(now * .003) * .22;
  }
  renderer.render(scene, camera);
});
