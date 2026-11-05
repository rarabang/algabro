export const CAMERA_HEIGHT = 1.7;
export const WORLD_LIMIT = 42;

// yaw=0 faces north (-Z). Movement never modifies the camera's altitude.
export function moveOnPlane(position, yaw, strafe, forward, distance, obstacles = []) {
  const length = Math.hypot(strafe, forward);
  if (length > 1) { strafe /= length; forward /= length; }
  const dx = (Math.cos(yaw) * strafe - Math.sin(yaw) * forward) * distance;
  const dz = (-Math.sin(yaw) * strafe - Math.cos(yaw) * forward) * distance;
  const blocked = (x, z) => obstacles.some(o => Math.hypot(x - o.x, z - o.z) < o.radius + 0.45);
  const x = Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, position.x + dx));
  if (!blocked(x, position.z)) position.x = x;
  const z = Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, position.z + dz));
  if (!blocked(position.x, z)) position.z = z;
  position.y = CAMERA_HEIGHT;
}
