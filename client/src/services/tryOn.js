
import { Client, handle_file } from "@gradio/client";

const connections = new Map();

async function connect(space) {
  if (!connections.has(space)) {
    const connection = Client.connect(space).catch(error => {
      connections.delete(space);
      throw error;
    });

    connections.set(space, connection);
  }

  return connections.get(space);
}

async function preparePersonImage(file) {
  const image = await createImageBitmap(file);

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = 1024;

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Image processing is unavailable.");
    }

    ctx.fillStyle = "#e3e3e3";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const scale = Math.min(
      canvas.width / image.width,
      canvas.height / image.height
    );

    const width = image.width * scale;
    const height = image.height * scale;

    ctx.drawImage(
      image,
      (canvas.width - width) / 2,
      (canvas.height - height) / 2,
      width,
      height
    );

    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        blob => blob
          ? resolve(blob)
          : reject(new Error("Could not prepare person photo.")),
        "image/png"
      );
    });
  } finally {
    image.close();
  }
}

function emptyMask() {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob
        ? resolve(blob)
        : reject(new Error("Could not create an automatic mask.")),
      "image/png"
    );
  });
}

function getImageUrl(result) {
  const first = result?.data?.[0];
  const url = typeof first === "string" ? first : first?.url;

  if (!url) {
    throw new Error("The AI service did not return an image.");
  }

  return url;
}

async function generateUpperBody(person, garment, description) {
  const client = await connect("yisol/IDM-VTON");

  const result = await client.predict("/tryon", {
    dict: {
      background: handle_file(person),
      layers: [],
      composite: null
    },
    garm_img: handle_file(garment),
    garment_des: description,
    is_checked: true,
    is_checked_crop: false,
    denoise_steps: 30,
    seed: Math.floor(Math.random() * 1000000)
  });

  return getImageUrl(result);
}

async function generateLowerBodyOrDress(person, garment, category) {
  const client = await connect("zhengchong/CatVTON");
  const api = await client.view_api();

  const endpoints = {
    ...(api.named_endpoints || {}),
    ...(api.unnamed_endpoints || {})
  };

  const matching = Object.entries(endpoints).find(
    ([, endpoint]) => {
      const labels = (endpoint.parameters || [])
        .map(parameter =>
          String(
            parameter.label ||
            parameter.parameter_name ||
            ""
          ).toLowerCase()
        )
        .join(" ");

      return (
        labels.includes("person image") &&
        labels.includes("condition image") &&
        labels.includes("try-on cloth type")
      );
    }
  );

  if (!matching) {
    throw new Error(
      "CatVTON's API is currently unavailable or has changed."
    );
  }

  const [endpoint] = matching;
  const mask = await emptyMask();

  const result = await client.predict(endpoint, [
    {
      background: handle_file(person),
      layers: [handle_file(mask)],
      composite: null
    },
    handle_file(garment),
    category === "bottom" ? "lower" : "overall",
    30,
    2.5,
    42,
    "result only"
  ]);

  return getImageUrl(result);
}

export async function generateTryOn({
  personImage,
  garmentImage,
  description = "",
  category = "top"
}) {
  if (!personImage || !garmentImage) {
    throw new Error("Person and garment photos are required.");
  }

  const type = String(category).toLowerCase();
  const person = await preparePersonImage(personImage);

  if (type === "top" || type === "outerwear") {
    return generateUpperBody(person, garmentImage, description);
  }

  if (type === "bottom" || type === "dress") {
    return generateLowerBodyOrDress(
      person,
      garmentImage,
      type
    );
  }

  throw new Error(
    `AI try-on for ${category} is not available with these models.`
  );
}
