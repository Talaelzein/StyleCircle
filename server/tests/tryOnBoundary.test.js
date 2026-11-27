import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

const provider = vi.hoisted(() => ({
  predict: vi.fn(),
  connect: vi.fn()
}));
vi.mock("@gradio/client", () => ({
  Client: { connect: provider.connect },
  handle_file: buffer => buffer
}));

import tryOnRoutes from "../src/routes/tryOnRoutes.js";

const app = express();
app.use("/api/try-on", tryOnRoutes);
const secret = "isolated-try-on-tests-only";
const user = "507f1f77bcf86cd799439011";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==", "base64");
const saved = { JWT_SECRET: process.env.JWT_SECRET, HF_TOKEN: process.env.HF_TOKEN };

function upload({ person = png, garment = png, category = "top", mime = "image/png" } = {}) {
  return request(app).post("/api/try-on")
    .set("Authorization", "Bearer " + jwt.sign({ sub: user }, secret, { expiresIn: "1h" }))
    .field("items", JSON.stringify([{ category, description: "Test garment" }]))
    .attach("person", person, { filename: "person.png", contentType: "image/png" })
    .attach("garments", garment, { filename: "garment.png", contentType: mime });
}

beforeAll(() => {
  process.env.JWT_SECRET = secret;
  process.env.HF_TOKEN = "hf_test_fake_never_external";
  provider.connect.mockResolvedValue({ predict: provider.predict });
});

afterAll(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("AI provider boundary (mocked external service)", () => {
  it("rejects spoofed person and garment image bytes before provider contact", async () => {
    expect((await upload({ person: Buffer.from("not an image") })).status).toBe(400);
    expect((await upload({ garment: Buffer.from("not an image") })).status).toBe(400);
    expect(provider.connect).not.toHaveBeenCalled();
  });

  it("rejects unsupported garment categories without contacting the provider", async () => {
    expect((await upload({ category: "shoes" })).status).toBe(400);
    expect(provider.connect).not.toHaveBeenCalled();
  });

  it("returns a result for a well-formed request and successful provider response", async () => {
    provider.predict.mockResolvedValueOnce({ data: [{ url: "https://example.com/generated.png" }] });
    const response = await upload();
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ url: "https://example.com/generated.png", appliedCategories: ["top"] });
    expect(provider.connect).toHaveBeenCalledWith("yisol/IDM-VTON", { token: "hf_test_fake_never_external" });
  });

  it("returns a user-friendly 429 when the external quota is exhausted", async () => {
    provider.predict.mockRejectedValueOnce(new Error("ZeroGPU quota exceeded"));
    const response = await upload();
    expect(response.status).toBe(429);
    expect(response.body.error).toMatch(/quota is exhausted/i);
  });

  it("returns a friendly failure and never discloses raw provider error details", async () => {
    provider.predict.mockRejectedValueOnce(new Error("Unexpected provider response hf_privateToken"));
    const response = await upload();
    expect(response.status).toBe(502);
    expect(response.body.error).not.toContain("hf_privateToken");
  });
});
