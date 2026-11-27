import { afterEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import request from "supertest";
import FitCheck from "../src/models/FitCheck.js";
import app from "../src/app.js";

const ownerId = "507f1f77bcf86cd799439011";
const otherUserId = "507f1f77bcf86cd799439012";
const pollId = "507f1f77bcf86cd799439013";
const secret = "capstone-test-only-random-key-1234567890";
const previousSecret = process.env.JWT_SECRET;

function bearer(userId) {
  process.env.JWT_SECRET = secret;
  const token = jwt.sign({ sub: userId }, secret, {
    algorithm: "HS256",
    expiresIn: "1h"
  });
  return `Bearer ${token}`;
}

afterEach(() => {
  vi.restoreAllMocks();
  if (previousSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = previousSecret;
  }
});

describe("FitCheck authorization", () => {
  it("rejects a validly authenticated poll owner's own vote", async () => {
    vi.spyOn(FitCheck, "findById").mockResolvedValue({
      _id: pollId,
      ownerId,
      status: "open"
    });

    const response = await request(app)
      .put(`/api/fitchecks/${pollId}/vote`)
      .set("Authorization", bearer(ownerId))
      .send({ choice: "A" });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("You cannot vote on your own FitCheck");
  });

  it("rejects voting on a closed poll", async () => {
    vi.spyOn(FitCheck, "findById").mockResolvedValue({
      _id: pollId,
      ownerId,
      status: "closed"
    });

    const response = await request(app)
      .put(`/api/fitchecks/${pollId}/vote`)
      .set("Authorization", bearer(otherUserId))
      .send({ choice: "B" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Voting is closed");
  });
});
