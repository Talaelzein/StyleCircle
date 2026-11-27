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
  if (serious.length) {
    console.log("axe-details", label, JSON.stringify(serious.map((issue) => ({
      rule: issue.id,
      affected: issue.nodes.slice(0, 18).map((node) => ({
        target: node.target,
        html: node.html.slice(0, 200),
        summary: node.failureSummary
      }))
    }))));
  }
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

  // Exercise real persisted outfits and FitCheck through the browser instead
  // of relying exclusively on direct API assertions.
  const bearer = { "Content-Type": "application/json", Authorization: "Bearer " + state.token };
  async function postJson(path, data, headers = bearer) {
    const response = await fetch(API + path, {
      method: "POST", headers, body: JSON.stringify(data)
    });
    const result = await response.json().catch(() => ({}));
    assert.equal(response.status, 201, "Expected 201 from " + path + ": " + JSON.stringify(result));
    return result;
  }

  const extras = [];
  for (const [name, category] of [
    ["Browser E2E Black Trousers", "bottom"],
    ["Browser E2E Blue Shirt", "top"],
    ["Browser E2E White Trainers", "shoes"]
  ]) {
    const next = await postJson("/api/clothing-items", { name, category });
    extras.push(next.item);
  }

  const outfitNames = ["Browser E2E Casual Look", "Browser E2E Smart Look"];
  const selectedPairs = [
    [item._id, extras[0]._id],
    [extras[1]._id, extras[2]._id]
  ];
  const savedOutfits = [];
  for (let i = 0; i < outfitNames.length; i += 1) {
    const saved = await postJson("/api/outfits", {
      name: outfitNames[i],
      clothingItemIds: selectedPairs[i]
    });
    savedOutfits.push(saved.outfit);
  }

  await page.goto(FRONTEND + "/outfits", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "My Saved Outfits" }).waitFor();
  for (const name of outfitNames) {
    await page.getByRole("heading", { name }).waitFor();
  }
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: outfitNames[0] }).waitFor();
  const outfitsIssues = await checkAccessibility("saved-outfits");

  await page.goto(FRONTEND + "/fitchecks", { waitUntil: "networkidle" });
  await page.getByLabel("Your question").fill("Which browser E2E look is better?");
  await page.getByLabel("Outfit A").selectOption(savedOutfits[0]._id);
  await page.getByLabel("Outfit B").selectOption(savedOutfits[1]._id);
  await page.getByRole("button", { name: "Post FitCheck" }).click();
  await page.getByText("Your FitCheck is now posted!").waitFor();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Which browser E2E look is better?" }).waitFor();
  const fitCheckIssues = await checkAccessibility("fitcheck-owner");

  // A second signed-in user must not see tallies until they vote.
  const voterContext = await browser.newContext({ viewport: { width: 1280, height: 850 } });
  const voterPage = await voterContext.newPage();
  const voterErrors = [];
  voterPage.on("pageerror", (error) => voterErrors.push(error.message));
  await voterPage.goto(FRONTEND + "/signup", { waitUntil: "networkidle" });
  await voterPage.getByLabel("Username").fill("E2E Voter");
  await voterPage.getByLabel("Email").fill("stylecircle.voter." + Date.now() + "@example.com");
  await voterPage.getByLabel("Password").fill("TestOnlyPassword123!");
  await voterPage.getByRole("button", { name: "Sign Up" }).click();
  await voterPage.waitForURL("**/home");
  await voterPage.goto(FRONTEND + "/fitchecks", { waitUntil: "networkidle" });
  await voterPage.getByRole("heading", { name: "Which browser E2E look is better?" }).waitFor();
  assert.equal(await voterPage.getByText("Vote to reveal the results.").count(), 2);
  await voterPage.getByRole("button", { name: "Vote for A" }).click();
  await voterPage.getByText("Your final vote: A").waitFor();
  assert.equal(await voterPage.getByRole("button", { name: "Vote for B" }).count(), 0);
  await voterPage.reload({ waitUntil: "networkidle" });
  await voterPage.getByText("Your final vote: A").waitFor();
  assert.deepEqual(voterErrors, [], "Voter must not see uncaught browser errors");
  const votingIssues = await new AxeBuilder({ page: voterPage }).analyze();
  const seriousVoterIssues = votingIssues.violations.filter(
    (issue) => ["serious", "critical"].includes(issue.impact)
  );

  // Deleting clothing that's still used in a saved outfit must be rejected.
  const deletion = await fetch(API + "/api/clothing-items/" + item._id, {
    method: "DELETE", headers: bearer
  });
  assert.equal(deletion.status, 409, "Saved outfit references must be preserved");

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

  // Check every principal feature in the actual mobile viewport. The
  // accessibility scan is applied to rendered pages, not static source code.
  for (const [route, label] of [
    ["/wardrobe", "closet"],
    ["/outfits", "outfit-builder"],
    ["/fitchecks", "community-polls"],
    ["/suggestions", "mix-and-match"],
    ["/planner", "planner"],
    ["/packing", "packing"],
    ["/wishlist", "wishlist"],
    ["/moodboards", "moodboards"],
    ["/insights", "insights"],
    ["/fitting-room", "ai-studio"]
  ]) {
    await page.goto(FRONTEND + route, { waitUntil: "networkidle" });
    await page.locator("main").first().waitFor();
    const findings = await checkAccessibility(label + "-mobile");
    assert.equal(findings.length, 0,
      label + " has serious/critical accessibility violations: " +
      JSON.stringify(findings.map((issue) => issue.id)));
    const overflow = await page.evaluate(() => ({
      fullWidth: document.documentElement.scrollWidth,
      viewport: window.innerWidth
    }));
    assert.ok(overflow.fullWidth <= overflow.viewport + 2,
      label + " horizontally overflows mobile width: " + JSON.stringify(overflow));
  }

  assert.deepEqual(errors, [], "React must not throw uncaught browser errors");
  assert.equal(signupIssues.length, 0,
    "Signup has serious/critical accessibility violations: " + JSON.stringify(signupIssues.map(v => v.id)));
  assert.equal(homeIssues.length, 0,
    "Home has serious/critical accessibility violations: " + JSON.stringify(homeIssues.map(v => v.id)));
  assert.equal(outfitsIssues.length, 0, "Saved Outfits has serious/critical accessibility violations");
  assert.equal(fitCheckIssues.length, 0, "FitCheck owner page has serious/critical accessibility violations");
  assert.equal(seriousVoterIssues.length, 0, "FitCheck voting page has serious/critical accessibility violations");
  console.log("Browser E2E PASS: two-user FitCheck, final voting, saved outfits, referential safety, refresh, mobile, accessibility, no uncaught errors");
} finally {
  await browser.close();
}
