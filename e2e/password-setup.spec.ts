import { expect, test } from "@playwright/test";

test.describe("password setup", () => {
  test("shows an error when the link is missing", async ({ page }) => {
    await page.goto("/password/setup");
    await expect(page.getByText("リンクが無効です。再度メールからアクセスしてください。")).toBeVisible();
    await expect(page.getByRole("button", { name: "パスワードを設定する" })).toBeDisabled();
  });

  test("updates password and redirects to dashboard", async ({ page }) => {
    await page.route("**/auth/v1/verify**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "access-token",
          refresh_token: "refresh-token",
          token_type: "bearer",
          expires_in: 3600,
          user: {
            id: "user-1",
            email: "user@example.com",
          },
        }),
      });
    });

    await page.route("**/auth/v1/user**", async (route) => {
      const method = route.request().method().toUpperCase();
      if (method === "PUT" || method === "PATCH") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            user: {
              id: "user-1",
              email: "user@example.com",
            },
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto("/password/setup?token_hash=valid-token&type=invite");
    await expect(page.getByRole("heading", { name: "パスワード設定" })).toBeVisible();

    await page.getByLabel("新しいパスワード").fill("Test1234");
    await page.getByLabel("パスワード確認").fill("Test1234");
    await page.getByRole("button", { name: "パスワードを設定する" }).click();

    await page.waitForURL("**/dashboard");
  });
});
