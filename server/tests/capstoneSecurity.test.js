import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../src/app.js";

// These checks deliberately use no database, secrets or external AI calls.
// They verify that sensitive routes reject unauthenticated requests before
// reaching any data or third-party service.
describe("Capstone release security smoke checks", () => {
  const privateEndpoints = [
    ["get", "/api/auth/me"],
    ["get", "/api/clothing-items"],
    ["post", "/api/clothing-items"],
    ["get", "/api/outfits"],
    ["get", "/api/fitchecks"],
    ["get", "/api/entries?kind=plan"],
    ["get", "/api/images/clothing/507f1f77bcf86cd799439011"],
    ["post", "/api/suggestions/generate"],
    ["post", "/api/try-on"]
  ];

  for (const [method, route] of privateEndpoints) {
    it(`rejects anonymous ${method.toUpperCase()} ${route}`, async () => {
      const response = await request(app)[method](route);
      expect(response.status).toBe(401);
    });
  }

  it("rejects malformed signup fields with HTTP 400", async () => {
    const response = await request(app)
      .post("/api/auth/signup")
      .send({ username: "A", email: "not-an-email", password: "short" });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid input");
  });

  it("rejects malformed JSON instead of throwing an uncaught error", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email":');
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Malformed JSON body");
  });

  it("returns 404 JSON for unknown API routes", async () => {
    const response = await request(app).get("/api/does-not-exist");
    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Route not found");
  });
});
