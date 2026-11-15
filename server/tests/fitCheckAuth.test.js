
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app.js";

describe("FitCheck authentication", () => {
  it("requires login to view polls", async () => {
    const response = await request(app)
      .get("/api/fitchecks");

    expect(response.status).toBe(401);
  });

  it("requires login to create a poll", async () => {
    const response = await request(app)
      .post("/api/fitchecks")
      .send({
        question: "Which outfit is better?",
        outfitIds: [
          "507f1f77bcf86cd799439011",
          "507f1f77bcf86cd799439012"
        ]
      });

    expect(response.status).toBe(401);
  });

  it("requires login to vote", async () => {
    const response = await request(app)
      .put(
        "/api/fitchecks/507f1f77bcf86cd799439011/vote"
      )
      .send({ choice: "A" });

    expect(response.status).toBe(401);
  });
});
