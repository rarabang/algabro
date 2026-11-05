import * as THREE from '../vendor/three.module.js';

// Decorative chickens stay beyond the puzzle mats and never receive input.
export function createAmbientAnimals(scene, cameraPosition = { x: 4, z: 25.4 }) {
  const feathers = new THREE.MeshStandardMaterial({ color: '#f5e7c7', roughness: 1 });
  const red = new THREE.MeshStandardMaterial({ color: '#bd493c', roughness: 1 });
  const gold = new THREE.MeshStandardMaterial({ color: '#d59a39', roughness: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: '#302e27', roughness: 1 });
  function part(parent, geometry, material, position, scale = [1, 1, 1]) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position); mesh.scale.set(...scale); parent.add(mesh);
    return mesh;
  }
  const birds = [[-18, -10], [19, -6], [20, -15]].map(([x, z], i) => {
    const root = new THREE.Group(); root.position.set(x, .3, z); root.rotation.y = Math.atan2(x - cameraPosition.x, z - cameraPosition.z); scene.add(root);
    const body = new THREE.Group(); root.add(body);
    part(body, new THREE.SphereGeometry(.85, 12, 8), feathers, [0, 1, 0], [.8, .9, 1.2]);
    const neck = new THREE.Group(); neck.position.set(0, 1.5, -.65); body.add(neck);
    part(neck, new THREE.SphereGeometry(.43, 10, 8), feathers, [0, .35, -.12]);
    part(neck, new THREE.ConeGeometry(.22, .5, 4), gold, [0, .3, -.65]).rotation.x = -Math.PI / 2;
    part(neck, new THREE.SphereGeometry(.23, 8, 6), red, [0, .78, -.12], [.6, 1, 1.2]);
    for (const side of [-1, 1]) {
      part(neck, new THREE.SphereGeometry(.065, 6, 4), dark, [side * .36, .45, -.3]);
      part(body, new THREE.SphereGeometry(.45, 8, 6), feathers, [side * .65, 1, .1], [.3, .9, 1.5]);
    }
    part(body, new THREE.ConeGeometry(.42, 1, 5), feathers, [0, 1.3, .95]).rotation.x = .8;
    const legs = [-.3, .3].map(side => part(root, new THREE.CylinderGeometry(.06, .06, .6, 5), gold, [side, .3, 0]));
    return { root, body, neck, legs, x, z, homeX: x, homeZ: z, phase: i * 2.1,
      wanderX: x, wanderZ: z, mode: 'pause', modeTime: 1.2 + i * .7,
      speed: .55 + i * .12, heading: Math.atan2(x - cameraPosition.x, z - cameraPosition.z) };
  });
  let time = 0;
  const chooseNextAction = bird => {
    const angle = time * .37 + bird.phase + Math.random() * Math.PI * 2;
    const distance = 1.2 + Math.random() * 2.4;
    bird.wanderX = bird.homeX + Math.cos(angle) * distance;
    bird.wanderZ = bird.homeZ + Math.sin(angle) * distance;
    bird.mode = 'walk';
    bird.modeTime = 2.5 + Math.random() * 3.5;
  };
  return {
    update(delta, reducedMotion) {
      if (reducedMotion) {
        birds.forEach(bird => {
          bird.root.position.set(bird.homeX, .3, bird.homeZ);
          bird.root.rotation.y = Math.atan2(bird.x - cameraPosition.x, bird.z - cameraPosition.z);
          bird.body.position.y = 0; bird.neck.rotation.x = 0;
          bird.legs.forEach(leg => { leg.rotation.x = 0; });
          bird.mode = 'pause'; bird.modeTime = 1 + bird.phase;
          bird.wanderX = bird.homeX; bird.wanderZ = bird.homeZ;
        });
        return;
      }
      time += Math.min(delta, .05);
      birds.forEach(bird => {
        const step = Math.min(delta, .05);
        bird.modeTime -= step;
        if (bird.modeTime <= 0) {
          if (bird.mode === 'walk') {
            bird.mode = Math.random() < .58 ? 'peck' : 'pause';
            bird.modeTime = bird.mode === 'peck' ? 1.4 + Math.random() * 1.4 : 1.5 + Math.random() * 2.5;
          } else if (bird.mode === 'peck') {
            bird.mode = 'pause'; bird.modeTime = .8 + Math.random() * 1.8;
          } else chooseNextAction(bird);
        }

        const dx = bird.wanderX - bird.root.position.x;
        const dz = bird.wanderZ - bird.root.position.z;
        const distance = Math.hypot(dx, dz);
        const walking = bird.mode === 'walk' && distance > .12;
        if (walking) {
          // The hen's beak points along its local -Z axis.
          const desiredHeading = Math.atan2(-dx, -dz);
          const turn = (desiredHeading - bird.heading + Math.PI * 3) % (Math.PI * 2) - Math.PI;
          bird.heading += turn * Math.min(1, step * 3.5);
          const stride = Math.min(distance, bird.speed * step);
          bird.root.position.x -= Math.sin(bird.heading) * stride;
          bird.root.position.z -= Math.cos(bird.heading) * stride;
        } else if (bird.mode === 'walk') {
          bird.mode = 'pause'; bird.modeTime = 1 + Math.random() * 2;
        }
        bird.root.rotation.y = bird.heading;
        const gait = walking ? time * (8 + bird.speed) + bird.phase : 0;
        bird.body.position.y = walking ? Math.abs(Math.sin(gait)) * .055 : Math.sin(time * 1.7 + bird.phase) * .015;
        const peck = bird.mode === 'peck' ? Math.pow(Math.max(0, Math.sin((1.4 - bird.modeTime) * 5)), 5) : 0;
        bird.neck.rotation.x = -.72 * peck + (walking ? Math.sin(gait) * .035 : 0);
        bird.legs.forEach((leg, i) => { leg.rotation.x = walking ? Math.sin(gait + i * Math.PI) * .28 : 0; });
      });
    }
  };
}
