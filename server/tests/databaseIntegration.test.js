import { beforeAll, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import app from "../src/app.js";
import FitCheckVote from "../src/models/FitCheckVote.js";

const mongoUrl = process.env.TEST_MONGO_URI;
const integration = mongoUrl ? describe.sequential : describe.skip;
const secret = "capstone-mongodb-integration-tests-only-key";
const ownerId = "507f1f77bcf86cd799439121";
const voterId = "507f1f77bcf86cd799439122";
const strangerId = "507f1f77bcf86cd799439123";
const previousSecret = process.env.JWT_SECRET;
const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==", "base64");

const bearer = (id) =>
  `Bearer ${jwt.sign({ sub: id }, secret, { algorithm: "HS256", expiresIn: "1h" })}`;

integration("MongoDB-backed wardrobe, image and FitCheck flows", () => {
  let itemIds;
  let outfitIds;
  let pollId;

  beforeAll(async () => {
    process.env.JWT_SECRET = secret;
    // Force a disposable CI-only database, even when the URI names another DB.
    await mongoose.connect(mongoUrl, { dbName: "stylecircle_capstone_tests" });
    await mongoose.connection.db.dropDatabase();
    await FitCheckVote.init();

    itemIds = [];
    for (const name of ["White Shirt", "Black Jeans", "Blue Shirt", "Grey Trousers"]) {
      const category = /Shirt/.test(name) ? "top" : "bottom";
      const response = await request(app)
        .post("/api/clothing-items")
        .set("Authorization", bearer(ownerId))
        .send({ name, category, color: "Black" });
      expect(response.status).toBe(201);
      itemIds.push(response.body.item._id);
    }

    const photo = await request(app)
      .post(`/api/images/clothing/${itemIds[0]}`)
      .set("Authorization", bearer(ownerId))
      .attach("image", tinyPng, { filename: "shirt.png", contentType: "image/png" });
    expect(photo.status).toBe(200);

    outfitIds = [];
    for (const [name, ids] of [
      ["Casual Look", itemIds.slice(0, 2)],
      ["Smart Look", itemIds.slice(2)]
    ]) {
      const response = await request(app)
        .post("/api/outfits")
        .set("Authorization", bearer(ownerId))
        .send({ name, clothingItemIds: ids });
      expect(response.status).toBe(201);
      outfitIds.push(response.body.outfit._id);
    }

    const posted = await request(app)
      .post("/api/fitchecks")
      .set("Authorization", bearer(ownerId))
      .send({ question: "Which outfit is better?", outfitIds });
    expect(posted.status).toBe(201);
    pollId = posted.body.poll._id;
  }, 30000);

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.dropDatabase();
      await mongoose.disconnect();
    }
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  it("rejects missing and expired tokens and prevents cross-account access", async () => {
    const anonymous = await request(app).get("/api/clothing-items");
    expect(anonymous.status).toBe(401);

    const expired = jwt.sign({ sub: ownerId }, secret, { expiresIn: -1 });
    const invalid = await request(app)
      .get("/api/clothing-items")
      .set("Authorization", `Bearer ${expired}`);
    expect(invalid.status).toBe(401);

    const strangerRead = await request(app)
      .get(`/api/clothing-items/${itemIds[0]}`)
      .set("Authorization", bearer(strangerId));
    expect(strangerRead.status).toBe(404);

    const strangerDelete = await request(app)
      .delete(`/api/clothing-items/${itemIds[0]}`)
      .set("Authorization", bearer(strangerId));
    expect(strangerDelete.status).toBe(404);
  });

  it("validates uploaded bytes rather than trusting image file extensions", async () => {
    const invalid = await request(app)
      .post(`/api/images/clothing/${itemIds[0]}`)
      .set("Authorization", bearer(ownerId))
      .attach("image", Buffer.from("not a real PNG"), {
        filename: "fake.png", contentType: "image/png"
      });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error).toMatch(/Invalid image content/);
  });

  it("protects saved outfits from wardrobe deletion", async () => {
    const blocked = await request(app)
      .delete(`/api/clothing-items/${itemIds[0]}`)
      .set("Authorization", bearer(ownerId));
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toMatch(/saved outfit/);

    const outfitStillExists = await request(app)
      .get(`/api/outfits/${outfitIds[0]}`)
      .set("Authorization", bearer(ownerId));
    expect(outfitStillExists.status).toBe(200);
    expect(outfitStillExists.body.outfit.clothingItemIds).toHaveLength(2);
  });

  it("hides vote totals before voting, locks one vote, and enforces owner rules", async () => {
    const before = await request(app)
      .get("/api/fitchecks")
      .set("Authorization", bearer(voterId));
    const firstPoll = before.body.polls.find((poll) => poll._id === pollId);
    expect(firstPoll.canViewResults).toBe(false);
    expect(firstPoll.votes).toBeNull();

    const owner = await request(app)
      .get("/api/fitchecks")
      .set("Authorization", bearer(ownerId));
    expect(owner.body.polls.find((poll) => poll._id === pollId).canViewResults).toBe(true);

    const selfVote = await request(app)
      .put(`/api/fitchecks/${pollId}/vote`)
      .set("Authorization", bearer(ownerId))
      .send({ choice: "A" });
    expect(selfVote.status).toBe(403);

    const vote = await request(app)
      .put(`/api/fitchecks/${pollId}/vote`)
      .set("Authorization", bearer(voterId))
      .send({ choice: "A" });
    expect(vote.status).toBe(200);
    expect(vote.body.votes.A).toBe(1);

    const changed = await request(app)
      .put(`/api/fitchecks/${pollId}/vote`)
      .set("Authorization", bearer(voterId))
      .send({ choice: "B" });
    expect(changed.status).toBe(409);
    expect(await FitCheckVote.countDocuments({ fitCheckId: pollId, voterId })).toBe(1);

    const after = await request(app)
      .get("/api/fitchecks")
      .set("Authorization", bearer(voterId));
    const chosen = after.body.polls.find((poll) => poll._id === pollId);
    expect(chosen.votes.A).toBe(1);
    expect(chosen.myVote).toBe("A");
    expect(chosen.canViewResults).toBe(true);
  });

  it("retains shared FitCheck images after their saved outfit and clothing are removed", async () => {
    const removeOutfit = await request(app)
      .delete(`/api/outfits/${outfitIds[0]}`)
      .set("Authorization", bearer(ownerId));
    expect(removeOutfit.status).toBe(204);

    const removeClothing = await request(app)
      .delete(`/api/clothing-items/${itemIds[0]}`)
      .set("Authorization", bearer(ownerId));
    expect(removeClothing.status).toBe(204);

    const shared = await request(app)
      .get(`/api/images/fitcheck/${pollId}/A/0`)
      .set("Authorization", bearer(voterId));
    expect(shared.status).toBe(200);
    expect(shared.headers["content-type"]).toMatch(/image\/png/);
  });
});
