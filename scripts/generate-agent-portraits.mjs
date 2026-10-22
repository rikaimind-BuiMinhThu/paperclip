#!/usr/bin/env node
/**
 * photo-v1 portraits are photoreal synthetic headshots checked into
 * packages/shared/assets/agent-portraits/photo-v1/.
 *
 * Do not regenerate them as SVG cartoons. To replace pixels, generate new
 * photoreal square headshots and overwrite the PNGs (512×512), then clear
 * generated-agent-avatars/photo-v1 cache.
 */
console.error(
  "photo-v1 assets are photoreal PNGs in packages/shared/assets/agent-portraits/photo-v1/.\n" +
    "This script no longer synthesizes SVG faces. Replace PNGs manually / via image gen.",
);
process.exit(1);
