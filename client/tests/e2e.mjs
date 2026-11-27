import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const FRONTEND = "http://localhost:5173";
const API = "http://localhost:3000";
const OUT = "/tmp/stylecircle-browser";
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ownerContext = await browser.newContext({ viewport: { width: 1280, height: 850 } });
const page = await ownerContext.newPage();
const errors = [];
const auditResults = {};
page.on("pageerror", (error) => errors.push(error.message));

async function audit(target, name) {
  const results = await new AxeBuilder({ page: target }).analyze();
  auditResults[name] = results.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
  console.log("axe", name, "violations=", results.violations.length,
    "details=", JSON.stringify(results.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.slice(0, 18).map(n => ({ target: n.target, summary: n.failureSummary })) }))));
}

async function visit(target, path, name, { mobile = false } = {}) {
  await target.goto(FRONTEND + path, { waitUntil: "networkidle" });
  // Session restoration can briefly render a loading-only main with no h1.
  // Wait for the actual route before running axe so findings are actionable.
  await target.locator("main.app-loading").waitFor({ state: "hidden", timeout: 20000 });
  await target.locator("main").first().waitFor({ state: "visible" });
  await audit(target, name);
  const widths = await target.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth
  }));
  if (mobile) {
    assert.ok(widths.documentWidth <= widths.viewportWidth + 2,
      name + " must not overflow a mobile viewport: " + JSON.stringify(widths));
  }
  await target.screenshot({
    path: OUT + "/" + name.replace(/[^a-z0-9_-]/gi, "-") + ".png",
    fullPage: true
  });
}

async function api(token, path, options = {}) {
  const response = await fetch(API + path, {
    ...options,
    headers: {
      Authorization: "Bearer " + token,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });
  const data = response.status === 204 ? {} : await response.json();
  assert.ok(response.ok, "API " + path + " failed: " + JSON.stringify(data));
  return data;
}

async function makeItem(token, name, category) {
  return (await api(token, "/api/clothing-items", {
    method: "POST",
    body: JSON.stringify({ name, category, color: category === "top" ? "White" : "Black" })
  })).item;
}

try {
  await visit(page, "/signup", "signup-desktop");
  const stamp = Date.now();
  await page.getByLabel("Username").fill("E2E Tester");
  await page.getByLabel("Email").fill("stylecircle.owner." + stamp + "@example.com");
  await page.getByLabel("Password").fill("TestOnlyPassword123!");
  await page.getByRole("button", { name: "Sign Up" }).click();
  await page.waitForURL("**/home");
  await page.getByText("Welcome, E2E Tester.", { exact: false }).waitFor();
  await audit(page, "home-desktop");
  await page.screenshot({ path: OUT + "/home-desktop.png", fullPage: true });

  const state = await page.evaluate(() => JSON.parse(sessionStorage.getItem("stylecircle_session")));
  assert.ok(state?.token, "Sign up must store an auth token");
  const token = state.token;

  const [top1, bottom1, top2, bottom2] = await Promise.all([
    makeItem(token, "E2E White Shirt", "top"),
    makeItem(token, "E2E Black Jeans", "bottom"),
    makeItem(token, "E2E Blue Shirt", "top"),
    makeItem(token, "E2E Grey Trousers", "bottom")
  ]);

  await visit(page, "/wardrobe/top", "wardrobe-desktop");
  await page.getByText("E2E White Shirt").first().waitFor();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("E2E White Shirt").first().waitFor();

  await visit(page, "/outfits", "outfit-builder-desktop");
  for (const [title, first, second] of [
    ["E2E Casual Look", top1.name, bottom1.name],
    ["E2E Formal Look", top2.name, bottom2.name]
  ]) {
    await page.getByLabel("Outfit Name").fill(title);
    await page.getByRole("checkbox", { name: "Select " + first }).check();
    await page.getByRole("checkbox", { name: "Select " + second }).check();
    await page.getByRole("button", { name: "Save Outfit" }).click();
    await page.getByText("Outfit saved successfully!").waitFor();
    await page.getByRole("heading", { name: title }).waitFor();
  }
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "E2E Casual Look" }).waitFor();
  await page.getByRole("heading", { name: "E2E Formal Look" }).waitFor();

  await visit(page, "/fitchecks", "fitcheck-owner-desktop");
  await page.getByLabel("Your question").fill("E2E Which outfit wins?");
  await page.getByLabel("Outfit A").selectOption({ label: "E2E Casual Look" });
  await page.getByLabel("Outfit B").selectOption({ label: "E2E Formal Look" });
  await page.getByRole("button", { name: "Post FitCheck" }).click();
  await page.getByText("Your FitCheck is now posted!").waitFor();

  const otherContext = await browser.newContext({ viewport: { width: 1280, height: 850 } });
  const voter = await otherContext.newPage();
  voter.on("pageerror", (error) => errors.push("voter: " + error.message));
  await voter.goto(FRONTEND + "/signup", { waitUntil: "networkidle" });
  await voter.getByLabel("Username").fill("E2E Voter");
  await voter.getByLabel("Email").fill("stylecircle.voter." + stamp + "@example.com");
  await voter.getByLabel("Password").fill("TestOnlyPassword123!");
  await voter.getByRole("button", { name: "Sign Up" }).click();
  await voter.waitForURL("**/home");
  await visit(voter, "/fitchecks", "fitcheck-voter-desktop");
  await voter.getByText("E2E Which outfit wins?").waitFor();
  assert.ok(await voter.getByText("Vote to reveal the results.").count() >= 1,
    "Votes must be hidden before participation");
  await voter.getByRole("button", { name: "Vote for A" }).first().click();
  await voter.getByText("Your final vote: A").waitFor();
  assert.equal(await voter.getByRole("button", { name: "Vote for B" }).count(), 0,
    "A user must not be offered a second vote after voting");

  // All principal routes should remain accessible and free of critical a11y
  // violations after auth, not just the home and signup pages.
  const otherRoutes = [
    ["/suggestions", "suggestions-desktop"],
    ["/planner", "planner-desktop"],
    ["/packing", "packing-desktop"],
    ["/wishlist", "wishlist-desktop"],
    ["/moodboards", "moodboards-desktop"],
    ["/insights", "insights-desktop"],
    ["/fitting-room", "ai-studio-desktop"]
  ];
  for (const [route, name] of otherRoutes) {
    await visit(page, route, name);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileRoutes = [
    ["/home", "home-mobile"],
    ["/wardrobe/top", "wardrobe-mobile"],
    ["/outfits", "outfits-mobile"],
    ["/fitchecks", "fitcheck-mobile"],
    ["/fitting-room", "ai-studio-mobile"]
  ];
  for (const [route, name] of mobileRoutes) {
    await visit(page, route, name, { mobile: true });
  }

  const findings = Object.entries(auditResults)
    .filter(([, issues]) => issues.length > 0)
    .map(([name, issues]) => ({ name, issues }));
  assert.deepEqual(errors, [], "The browser must not throw uncaught JavaScript errors");
  assert.deepEqual(findings, [],
    "All tested routes must have zero axe accessibility violations");
  await otherContext.close();
  console.log("Browser E2E PASS: signup, closet persistence, saved outfits, FitCheck voting, all major routes, mobile, accessibility");
} finally {
  await ownerContext.close();
  await browser.close();
}
