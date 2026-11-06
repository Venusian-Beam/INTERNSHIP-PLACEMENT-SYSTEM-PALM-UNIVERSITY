import { expect, type Page, test } from "@playwright/test";

const PASSWORD = "Placement2026!";
const MAILPIT = "http://127.0.0.1:8025";

/** Read the newest 6-digit sign-in code sent to an address (local Mailpit only). */
async function latestCode(email: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const r = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email} subject:"sign-in code"`)}&limit=1`);
    const j = (await r.json()) as { messages: { Subject: string }[] };
    const m = j.messages[0]?.Subject.match(/(\d{6})/);
    if (m) return m[1];
    await new Promise((res) => setTimeout(res, 250));
  }
  throw new Error(`No sign-in code for ${email}`);
}

/** SEC-07: a journey fails if the browser refuses anything under the page CSP (proves the nonce policy fits the app). */
const cspViolations = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const seen: string[] = [];
  cspViolations.set(page, seen);
  page.on("console", (msg) => {
    if (msg.type() === "error" && /Content Security Policy/i.test(msg.text())) seen.push(msg.text());
  });
});
test.afterEach(({ page }, info) => {
  if (info.title.startsWith("csp:")) return; // the injection test expects a violation
  expect(cspViolations.get(page) ?? []).toEqual([]);
});

async function clearMail() {
  await fetch(`${MAILPIT}/api/v1/messages`, { method: "DELETE" });
}

async function signIn(page: Page, email: string, withCode: boolean) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  if (withCode) {
    await expect(page.getByLabel("Sign-in code")).toBeVisible();
    await page.getByLabel("Sign-in code").fill(await latestCode(email));
    await page.getByRole("button", { name: "Verify code" }).click();
  }
  // Wait until signing in has finished (the session cookie is set), so the next navigation is authenticated.
  await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"));
}

async function signOut(page: Page) {
  await page.context().clearCookies();
}

test("core journey: President approves → staff send letters → student sees the letter", async ({ page }) => {
  await clearMail();

  // President: approve the template version waiting for review.
  await signIn(page, "president@careers.example", true);
  await expect(page.getByRole("heading", { name: "Letter template review" })).toBeVisible();
  await page.getByRole("button", { name: /Approve version 2/ }).click();
  await expect(page.getByText("Version 2 approved.")).toBeVisible();
  await signOut(page);

  // Staff: dashboard with work queues and insight charts.
  await signIn(page, "staff@careers.example", true);
  // The dashboard waits on several local API calls; the Windows dev server is slower than production.
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening), Kwabena/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Applications by programme" })).toBeVisible();
  await page.getByRole("button", { name: "Participation rate" }).click();
  await expect(page.getByText(/has the lowest participation/)).toBeVisible();

  // Letters: generate, preview, send with progress.
  await page.getByRole("link", { name: "Letters", exact: true }).click();
  await page.getByRole("button", { name: "Generate letters" }).click();
  await expect(page.getByText(/new letter\(s\) generated/)).toBeVisible();
  await expect(page.locator("iframe[title^='Preview of letter']")).toBeVisible();
  await expect(page.frameLocator("iframe[title^='Preview of letter']").getByText("Introduction of student", { exact: false })).toBeVisible();
  for (const name of ["Volta Telecom Ltd", "Korle Health Services"]) {
    await page.getByRole("checkbox", { name: `Select ${name}` }).check();
  }
  await page.getByRole("button", { name: "Send selected (2)" }).click();
  await expect(page.getByText("2 letter(s) sent.")).toBeVisible({ timeout: 60_000 });
  await page.getByRole("tab", { name: /Sent \(2\)/ }).click();
  await expect(page.getByText(/can't be changed/)).toBeVisible();
  await signOut(page);

  // Student: sees the letter was sent and the next step.
  await signIn(page, "ama.mensah@st.university.example", false);
  await expect(page.getByRole("region", { name: "Where you are" }).getByText("Letter sent")).toBeVisible();
  await expect(page.getByRole("link", { name: /Record Volta Telecom Ltd's reply/ })).toBeVisible();
});

test("access control in the browser: a student is kept out of staff pages", async ({ page }) => {
  await signIn(page, "kofi.boateng@st.university.example", false);
  await expect(page).toHaveURL(/\/student$/);
  await page.goto("/staff");
  await expect(page).toHaveURL(/\/student$/);
  await page.goto("/president");
  await expect(page).toHaveURL(/\/student$/);
  const r = await page.request.get("/api/proxy/staff/accounts");
  expect(r.status()).toBe(403);
});

test("csp: an injected inline event handler does not run (SEC-07)", async ({ page }) => {
  await page.goto("/sign-in");
  await page.evaluate(() => {
    const div = document.createElement("div");
    div.innerHTML = '<img src="data:," onerror="window.__xss = 1">';
    document.body.appendChild(div);
  });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  expect((cspViolations.get(page) ?? []).length).toBeGreaterThan(0);
});

test("dev: the sign-in code helper fills the emailed code (local development only)", async ({ page }) => {
  await clearMail();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("staff@careers.example");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("button", { name: "Fill in" }).click();
  await expect(page.getByLabel("Sign-in code")).toHaveValue(await latestCode("staff@careers.example"));
  await page.getByRole("button", { name: "Verify code" }).click();
  await expect(page).toHaveURL(/\/staff$/);
});

test("template upload: Head uploads a Word letter, places fields and the signature, President approves", async ({ page }) => {
  // Precondition: nothing waiting for the President (approve anything an earlier test left pending).
  await signIn(page, "president@careers.example", true);
  await expect(page.getByText(/Nothing is waiting for your approval|was sent by the Head/)).toBeVisible();
  const pending = page.getByRole("button", { name: /Approve version \d+/ });
  if (await pending.isVisible()) {
    await pending.click();
    await expect(page.getByText(/Version \d+ approved\./)).toBeVisible();
  }
  await signOut(page);

  // Head: upload the Word letter; it opens in the editor with the header logo and the {{reference}} field.
  await signIn(page, "head@careers.example", true);
  await page.goto("/staff/settings/template");
  await page.getByLabel("Letter template file").setInputFiles("e2e/fixtures/sample-letter.docx");
  await expect(page.getByText(/sample-letter\.docx is ready to edit/)).toBeVisible({ timeout: 30_000 });
  const doc = page.getByRole("textbox", { name: "Letter template" });
  await expect(doc.getByText("Reference no.")).toBeVisible();
  await expect(doc.getByRole("img", { name: "Letterhead" })).toBeVisible();

  // Replace the sample company with the Organisation name field.
  await doc.getByText("Volta Telecom Ltd").click({ clickCount: 3 });
  await page.getByRole("button", { name: "Insert field" }).click();
  await page.getByRole("menuitem", { name: /^Organisation name/ }).click();
  // Students table after the introduction; signature after "Yours faithfully,".
  await doc.getByText(/We write to introduce/).click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Insert field" }).click();
  await page.getByRole("menuitem", { name: /^Students table/ }).click();
  await doc.getByText("Yours faithfully,").click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Signature", exact: true }).click();

  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved.")).toBeVisible();
  await page.getByRole("button", { name: /Send version \d+ to the President/ }).click();
  await expect(page.getByText(/sent to the President for approval/)).toBeVisible();
  await signOut(page);

  // President: the uploaded letter, filled with sample data, with the Word letterhead; approve it.
  await signIn(page, "president@careers.example", true);
  const frame = page.frameLocator("iframe[title^='Template version']");
  await expect(frame.getByRole("img", { name: "Letterhead" })).toBeVisible();
  await expect(frame.getByText("Sample Organisation Ltd").first()).toBeVisible();
  await expect(frame.getByText("Student One")).toBeVisible();
  await page.getByRole("button", { name: /Approve version \d+/ }).click();
  await expect(page.getByText(/Version \d+ approved\./)).toBeVisible();
});
