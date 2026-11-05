// Keep each apple's horizontal footprint inside the surface; overflow stacks upward.
export function appleGridPosition(index, { width, depth, radius, gap = .2, centerX = 0, centerZ = 0, baseY, layerHeight = radius * 2 + gap }) {
  const spacing = radius * 2 + gap;
  const columns = Math.max(1, Math.floor((width + gap) / spacing));
  const rows = Math.max(1, Math.floor((depth + gap) / spacing));
  const slot = index % (columns * rows);
  return [
    centerX + (slot % columns - (columns - 1) / 2) * spacing,
    baseY + Math.floor(index / (columns * rows)) * layerHeight,
    centerZ + (Math.floor(slot / columns) - (rows - 1) / 2) * spacing,
  ];
}
