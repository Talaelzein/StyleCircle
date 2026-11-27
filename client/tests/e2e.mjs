import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
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
const accessibility = [];
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
  accessibility.push({
    page: label,
    violations: results.violations.map(v => ({
      id: v.id, impact: v.impact,
      nodes: v.nodes.map(node => ({ target: node.target, summary: node.failureSummary }))
    }))
  });
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

  async function goto(path) {
    await page.goto(FRONTEND + path, { waitUntil: "networkidle" });
  }

  async function createClothing(category, name) {
    await goto("/wardrobe/" + category);
    await page.getByRole("button", { name: "Add to this collection" }).click();
    const form = page.locator(".wardrobe-add-form");
    await form.getByLabel("Clothing name", { exact: true }).fill(name);
    await form.getByLabel("Category", { exact: true }).selectOption(category);
    await form.getByRole("button", { name: "+ Add clothing" }).click();
    const article = page.locator(".clothing-item").filter({
      has: page.getByRole("heading", { name, exact: true })
    });
    await article.waitFor();
    return article;
  }

  const originalName = "Browser E2E White Shirt";
  const shirtName = "Browser E2E Edited Shirt";
  const pantsName = "Browser E2E Black Jeans";
  let shirt = await createClothing("top", originalName);
  await shirt.getByRole("button", { name: "Edit", exact: true }).click();
  await shirt.getByLabel("Clothing name", { exact: true }).fill(shirtName);
  await shirt.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("heading", { name: shirtName, exact: true }).waitFor();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: shirtName, exact: true }).waitFor();
  await page.screenshot({ path: OUT + "/wardrobe-desktop.png", fullPage: true });
  await checkAccessibility("wardrobe-top");

  await createClothing("bottom", pantsName);
  await goto("/outfits");
  await page.getByLabel("Outfit Name").fill("Browser E2E Look A");
  await page.getByRole("checkbox", { name: "Select " + shirtName }).check();
  await page.getByRole("checkbox", { name: "Select " + pantsName }).check();
  await page.getByRole("button", { name: "Save Outfit", exact: true }).click();
  await page.getByRole("heading", { name: "Browser E2E Look A", exact: true }).waitFor();

  await page.getByLabel("Outfit Name").fill("Browser E2E Look B");
  await page.getByRole("checkbox", { name: "Select " + shirtName }).check();
  await page.getByRole("checkbox", { name: "Select " + pantsName }).check();
  await page.getByRole("button", { name: "Save Outfit", exact: true }).click();
  await page.getByRole("heading", { name: "Browser E2E Look B", exact: true }).waitFor();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Browser E2E Look A", exact: true }).waitFor();
  await checkAccessibility("outfits");
  await page.screenshot({ path: OUT + "/outfits-desktop.png", fullPage: true });

  // The UI must preserve saved-outfit references and display the API's 409 explanation.
  await goto("/wardrobe/top");
  shirt = page.locator(".clothing-item").filter({ has: page.getByRole("heading", { name: shirtName, exact: true }) });
  page.once("dialog", dialog => dialog.accept());
  await shirt.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "used in a saved outfit" }).waitFor();
  await shirt.waitFor();

  await goto("/fitchecks");
  const question = "Browser E2E Which look should I wear?";
  await page.getByLabel("Your question").fill(question);
  await page.getByLabel("Outfit A").selectOption({ label: "Browser E2E Look A" });
  await page.getByLabel("Outfit B").selectOption({ label: "Browser E2E Look B" });
  await page.getByRole("button", { name: "Post FitCheck" }).click();
  await page.getByRole("heading", { name: question, exact: true }).waitFor();
  const ownerPoll = page.locator(".fitcheck-card").filter({
    has: page.getByRole("heading", { name: question, exact: true })
  });
  assert.equal(await ownerPoll.getByRole("button", { name: /Vote for/ }).count(), 0);
  await checkAccessibility("fitchecks-owner");

  const voterContext = await browser.newContext();
  try {
    const voter = await voterContext.newPage();
    voter.on("pageerror", error => errors.push(error.message));
    await voter.goto(FRONTEND + "/signup");
    await voter.getByLabel("Username").fill("E2E Voter");
    await voter.getByLabel("Email").fill("stylecircle.voter." + Date.now() + "@example.com");
    await voter.getByLabel("Password").fill("TestOnlyPassword123!");
    await voter.getByRole("button", { name: "Sign Up" }).click();
    await voter.waitForURL("**/home");
    await voter.goto(FRONTEND + "/fitchecks");
    const poll = voter.locator(".fitcheck-card").filter({
      has: voter.getByRole("heading", { name: question, exact: true })
    });
    await poll.getByText("Vote to reveal the results.").first().waitFor();
    assert.equal(await poll.locator(".fitcheck-vote-results").count(), 0);
    await poll.getByRole("button", { name: "Vote for A" }).click();
    await poll.getByText("Your final vote: A").waitFor();
    assert.equal(await poll.getByRole("button", { name: /Vote for/ }).count(), 0);
    await voter.reload({ waitUntil: "networkidle" });
    await poll.getByText("Your final vote: A").waitFor();
    const voterIssues = await new AxeBuilder({ page: voter }).analyze();
    accessibility.push({ page: "fitchecks-voter", violations: voterIssues.violations.map(v => ({
      id: v.id, impact: v.impact, nodes: v.nodes.map(node => ({ target: node.target, summary: node.failureSummary }))
    })) });
  } finally {
    await voterContext.close();
  }

  // Additional mobile-view and accessibility inventory across all protected screens.
  const routes = ["/home", "/wardrobe", "/wardrobe/top", "/outfits", "/suggestions",
    "/fitchecks", "/planner", "/packing", "/wishlist", "/moodboards", "/insights", "/fitting-room"];
  const mobileWidths = [];
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of routes) {
    await goto(path);
    await page.locator("main").waitFor();
    await checkAccessibility("mobile-" + path);
    const viewport = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth
    }));
    mobileWidths.push({ path, ...viewport, overflow: viewport.documentWidth > viewport.viewportWidth + 2 });
    await page.screenshot({ path: OUT + "/" + path.slice(1).replaceAll("/", "-") + "-mobile.png", fullPage: true });
  }
  console.log("Mobile viewport inventory", JSON.stringify(mobileWidths));
  // Keep the original Home no-overflow requirement. Report all additional pages
  // in the artifact instead of silently claiming complete accessibility conformance.
  assert.equal(mobileWidths.find(v => v.path === "/home").overflow, false);

  // Demonstrate actual deletion after removing all references.
  await goto("/outfits");
  for (const name of ["Browser E2E Look A", "Browser E2E Look B"]) {
    const saved = page.locator("article").filter({ has: page.getByRole("heading", { name, exact: true }) });
    page.once("dialog", dialog => dialog.accept());
    await saved.getByRole("button", { name: "Delete", exact: true }).click();
    await saved.waitFor({ state: "detached" });
  }
  await goto("/wardrobe/top");
  shirt = page.locator(".clothing-item").filter({ has: page.getByRole("heading", { name: shirtName, exact: true }) });
  page.once("dialog", dialog => dialog.accept());
  await shirt.getByRole("button", { name: "Delete", exact: true }).click();
  await shirt.waitFor({ state: "detached" });
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.getByRole("heading", { name: shirtName, exact: true }).count(), 0);
  await page.getByRole("button", { name: "Log out", exact: true }).first().click();
  await page.waitForURL("**/login");
  await page.goto(FRONTEND + "/outfits");
  await page.waitForURL("**/login");

  await writeFile(OUT + "/mobile-inventory.json", JSON.stringify(mobileWidths, null, 2));
  assert.deepEqual(errors, [], "React must not throw uncaught browser errors");
  assert.equal(signupIssues.length, 0,
    "Signup has serious/critical accessibility violations: " + JSON.stringify(signupIssues.map(v => v.id)));
  assert.equal(homeIssues.length, 0,
    "Home has serious/critical accessibility violations: " + JSON.stringify(homeIssues.map(v => v.id)));
  console.log("Browser E2E PASS: signup, UI wardrobe CRUD, saved outfits, safe deletion, two-account final voting, reload, protected pages and mobile/accessibility inventory");
} finally {
  await writeFile(OUT + "/accessibility-inventory.json", JSON.stringify(accessibility, null, 2));
  await browser.close();
}
