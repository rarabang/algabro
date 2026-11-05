import * as THREE from '../vendor/three.module.js';

// The distant scenery sits beyond the north edge of the playable field.
export function createFarmScenery(scene) {
  let seed = 817;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

  const skyGeometry = new THREE.PlaneGeometry(800, 260, 1, 12);
  const skyColors = [];
  const horizon = new THREE.Color('#ffe0ae');
  const highSky = new THREE.Color('#dcb7ac');
  const position = skyGeometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const height = THREE.MathUtils.clamp((position.getY(i) + 130) / 260, 0, 1);
    const color = horizon.clone().lerp(highSky, Math.pow(height, .7));
    skyColors.push(color.r, color.g, color.b);
  }
  skyGeometry.setAttribute('color', new THREE.Float32BufferAttribute(skyColors, 3));
  const sky = new THREE.Mesh(skyGeometry, new THREE.MeshBasicMaterial({ vertexColors: true, depthWrite: false }));
  sky.position.set(0, 115, -320);
  scene.add(sky);
  const sun = new THREE.Mesh(new THREE.CircleGeometry(14, 32), new THREE.MeshBasicMaterial({ color: '#fff3cd' }));
  sun.position.set(-72, 76, -319);
  scene.add(sun);

  function ridge(profile, depth, color, treeColor, treeCount) {
    const shape = new THREE.Shape();
    shape.moveTo(profile[0][0], 0);
    for (const [x, height] of profile) shape.lineTo(x, height);
    shape.lineTo(profile[profile.length - 1][0], 0);
    shape.closePath();
    const mountain = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    mountain.position.z = depth;
    scene.add(mountain);

    const vertices = [];
    for (let i = 0; i < treeCount; i++) {
      const x = -235 + random() * 470;
      let ridgeHeight = 0;
      for (let j = 1; j < profile.length; j++) {
        if (x > profile[j][0]) continue;
        const [leftX, leftHeight] = profile[j - 1];
        const [rightX, rightHeight] = profile[j];
        ridgeHeight = THREE.MathUtils.lerp(leftHeight, rightHeight, (x - leftX) / (rightX - leftX));
        break;
      }
      if (ridgeHeight < 10) continue;
      const y = 3 + random() * (ridgeHeight - 8);
      const height = 2.8 + random() * 3.6;
      const width = height * (.28 + random() * .12);
      vertices.push(x, y + height, 0, x - width, y, 0, x + width, y, 0);
    }
    const treesGeometry = new THREE.BufferGeometry();
    treesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    treesGeometry.computeVertexNormals();
    const trees = new THREE.Mesh(treesGeometry, new THREE.MeshBasicMaterial({ color: treeColor, side: THREE.DoubleSide }));
    trees.position.z = depth + 1;
    scene.add(trees);
  }

  ridge([
    [-260, 17], [-222, 35], [-190, 29], [-145, 55], [-110, 44], [-68, 63], [-24, 37],
    [23, 53], [67, 42], [113, 61], [151, 35], [194, 51], [229, 32], [260, 19]
  ], -205, '#91a999', '#688c7b', 900);
  ridge([
    [-260, 12], [-220, 29], [-180, 23], [-139, 39], [-95, 28], [-53, 43], [-12, 25],
    [36, 36], [79, 24], [126, 42], [165, 29], [206, 38], [244, 22], [260, 15]
  ], -157, '#6f8e76', '#436e59', 850);
  ridge([
    [-260, 11], [-215, 18], [-173, 15], [-123, 22], [-75, 17], [-31, 24], [16, 16],
    [63, 21], [108, 16], [151, 23], [204, 17], [260, 12]
  ], -143, '#5b8060', '#345d46', 700);

  const forestGeometry = new THREE.ConeGeometry(1, 1, 5);
  const forestColors = ['#365d46', '#456f4e', '#527750'];
  const forestMaterials = forestColors.map(color => new THREE.MeshLambertMaterial({ color }));
  const treesPerColor = 300;
  const forest = forestMaterials.map(material => new THREE.InstancedMesh(forestGeometry, material, treesPerColor));
  const dummy = new THREE.Object3D();
  for (let i = 0; i < treesPerColor * forest.length; i++) {
    const backRow = i >= treesPerColor * forest.length / 2;
    const height = backRow ? 7 + random() * 7 : 8 + random() * 9;
    const width = 2.6 + random() * 2;
    dummy.position.set(
      backRow ? -160 + random() * 320 : -105 + random() * 210,
      height / 2 - .1,
      backRow ? -105 - random() * 38 : -82 - random() * 25
    );
    dummy.scale.set(width, height, width);
    dummy.rotation.y = random() * Math.PI * 2;
    dummy.updateMatrix();
    forest[i % forest.length].setMatrixAt(Math.floor(i / forest.length), dummy.matrix);
  }
  for (const trees of forest) {
    trees.instanceMatrix.needsUpdate = true;
    trees.computeBoundingSphere();
    scene.add(trees);
  }

  return { sky };
}
