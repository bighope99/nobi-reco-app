import { expect, test } from "@playwright/test";

const mockJson = async (page: any, url: string | RegExp, body: unknown) => {
  await page.route(url, async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
};

test.describe("page routes", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/fonts.googleapis.com/**", (route) => route.abort());
    await page.route("**/fonts.gstatic.com/**", (route) => route.abort());
  });

  test("loads /settings/schedules", async ({ page }) => {
    await mockJson(page, "**/api/schools", {
      success: true,
      data: { schools: [] },
    });

    await page.goto("/settings/schedules");
    await page.waitForResponse("**/api/schools");
    await expect(page.getByRole("main")).toBeVisible();
  });

  test("loads /settings/classes/:id", async ({ page }) => {
    await mockJson(page, "**/api/classes/class-1", {
      success: true,
      data: {
        class_id: "class-1",
        name: "Class A",
        age_group: "3 years",
        capacity: 20,
        room_number: "101",
        color_code: "#FF0000",
        display_order: 1,
        is_active: true,
        facility_id: "facility-1",
        facility_name: "Facility One",
        staff: [],
        children: [],
      },
    });
    await mockJson(page, "**/api/facilities", {
      success: true,
      data: { facilities: [{ facility_id: "facility-1", name: "Facility One" }] },
    });
    await mockJson(page, "**/api/users", {
      success: true,
      data: { users: [{ user_id: "user-1", name: "Teacher One", role: "staff" }] },
    });
    await mockJson(page, "**/api/children", {
      success: true,
      data: { children: [] },
    });

    await page.goto("/settings/classes/class-1");
    await page.waitForResponse("**/api/classes/class-1");
    await expect(page.getByRole("main")).toBeVisible();
  });

  test("loads /settings/facility/:id", async ({ page }) => {
    await mockJson(page, "**/api/facilities/facility-1", {
      success: true,
      data: {
        facility_id: "facility-1",
        name: "Facility One",
        address: "1 Test Street",
        phone: "000-0000-0000",
        email: "facility@example.com",
        postal_code: "000-0000",
        company_name: "Company One",
        current_children_count: 0,
        current_staff_count: 0,
        current_classes_count: 0,
      },
    });

    await page.goto("/settings/facility/facility-1");
    await page.waitForResponse("**/api/facilities/facility-1");
    await expect(page.getByRole("main")).toBeVisible();
  });

  test("loads /children/new", async ({ page }) => {
    await mockJson(page, "**/api/children/classes", {
      success: true,
      data: { classes: [] },
    });
    await mockJson(page, "**/api/schools", {
      success: true,
      data: { schools: [] },
    });

    await page.goto("/children/new");
    await page.waitForResponse("**/api/children/classes");
    await page.waitForResponse("**/api/schools");
    await expect(page.getByRole("main").first()).toBeVisible();
  });

  test("loads /attendance/list", async ({ page }) => {
    const attendanceListMatcher = /\/api\/attendance\/list\?date=.*/;
    await mockJson(page, attendanceListMatcher, {
      success: true,
      data: {
        date: "2024-01-01",
        weekday: "Mon",
        weekday_jp: "Mon",
        summary: {
          total_children: 0,
          present_count: 0,
          absent_count: 0,
          late_count: 0,
          not_checked_in_count: 0,
        },
        children: [],
        filters: { classes: [] },
      },
    });

    await page.goto("/attendance/list");
    await page.waitForResponse(attendanceListMatcher);
    await expect(page.getByRole("main")).toBeVisible();
  });

  test("loads /attendance/schedule", async ({ page }) => {
    await mockJson(page, "**/api/attendance/schedules", {
      success: true,
      data: { children: [], total: 0 },
    });

    await page.goto("/attendance/schedule");
    await page.waitForResponse("**/api/attendance/schedules");
    await expect(page.getByRole("main")).toBeVisible();
  });

  test("loads /records/status", async ({ page }) => {
    const recordsStatusMatcher = /\/api\/records\/status\?.*/;
    await mockJson(page, recordsStatusMatcher, {
      success: true,
      data: {
        period: {
          year: 2024,
          month: 1,
          start_date: "2024-01-01",
          end_date: "2024-01-31",
          days_in_month: 31,
        },
        children: [],
        summary: {
          total_children: 0,
          warning_children: 0,
          average_record_rate: 0,
        },
        filters: { classes: [] },
      },
    });

    await page.goto("/records/status");
    await page.waitForResponse(recordsStatusMatcher);
    await expect(page.getByRole("main").first()).toBeVisible();
  });

  test("loads /dashboard", async ({ page }) => {
    await mockJson(page, "**/api/dashboard/summary", {
      success: true,
      data: {
        current_time: "09:00",
        current_date: "2024-01-01",
        kpi: {
          scheduled_today: 0,
          present_now: 0,
          not_arrived: 0,
          checked_out: 0,
        },
        alerts: { overdue: [], late: [], unexpected: [] },
        attendance_list: [],
        record_support: [],
        filters: { classes: [] },
      },
    });

    await page.goto("/dashboard");
    await page.waitForResponse("**/api/dashboard/summary");
    await expect(page.getByRole("main")).toBeVisible();
  });
});

test.describe("save flows", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/fonts.googleapis.com/**", (route) => route.abort());
    await page.route("**/fonts.gstatic.com/**", (route) => route.abort());
  });

  test("saves schedule settings changes", async ({ page }) => {
    await mockJson(page, "**/api/schools", {
      success: true,
      data: {
        schools: [
          {
            school_id: "school-1",
            name: "School One",
            schedules: [
              {
                schedule_id: "schedule-1",
                grades: ["1"],
                weekday_times: {
                  monday: "08:00",
                  tuesday: "08:00",
                  wednesday: "08:00",
                  thursday: "08:00",
                  friday: "08:00",
                  saturday: null,
                  sunday: null,
                },
              },
            ],
          },
        ],
      },
    });

    let savePayload: any = null;
    await page.route("**/api/schools/schedules/bulk", async (route) => {
      savePayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { updated: 1 } }),
      });
    });

    await page.goto("/settings/schedules");
    await page.waitForResponse("**/api/schools");
    await page.getByRole("button", { name: /編集/ }).first().click();
    await page.getByRole("button", { name: /2年/ }).first().click();
    await page.getByRole("button", { name: /保存/ }).last().click();

    await expect.poll(() => savePayload).not.toBeNull();
    expect(savePayload.updates[0].schedule_id).toBe("schedule-1");
  });

  test("saves class detail updates", async ({ page }) => {
    let savePayload: any = null;
    await page.route("**/api/classes/class-1", async (route) => {
      const method = route.request().method().toUpperCase();
      if (method === "PUT") {
        savePayload = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            class_id: "class-1",
            name: "Class A",
            age_group: "3 years",
            capacity: 20,
            room_number: "101",
            color_code: "#FF0000",
            display_order: 1,
            is_active: true,
            facility_id: "facility-1",
            facility_name: "Facility One",
            staff: [],
            children: [],
          },
        }),
      });
    });
    await mockJson(page, "**/api/facilities", {
      success: true,
      data: { facilities: [{ facility_id: "facility-1", name: "Facility One" }] },
    });
    await mockJson(page, "**/api/users", {
      success: true,
      data: { users: [] },
    });
    await mockJson(page, "**/api/children", {
      success: true,
      data: { children: [] },
    });

    await page.goto("/settings/classes/class-1");
    await page.waitForResponse("**/api/classes/class-1");
    await page.locator("section").first().getByRole("textbox").first().fill("Class A Updated");
    await page.getByRole("button", { name: /保存/ }).last().click();

    await expect.poll(() => savePayload).not.toBeNull();
    expect(savePayload.name).toBe("Class A Updated");
  });

  test("saves facility detail updates", async ({ page }) => {
    let savePayload: any = null;
    await page.route("**/api/facilities/facility-1", async (route) => {
      const method = route.request().method().toUpperCase();
      if (method === "PUT") {
        savePayload = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, message: "ok" }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            facility_id: "facility-1",
            name: "Facility One",
            address: "1 Test Street",
            phone: "000-0000-0000",
            email: "facility@example.com",
            postal_code: "000-0000",
            company_name: "Company One",
            current_children_count: 0,
            current_staff_count: 0,
            current_classes_count: 0,
          },
        }),
      });
    });

    await page.goto("/settings/facility/facility-1");
    await page.waitForResponse("**/api/facilities/facility-1");
    await page.getByPlaceholder("03-1234-5678").fill("03-0000-0000");
    await page.getByRole("button", { name: /保存/ }).last().click();

    await expect.poll(() => savePayload).not.toBeNull();
    expect(savePayload.phone).toBe("03-0000-0000");
  });

  test("saves a new child registration", async ({ page }) => {
    await mockJson(page, "**/api/children/classes", {
      success: true,
      data: { classes: [] },
    });
    await mockJson(page, "**/api/schools", {
      success: true,
      data: { schools: [{ school_id: "school-1", name: "Test School" }] },
    });

    let savePayload: any = null;
    await page.route("**/api/children/save", async (route) => {
      savePayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto("/children/new");
    await page.waitForResponse("**/api/children/classes");
    await page.waitForResponse("**/api/schools");

    await page.getByPlaceholder("姓").fill("山田");
    await page.getByPlaceholder("名", { exact: true }).fill("太郎");
    await page.getByPlaceholder("年", { exact: true }).fill("2020");
    await page.getByPlaceholder("月", { exact: true }).fill("1");
    await page.getByPlaceholder("日", { exact: true }).fill("1");
    await page.locator("select").first().selectOption("school-1");
    await page.locator("input[type=\"date\"]").first().fill("2024-01-01");

    await page.getByRole("button", { name: /登録/ }).click();

    await expect.poll(() => savePayload).not.toBeNull();
    expect(savePayload.basic_info.family_name).toBe("山田");
  });

  test("updates attendance status from list", async ({ page }) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split("T")[0];
    const attendanceListMatcher = /\/api\/attendance\/list\?date=.*/;

    await mockJson(page, attendanceListMatcher, {
      success: true,
      data: {
        date: tomorrowDate,
        weekday: "Tue",
        weekday_jp: "火",
        summary: {
          total_children: 1,
          present_count: 0,
          absent_count: 1,
          late_count: 0,
          not_checked_in_count: 1,
        },
        children: [
          {
            child_id: "child-1",
            name: "Test Child",
            kana: "てすと",
            class_id: "class-1",
            class_name: "Class A",
            age_group: "3 years",
            grade: 3,
            grade_label: "年少",
            photo_url: null,
            status: "absent",
            is_expected: true,
            checked_in_at: null,
            checked_out_at: null,
            check_in_method: null,
            is_unexpected: false,
          },
        ],
        filters: {
          classes: [
            {
              class_id: "class-1",
              class_name: "Class A",
              present_count: 0,
              total_count: 1,
            },
          ],
        },
      },
    });

    let savePayload: any = null;
    await page.route("**/api/attendance/status", async (route) => {
      savePayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto("/attendance/list");
    await page.waitForResponse(attendanceListMatcher);
    await page.getByRole("button", { name: /欠席/ }).first().click();

    await expect.poll(() => savePayload).not.toBeNull();
    expect(savePayload.child_id).toBe("child-1");
  });

  test("saves attendance schedule changes", async ({ page }) => {
    await mockJson(page, "**/api/attendance/schedules", {
      success: true,
      data: {
        total: 1,
        children: [
          {
            child_id: "child-1",
            name: "Test Child",
            kana: "てすと",
            class_id: "class-1",
            class_name: "Class A",
            age_group: "3 years",
            grade: 3,
            grade_label: "年少",
            photo_url: null,
            schedule: {
              monday: true,
              tuesday: false,
              wednesday: false,
              thursday: false,
              friday: false,
              saturday: false,
              sunday: false,
            },
            updated_at: null,
          },
        ],
      },
    });

    let savePayload: any = null;
    await page.route("**/api/attendance/schedules/bulk-update", async (route) => {
      savePayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { updated_count: 1, failed_count: 0 },
        }),
      });
    });

    await page.goto("/attendance/schedule");
    await page.waitForResponse("**/api/attendance/schedules");
    await page.getByRole("button", { name: /編集/ }).click();
    await page.getByRole("checkbox").first().click();
    await page.getByRole("button", { name: /保存/ }).click();

    await expect.poll(() => savePayload).not.toBeNull();
    expect(savePayload.updates[0].child_id).toBe("child-1");
  });

  test("posts attendance actions from dashboard", async ({ page }) => {
    await mockJson(page, "**/api/dashboard/summary", {
      success: true,
      data: {
        current_time: "09:00",
        current_date: "2024-01-01",
        kpi: {
          scheduled_today: 1,
          present_now: 0,
          not_arrived: 1,
          checked_out: 0,
        },
        alerts: { overdue: [], late: [], unexpected: [] },
        attendance_list: [
          {
            child_id: "child-1",
            name: "Test Child",
            kana: "てすと",
            class_id: "class-1",
            class_name: "Class A",
            age_group: "3 years",
            grade: 3,
            grade_label: "年少",
            school_id: null,
            school_name: null,
            photo_url: null,
            status: "absent",
            is_scheduled_today: true,
            scheduled_start_time: "09:00",
            scheduled_end_time: "17:00",
            actual_in_time: null,
            actual_out_time: null,
            guardian_phone: "000-0000-0000",
            last_record_date: null,
            weekly_record_count: 0,
          },
        ],
        record_support: [],
        filters: { classes: [{ class_id: "class-1", class_name: "Class A" }] },
      },
    });

    let savePayload: any = null;
    await page.route("**/api/dashboard/attendance", async (route) => {
      savePayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto("/dashboard");
    await page.waitForResponse("**/api/dashboard/summary");
    await page.getByRole("button", { name: /登園/ }).first().click();

    await expect.poll(() => savePayload).not.toBeNull();
    expect(savePayload.action).toBe("check_in");
  });
});
