
import { Client, handle_file } from "@gradio/client";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

function findImage(name) {
  const extensions = [".jpg", ".jpeg", ".png", ".webp"];

  const file = extensions
    .map(ext => `ai-test/${name}${ext}`)
    .find(existsSync);

  if (!file) {
    throw new Error(`Missing image: ai-test/${name}`);
  }

  return file;
}

async function main() {
  const person = findImage("person");
  const garment = findImage("garment");

  console.log("Connecting to IDM-VTON...");

  const app = await Client.connect("yisol/IDM-VTON");

  console.log("Sending images for AI try-on...");

  const result = await app.predict("/tryon", {
    dict: {
      background: handle_file(readFileSync(person)),
      layers: [],
      composite: null
    },
    garm_img: handle_file(readFileSync(garment)),
    garment_des: "A fashionable top",
    is_checked: true,
    is_checked_crop: false,
    denoise_steps: 30,
    seed: 42
  });

  const imageUrl = result.data?.[0]?.url;

  if (!imageUrl) {
    console.log("Response:", result.data);
    throw new Error("The AI did not return an image URL.");
  }

  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new Error("Could not download the generated image.");
  }

  const type = response.headers.get("content-type") || "";
  const extension = type.includes("png") ? "png" : "jpg";
  const destination = `ai-test/tryon-result.${extension}`;

  const image = Buffer.from(await response.arrayBuffer());

  writeFileSync(destination, image);

  console.log(`SUCCESS! Result saved to ${destination}`);
}

main().catch(error => {
  console.error("AI TEST FAILED:", error.message);
  process.exitCode = 1;
});
