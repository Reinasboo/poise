import { expect, test } from "@playwright/test";

test("scenario setup requires consent and keeps local saving optional", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: /Big moments deserve thoughtful preparation/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Prepare for a moment" }).click();
  await expect(
    page.getByRole("heading", { name: "What are you preparing for?" }),
  ).toBeVisible();

  await page.getByRole("button", { name: /Presentation/ }).click();
  await page.getByLabel("Your personal objective").fill("Open with a clear idea");
  await page.getByLabel("Topic or short outline").fill("A short project overview");
  await page
    .getByRole("button", { name: /Continue to camera consent/ })
    .click();

  await expect(page.getByRole("heading", { name: "You’re in control." })).toBeVisible();
  await expect(
    page.getByText("Camera frames are not recorded or uploaded by Poise."),
  ).toBeVisible();
  await expect(
    page.getByText(/required Presage service communication/),
  ).toBeVisible();

  const consent = page.getByLabel(
    /I understand how camera sensing and session information are used/,
  );
  const saveLocally = page.getByLabel(
    /Save this session summary locally so I can review it later/,
  );
  const start = page.getByRole("button", { name: /Enable camera and check in/ });

  await expect(consent).not.toBeChecked();
  await expect(saveLocally).not.toBeChecked();
  await expect(start).toBeDisabled();
  await consent.check();
  await expect(start).toBeDisabled();
  await expect(saveLocally).not.toBeChecked();
});

test("privacy settings explain local data and telemetry behavior", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Privacy & data" }).click();

  await expect(
    page.getByRole("heading", { name: "Privacy, clearly." }),
  ).toBeVisible();
  await expect(
    page.getByText(/authentication and required SDK service communication still occur/i),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Delete all local Poise data" }),
  ).toBeVisible();
});

test("local SQLite summaries survive reload and can be deleted", async ({
  page,
}) => {
  await page.goto("/");
  const summary = {
    id: "persistence-e2e-session",
    kind: "interview",
    createdAt: 1_800_000_000_000,
    durationMs: 120_000,
    objective: "Practise a clear opening",
    practiceCompleted: true,
    baselinePulse: 72,
    recoveryPulse: 68,
    details: {
      baseline: {
        pulse: {
          metric: "pulse",
          value: 72,
          timestampUs: 1_800_000_000_000_000,
          confidence: 83,
          stable: true,
        },
      },
      recovery: {},
      talkingIntervals: [{ startedAt: 1_000, endedAt: 5_000 }],
      blinkCount: 2,
    },
    speakingIntervals: 1,
    pauses: 1,
    suggestion: "Try a short opening.",
  };

  const saved = await page.evaluate(async (entry) => {
    const { sessionStore } = await import("/src/services/sessionStore.ts");
    await sessionStore.save(entry);
    return sessionStore.list();
  }, summary);
  expect(saved).toHaveLength(1);
  expect(saved[0]?.id).toBe(summary.id);
  expect(saved[0]?.details.baseline.pulse?.confidence).toBe(83);

  await page.reload();
  const persisted = await page.evaluate(async () => {
    const { sessionStore } = await import("/src/services/sessionStore.ts");
    return sessionStore.list();
  });
  expect(persisted).toHaveLength(1);

  await page.evaluate(async (id) => {
    const { sessionStore } = await import("/src/services/sessionStore.ts");
    await sessionStore.delete(id);
  }, summary.id);
  const deleted = await page.evaluate(async () => {
    const { sessionStore } = await import("/src/services/sessionStore.ts");
    return sessionStore.list();
  });
  expect(deleted).toEqual([]);

  await page.evaluate(async (entry) => {
    const { sessionStore } = await import("/src/services/sessionStore.ts");
    await sessionStore.save(entry);
    await sessionStore.deleteAll();
  }, { ...summary, id: "delete-all-e2e-session" });
  const allDeleted = await page.evaluate(async () => {
    const { sessionStore } = await import("/src/services/sessionStore.ts");
    return sessionStore.list();
  });
  expect(allDeleted).toEqual([]);
});
