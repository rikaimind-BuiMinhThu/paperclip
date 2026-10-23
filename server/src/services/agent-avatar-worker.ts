import { parentPort } from "node:worker_threads";
import sharp from "sharp";
import { renderAgentSvg } from "@paperclipai/shared/cliplab/static";
import { agentPortraitPath } from "@paperclipai/shared/agent-portraits";
import type { AgentAvatarRequest } from "./agent-avatars.js";

async function renderPhoto(request: AgentAvatarRequest): Promise<Buffer> {
  const pixels = request.size * request.scale;
  const source = agentPortraitPath(request.appearance.paletteId);
  // Circle mask so photo faces match board avatars; all poses share one portrait.
  const circle = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pixels}" height="${pixels}">
      <circle cx="${pixels / 2}" cy="${pixels / 2}" r="${pixels / 2}" fill="#fff"/>
    </svg>`,
  );
  let pipeline = sharp(source)
    .resize(pixels, pixels, { fit: "cover", position: "centre" })
    .composite([{ input: circle, blend: "dest-in" }]);
  if (request.muted) pipeline = pipeline.grayscale();
  return pipeline.png().toBuffer();
}

parentPort!.on("message", async (request: AgentAvatarRequest) => {
  try {
    const png = request.appearance.characterVersion === "photo-v1"
      ? await renderPhoto(request)
      : await sharp(Buffer.from(renderAgentSvg(request.appearance, request.size, request.scale, request.pose, request.muted))).png().toBuffer();
    parentPort!.postMessage({ png });
  } catch (error) {
    parentPort!.postMessage({ error: error instanceof Error ? error.message : "Avatar rendering failed" });
  }
});
