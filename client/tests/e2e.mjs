import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const FRONTEND = "http://localhost:5173";
const API = "http://localhost:3000";
const OUT = "/tmp/stylecircle-browser";
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 850 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

async function checkAccessibility(label) {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((issue) =>
    ["serious", "critical"].includes(issue.impact)
  );
  console.log("axe", label, "total=", results.violations.length,
    "findings=", results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.length,
      targets: v.nodes.slice(0, 15).map((n) => n.target.join(", ")),
      suggestions: v.nodes.slice(0, 3).map((n) => n.failureSummary)
    }))
  );
  // Record findings before enforcing them. A11y is also audited manually.
  return serious;
}
try {
  await page.goto(FRONTEND + "/signup", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Create your account" }).waitFor();
  const signupIssues = await checkAccessibility("signup");

  const username = "E2E Tester";
  const email = "stylecircle.e2e." + Date.now() + "@example.com";
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("TestOnlyPassword123!");
  await page.getByRole("button", { name: "Sign Up" }).click();
  await page.waitForURL("**/home");
  await page.getByText("Welcome, E2E Tester.", { exact: false }).waitFor();
  const homeIssues = await checkAccessibility("home");
  await page.screenshot({ path: OUT + "/home-desktop.png", fullPage: true });

  const state = await page.evaluate(() => JSON.parse(sessionStorage.getItem("stylecircle_session")));
  assert.ok(state?.token, "Sign up should store an auth token");

  const create = await fetch(API + "/api/clothing-items", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + state.token
    },
    body: JSON.stringify({ name: "Browser E2E White Shirt", category: "top", color: "White" })
  });
  assert.equal(create.status, 201, "An authenticated user should be able to create wardrobe data");
  const item = (await create.json()).item;
  assert.ok(item?._id, "Created clothing item should have an ID");

  // A second item enables a complete browser-level saved-outfit flow.
  const secondCreate = await fetch(API + "/api/clothing-items", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + state.token
    },
    body: JSON.stringify({ name: "Browser E2E Black Jeans", category: "bottom", color: "Black" })
  });
  assert.equal(secondCreate.status, 201);
  const secondItem = (await secondCreate.json()).item;
  assert.ok(secondItem?._id);

  await page.goto(FRONTEND + "/wardrobe/top");
  await page.getByText("Browser E2E White Shirt").first().waitFor();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("Browser E2E White Shirt").first().waitFor();
  await page.screenshot({ path: OUT + "/wardrobe-desktop.png", fullPage: true });

  // Save a real outfit from the React UI; verify persistence after refresh.
  await page.goto(FRONTEND + "/outfits", { waitUntil: "networkidle" });
  await page.getByLabel("Outfit Name").fill("Browser E2E Casual Outfit");
  await page.getByRole("checkbox", { name: "Select Browser E2E White Shirt" }).check();
  await page.getByRole("checkbox", { name: "Select Browser E2E Black Jeans" }).check();
  await page.getByRole("button", { name: "Save Outfit" }).click();
  await page.getByText("Outfit saved successfully!").waitFor();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("Browser E2E Casual Outfit", { exact: true }).first().waitFor();
  await page.screenshot({ path: OUT + "/outfits-desktop.png", fullPage: true });

  const outfitsResponse = await fetch(API + "/api/outfits", {
    headers: { Authorization: "Bearer " + state.token }
  });
  assert.equal(outfitsResponse.status, 200);
  const outfits = (await outfitsResponse.json()).outfits;
  const firstOutfit = outfits.find((o) => o.name === "Browser E2E Casual Outfit");
  assert.ok(firstOutfit?._id, "The outfit created in React should exist in MongoDB");

  // The second outfit is generated through the API to keep UI creation
  // coverage focused, then FitCheck posting is exercised through React.
  const secondOutfitResponse = await fetch(API + "/api/outfits", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + state.token
    },
    body: JSON.stringify({
      name: "Browser E2E Smart Outfit",
      clothingItemIds: [item._id, secondItem._id]
    })
  });
  assert.equal(secondOutfitResponse.status, 201);
  const secondOutfit = (await secondOutfitResponse.json()).outfit;
  await page.goto(FRONTEND + "/fitchecks", { waitUntil: "networkidle" });
  await page.getByLabel("Your question").fill("Which outfit should I wear to university?");
  await page.getByLabel("Outfit A").selectOption(firstOutfit._id);
  await page.getByLabel("Outfit B").selectOption(secondOutfit._id);
  await page.getByRole("button", { name: "Post FitCheck" }).click();
  await page.getByText("Your FitCheck is now posted!").waitFor();
  await page.getByText("Which outfit should I wear to university?").first().waitFor();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("Which outfit should I wear to university?").first().waitFor();
  await page.screenshot({ path: OUT + "/fitcheck-desktop.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(FRONTEND + "/home");
  await page.getByText("Welcome, E2E Tester.", { exact: false }).waitFor();
  await page.screenshot({ path: OUT + "/home-mobile.png", fullPage: true });
  const viewport = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth
  }));
  assert.ok(viewport.documentWidth <= viewport.viewportWidth + 2,
    "Mobile page must not create horizontal page overflow: " + JSON.stringify(viewport));


  // Exercise EVERY authenticated route, not just the homepage and closet.
  // Check both desktop/mobile layouts, uncaught errors and high-risk
  // accessibility violations. This detects regressions across actual pages.
  const featureRoutes = [
    "/home", "/wardrobe", "/wardrobe/top", "/outfits",
    "/suggestions", "/fitchecks", "/planner", "/packing",
    "/wishlist", "/moodboards", "/insights", "/fitting-room"
  ];
  const violations = [];
  for (const route of featureRoutes) {
    await page.setViewportSize({ width: 1280, height: 850 });
    await page.goto(FRONTEND + route, { waitUntil: "networkidle" });
    await page.locator("main").first().waitFor();
    assert.ok(!page.url().endsWith("/login"),
      "Protected route unexpectedly redirected to login: " + route);
    const desktopIssues = await checkAccessibility(route + " desktop");
    violations.push(...desktopIssues.map(v => ({ route, width: 1280, id: v.id, impact: v.impact, nodes: v.nodes.length })));

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: "networkidle" });
    const dimensions = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth
    }));
    assert.ok(dimensions.documentWidth <= dimensions.viewportWidth + 2,
      "Mobile horizontal overflow on " + route + ": " + JSON.stringify(dimensions));
    const mobileIssues = await checkAccessibility(route + " mobile");
    violations.push(...mobileIssues.map(v => ({ route, width: 390, id: v.id, impact: v.impact, nodes: v.nodes.length })));
  }
  assert.deepEqual(violations, [],
    "Serious/critical accessibility violations on feature pages: " + JSON.stringify(violations));

  assert.deepEqual(errors, [], "React must not throw uncaught browser errors");
  assert.equal(signupIssues.length, 0,
    "Signup has serious/critical accessibility violations: " + JSON.stringify(signupIssues.map(v => v.id)));
  assert.equal(homeIssues.length, 0,
    "Home has serious/critical accessibility violations: " + JSON.stringify(homeIssues.map(v => v.id)));
  console.log("Browser E2E PASS: signup, wardrobe, React outfit save/refresh, React FitCheck post/refresh, all feature routes desktop/mobile, accessibility, no uncaught errors");
} finally {
  await browser.close();
}
