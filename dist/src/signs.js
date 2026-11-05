import * as THREE from '../vendor/three.module.js';

// Call after attaching and positioning the board; posts remain outside this group.
export function faceCameraOnce(board, cameraPosition, clearance = .8) {
  board.updateWorldMatrix(true, false);
  board.lookAt(new THREE.Vector3(cameraPosition.x, cameraPosition.y ?? 20, cameraPosition.z));
  // Offset the tilted face toward the viewer, away from its post and nearby models.
  board.translateZ(clearance);
}

export function createSignTexture(text, { background = '#ead4a0', color = '#3f3323', aspect = 4 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = Math.round(canvas.width / aspect);
  const context = canvas.getContext('2d');
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  let fontSize = Math.floor(canvas.height * .78);
  context.font = `bold ${fontSize}px sans-serif`;
  while (context.measureText(text).width > canvas.width - 80 && fontSize > 16) {
    context.font = `bold ${--fontSize}px sans-serif`;
  }
  context.fillStyle = color;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
