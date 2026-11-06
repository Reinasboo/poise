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

test("camera-free practice can be completed and its saved reflection reopened", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Prepare for a moment" }).click();
  await page.getByLabel("Your personal objective").fill("Start with one clear idea");
  await page.getByRole("button", { name: /Continue to camera consent/ }).click();
  await page.getByLabel(
    /Save this session summary locally so I can review it later/,
  ).check();
  await expect(page.getByLabel(
    /I understand how camera sensing and session information are used/,
  )).not.toBeChecked();
  await expect(page.getByLabel("SmartSpectra API key")).toHaveValue("");
  await page.getByRole("button", { name: "Continue without camera" }).click();

  await expect(page.getByText(/Camera sensing is off/)).toBeVisible();
  await expect(page.getByLabel("Warm-up mode")).toBeVisible();
  await expect(page.getByRole("button", { name: "Guided" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".breath-orb")).toHaveCSS("transition-duration", "0s");
  await expect(page.getByText("Camera active")).toHaveCount(0);
  await page.getByRole("button", { name: "Enter the Stage" }).click();
  await expect(page.getByRole("heading", { name: "Take your time." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Camera off" })).toBeVisible();

  await page.getByRole("button", { name: "Finish rehearsal" }).click();
  await page.getByRole("button", { name: "Continue to reflection" }).click();
  await page.getByRole("button", { name: "Save locally and finish" }).click();
  await expect(page.getByRole("heading", { name: "You showed up for yourself." })).toBeVisible();
  await page.getByRole("button", { name: "My sessions" }).click();

  await page.getByRole("button", { name: "Review" }).click();
  await expect(
    page.getByRole("heading", { name: "A closer look at your session." }),
  ).toBeVisible();
  await expect(page.getByText("Start with one clear idea")).toBeVisible();
  await expect(page.getByText("Camera sensing was off; this session has no live measurements.")).toBeVisible();
  await expect(page.getByText("No valid compatible baseline and recovery pair was saved.")).toHaveCount(3);
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
      cameraSensingUsed: true,
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
  expect(saved[0]?.details.cameraSensingUsed).toBe(true);

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

  const legacySession = {
    ...summary,
    id: "legacy-session-without-sensing-marker",
    details: {
      baseline: {},
      recovery: {},
      talkingIntervals: [],
      blinkCount: 0,
    },
  };
  const legacyDetails = await page.evaluate(async (entry) => {
    const { sessionStore } = await import("/src/services/sessionStore.ts");
    await sessionStore.save(entry);
    return (await sessionStore.list()).find((item) => item.id === entry.id)?.details;
  }, legacySession);
  expect(legacyDetails?.cameraSensingUsed).toBeUndefined();

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
