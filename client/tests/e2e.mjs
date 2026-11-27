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
    "serious/critical=", serious.map((v) =>
      ({ id: v.id, impact: v.impact, nodes: v.nodes.length })
    )
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

  await page.goto(FRONTEND + "/wardrobe/top");
  await page.getByText("Browser E2E White Shirt").first().waitFor();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("Browser E2E White Shirt").first().waitFor();
  await page.screenshot({ path: OUT + "/wardrobe-desktop.png", fullPage: true });

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
  console.log("Browser E2E PASS: signup, database-backed wardrobe, refresh, all feature routes desktop/mobile, accessibility, no uncaught errors");
} finally {
  await browser.close();
}
