/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS local browser harness. */
const fs = require("fs");
const root = process.cwd();
const { createClient } = require(root + "/node_modules/@supabase/supabase-js");
const { createServerClient } = require(root + "/node_modules/@supabase/ssr");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const env = Object.fromEntries(
  fs.readFileSync(root + "/.env.development.local", "utf8").split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^['"]|['"]$/g, "")];
    }),
);
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(env.NEXT_PUBLIC_SUPABASE_URL)) {
  throw Error("Local only");
}
const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const email = "codex-coaching-b-browser@example.invalid";

(async () => {
  const link = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  let cookies = [];
  const client = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookies,
        setAll: (v) => {
          cookies = v;
        },
      },
    },
  );
  const auth = await client.auth.verifyOtp({
    token_hash: link.data.properties.hashed_token,
    type: "email",
  });
  if (auth.error) throw auth.error;
  const created = await client.rpc("create_coaching_plan", {
    p_title: "Review regression editor",
    p_discipline: "strength",
  });
  if (created.error) throw created.error;
  const id = created.data;
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    headless: true,
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    await context.addCookies(
      cookies.map((c) => ({
        name: c.name,
        value: c.value,
        url: "http://localhost:3000",
        sameSite: "Lax",
      })),
    );
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => {
      errors.push(e.message);
      console.log("PAGEERROR", e.message);
    });
    page.on("dialog", (d) => d.accept());
    page.on("console", (m) => {
      if (m.type() === "error") console.log("CONSOLE", m.text());
    });
    page.on(
      "requestfailed",
      (r) => console.log("REQUESTFAILED", r.url(), r.failure()),
    );
    await page.goto("http://localhost:3000/coaching/plans", {
      waitUntil: "domcontentloaded",
    });
    await page.locator('a[href="/coaching/plans/' + id + '"]').click();
    await page.getByRole("button", { name: "Details", exact: true }).click();
    await page.getByLabel("Title", { exact: true }).fill(
      "Recovered browser edits",
    );
    await page.getByText("Unsaved changes", { exact: true }).waitFor();
    await page.goBack({ waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Plans", exact: true }).waitFor();
    await page.goForward({ waitUntil: "load" });
    await page.waitForFunction(
      () => document.querySelector("[data-coaching-hydrated]"),
      null,
      { timeout: 10000 },
    ).catch(async (e) => {
      console.log(
        "HYDRATION",
        await page.evaluate(() => ({
          url: location.href,
          ready: document.readyState,
          body: document.body.innerText.slice(0, 1100),
          scripts: [...document.scripts].map((s) => s.src).filter(Boolean),
        })),
      );
      throw e;
    });
    await page.getByRole("button", { name: "Details", exact: true }).waitFor();
    if (
      await page.getByRole("button", {
        name: "Restore local edits",
        exact: true,
      }).isVisible()
    ) {
      await page.getByRole("button", {
        name: "Restore local edits",
        exact: true,
      }).click();
    }
    await page.getByRole("button", { name: "Details", exact: true }).click();
    console.log(
      "after forward",
      page.url(),
      (await page.locator("body").innerText()).slice(0, 1000),
    );
    if (
      await page.getByLabel("Title", { exact: true }).inputValue() !==
        "Recovered browser edits"
    ) throw Error("Recovery lost edits");
    console.log("recovery passed");
    const equipment = page.getByLabel("Required equipment (comma separated)", {
      exact: true,
    });
    await equipment.fill("");
    await equipment.pressSequentially("band, mat");
    const muscles = page.getByLabel("Target muscles (comma separated)", {
      exact: true,
    });
    await muscles.fill("");
    await muscles.pressSequentially("legs, core");
    if (
      await equipment.inputValue() !== "band, mat" ||
      await muscles.inputValue() !== "legs, core"
    ) throw Error("Comma typing regressed");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await page.getByText("Saved.", { exact: true }).waitFor();
    const savedDoc = await client.rpc("get_coaching_plan", { p_plan_id: id });
    if (JSON.stringify(savedDoc.data.required_equipment) !== '["band","mat"]') {
      throw Error("Comma values not saved");
    }
    const tab2 = await context.newPage();
    await tab2.goto(page.url(), { waitUntil: "domcontentloaded" });
    await tab2.getByRole("button", { name: "Details", exact: true }).click();
    await page.getByLabel("Title", { exact: true }).fill("Older local edits");
    await tab2.getByLabel("Title", { exact: true }).fill(
      "Newer tab saved work",
    );
    await tab2.getByRole("button", { name: "Save draft", exact: true }).click();
    await tab2.getByText("Saved.", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await page.getByText(/This plan changed in another tab/).waitFor().catch(
      async (e) => {
        console.log(
          "CONFLICT BODY",
          (await page.locator("body").innerText()).slice(-2200),
        );
        throw e;
      },
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Restore local edits", exact: true })
      .click();
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await page.getByText(/This plan changed in another tab/).waitFor().catch(
      async (e) => {
        console.log(
          "CONFLICT BODY",
          (await page.locator("body").innerText()).slice(-2200),
        );
        throw e;
      },
    );
    const protectedDoc = await client.rpc("get_coaching_plan", {
      p_plan_id: id,
    });
    if (protectedDoc.data.title !== "Newer tab saved work") {
      throw Error("Restore overwrote newer save");
    }
    await page.getByRole("button", {
      name: "Overwrite newer version",
      exact: true,
    }).click();
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await page.getByText("Saved.", { exact: true }).waitFor();
    const replacedDoc = await client.rpc("get_coaching_plan", {
      p_plan_id: id,
    });
    if (replacedDoc.data.title !== "Older local edits") {
      throw Error("Confirmed overwrite failed");
    }
    await tab2.close();
    console.log(
      "comma typing, persisted arrays, stale recovery protection and explicit overwrite passed",
    );
    await page.getByRole("button", { name: "Meals", exact: true }).click();
    await page.getByRole("button", { name: "Add meals", exact: true }).click();
    await page.getByRole("button", { name: "Add meal", exact: true }).click();
    await page.getByLabel("Calories", { exact: true }).nth(1).fill("600");
    await page.getByRole("button", {
      name: "Use meal totals for day",
      exact: true,
    }).click();
    await page.getByRole("alert").filter({
      hasText: "Add the remaining meals first",
    }).waitFor();
    if (
      await page.getByLabel("Calories", { exact: true }).first()
        .inputValue() !== "2000"
    ) throw Error("Invalid totals written");
    console.log("meal guard passed");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await page.getByText("Saved.", { exact: true }).waitFor();
    console.log("save passed");
    await page.getByRole("button", { name: "Details", exact: true }).click();
    await page.getByLabel("Title", { exact: true }).fill(
      "Session expiry preserves edits",
    );
    await context.clearCookies();
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await page.getByText(/Your session expired/).waitFor();
    if (!page.url().endsWith(id)) throw Error("Expiry redirected away");
    if (
      await page.getByLabel("Title", { exact: true }).inputValue() !==
        "Session expiry preserves edits"
    ) throw Error("Expiry lost edits");
    await context.addCookies(
      cookies.map((c) => ({
        name: c.name,
        value: c.value,
        url: "http://localhost:3000",
        sameSite: "Lax",
      })),
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Restore local edits", exact: true })
      .waitFor();
    const otherTab = await context.newPage();
    await otherTab.goto(page.url(), { waitUntil: "domcontentloaded" });
    await otherTab.waitForSelector("[data-coaching-hydrated]");
    await otherTab.evaluate(() =>
      sessionStorage.setItem("coaching-draft:signout-test", "old")
    );
    await page.getByRole("button", { name: "Sign out", exact: true }).first()
      .click();
    await page.waitForURL(/login/);
    if (
      await page.evaluate(() =>
        Object.keys(sessionStorage).some((k) => k.startsWith("coaching-draft:"))
      )
    ) throw Error("Signout retained recovery");
    await otherTab.waitForFunction(() =>
      !Object.keys(sessionStorage).some((k) => k.startsWith("coaching-draft:"))
    );
    console.log("signout clears recovery in both tabs passed");
    console.log(
      JSON.stringify({
        backForwardRecovery: true,
        mealLimitGuard: true,
        save: true,
        sessionExpiryPreserved: true,
        errors,
      }),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e.message || e);
  process.exitCode = 1;
});
