/**
 * #322092aa: セレクトが何も選択しない状態に戻せない
 * 記録者・クラスセレクトに未選択オプションが存在することを確認する
 */
import { render, screen } from "@testing-library/react"

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => ({ get: () => null }),
}))

jest.mock("@/hooks/useRole", () => ({
  useRole: () => ({ isFacilityAdmin: false, isAdmin: false }),
}))

jest.mock("@/hooks/useActivityTemplates", () => ({
  useActivityTemplates: () => ({
    templates: [],
    selectedTemplateId: "",
    setSelectedTemplateId: jest.fn(),
    applyTemplate: jest.fn(),
    deleteTemplate: jest.fn(),
    saveTemplate: jest.fn(),
    updateTemplate: jest.fn(),
    isDeleting: false,
    isSavingTemplate: false,
    isUpdatingTemplate: false,
    templateError: null,
  }),
}))

jest.mock("@/lib/utils/timezone", () => ({
  getCurrentDateJST: () => "2026-03-25",
}))

jest.mock("@/lib/drafts/aiDraftCookie", () => ({
  loadAiDraftsFromCookie: () => [],
  persistAiDraftsToCookie: jest.fn(),
}))

// fetch モック（クラスなし・スタッフあり）
global.fetch = jest.fn((url: string) => {
  if (url.includes("/api/children/classes")) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { classes: [] } }),
    } as Response)
  }
  if (url.includes("/api/users")) {
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: { users: [{ user_id: "u1", name: "田中太郎" }] },
        }),
    } as Response)
  }
  if (url.includes("/api/activities")) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { activities: [], total: 0, has_more: false } }),
    } as Response)
  }
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true, data: {} }),
  } as Response)
}) as jest.Mock

// UI コンポーネントの最低限モック
jest.mock("@/components/layout/staff-layout", () => ({
  StaffLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock("@/components/ui/select", () => ({
  Select: ({ children, value, onValueChange }: { children: React.ReactNode; value?: string; onValueChange?: (v: string) => void }) => (
    <div data-testid="select" data-value={value}>{children}</div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div data-testid="select-content">{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-testid={`select-item-${value}`}>{children}</div>
  ),
}))

jest.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <button {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}>{children}</button>
  ),
}))

jest.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

jest.mock("@/components/ui/textarea", () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}))

jest.mock("@/components/ui/label", () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}))

jest.mock("@/components/ui/time-picker", () => ({
  TimePicker: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input type="time" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}))

jest.mock("@/lib/ai/childIdFormatter", () => ({
  replaceChildIdsWithNames: (text: string) => text,
}))

jest.mock("@/lib/mention/mentionFormatter", () => ({
  convertToDisplayNames: (text: string) => text,
  convertToPlaceholders: (text: string) => text,
  buildNameToIdMap: () => new Map(),
}))

jest.mock("@/lib/security/sanitize", () => ({
  sanitizeText: (v: string) => v,
  sanitizeArrayFields: (v: unknown) => v,
  sanitizeObjectFields: (v: unknown) => v,
}))

jest.mock("@/lib/validation/activityValidation", () => ({
  MAX_EVENT_NAME_LENGTH: 100,
  MAX_SPECIAL_NOTES_LENGTH: 1000,
  MAX_HANDOVER_LENGTH: 1000,
  MAX_SNACK_LENGTH: 200,
  MAX_SCHEDULE_CONTENT_LENGTH: 200,
  MAX_ROLE_LENGTH: 50,
  MAX_MEAL_MENU_LENGTH: 200,
  MAX_MEAL_ITEMS_LENGTH: 200,
  MAX_MEAL_NOTES_LENGTH: 200,
  validateActivityFormSubmission: () => ({ valid: true }),
}))

jest.mock("@/lib/activity/sanitizeExtendedFields", () => ({
  getSanitizedExtendedFields: () => ({}),
}))

jest.mock("../components/previous-handover-banner", () => ({
  PreviousHandoverBanner: () => null,
}))

jest.mock("dompurify", () => ({
  sanitize: (html: string) => html,
}))

import ActivityRecordClient from "../activity-record-client"

describe("#322092aa セレクトクリア機能", () => {
  it("記録者セレクトに未選択オプションが存在する", async () => {
    render(<ActivityRecordClient />)
    // 未選択オプションの存在確認
    const noneItems = await screen.findAllByTestId("select-item-__none__")
    expect(noneItems.length).toBeGreaterThanOrEqual(1)
  })
})
