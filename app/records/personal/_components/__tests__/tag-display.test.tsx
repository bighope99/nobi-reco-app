/**
 * タグ関連3チケットのテスト
 * - 32f092aa-b014-8048: タグの説明テキスト表示
 * - 32f092aa-b014-804d: 全選択ボタン削除
 * - 32f092aa-b014-80c2: タグに色をつける
 */
import { render, screen, waitFor } from "@testing-library/react"

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useSearchParams: () => ({ get: () => null }),
}))

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

jest.mock("@/lib/utils/timezone", () => ({
  getCurrentDateJST: () => "2026-03-26",
}))

jest.mock("@/lib/drafts/aiDraftCookie", () => ({
  loadAiDraftsFromCookie: () => [],
  markDraftAsSaved: jest.fn(),
}))

jest.mock("@/hooks/useUnsavedChanges", () => ({
  useUnsavedChanges: () => ({
    setHasChanges: jest.fn(),
    confirmNavigation: jest.fn().mockResolvedValue(true),
    UnsavedChangesDialog: () => null,
  }),
}))

jest.mock("@/lib/ai/childIdFormatter", () => ({
  replaceChildIdsWithNames: (text: string) => text,
  replaceChildNamesWithIds: (text: string) => text,
}))

jest.mock("@/components/ui/date-picker", () => ({
  DatePicker: () => <div data-testid="date-picker" />,
}))

jest.mock("@/components/ui/mention-textarea", () => ({
  MentionTextarea: (props: Record<string, unknown>) => <textarea data-testid={props.id as string} />,
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
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <button {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}>{children}</button>
  ),
}))

jest.mock("@/components/ui/badge", () => ({
  Badge: ({ children, style, className }: { children: React.ReactNode; style?: React.CSSProperties; className?: string; variant?: string }) => (
    <span data-testid="badge" style={style} className={className}>{children}</span>
  ),
}))

jest.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

jest.mock("@/components/ui/textarea", () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}))

jest.mock("@/components/ui/label", () => ({
  Label: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <label className={className}>{children}</label>
  ),
}))

jest.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({ checked, onCheckedChange, disabled }: { checked?: boolean; onCheckedChange?: (v: boolean) => void; disabled?: boolean }) => (
    <input type="checkbox" checked={checked} onChange={() => onCheckedChange?.(!checked)} disabled={disabled} data-testid="checkbox" />
  ),
}))

jest.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: React.ReactNode; value?: string; onValueChange?: (v: string) => void }) => (
    <div data-testid="select">{children}</div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode; value: string }) => <div>{children}</div>,
  SelectLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const MOCK_TAGS = [
  { id: "tag-1", name: "自立", description: "自分でできることが増える", color: "#4CAF50", sort_order: 1 },
  { id: "tag-2", name: "社会性", description: "友達と関わる力", color: "#2196F3", sort_order: 2 },
  { id: "tag-3", name: "好奇心", description: null, color: null, sort_order: 3 },
]

const MOCK_OBSERVATION = {
  id: "obs-1",
  child_id: "child-1",
  child_name: "テスト太郎",
  observation_date: "2026-03-25",
  content: "テスト観察記録",
  objective: "事実テキスト",
  subjective: "所感テキスト",
  tag_flags: { "tag-1": true, "tag-2": false, "tag-3": false },
  created_by: "user-1",
  created_by_name: "テスト職員",
  recorded_by: "user-1",
  recorded_by_name: "テスト職員",
  created_at: "2026-03-25T00:00:00Z",
  updated_at: "2026-03-25T00:00:00Z",
  is_ai_analyzed: true,
  recent_observations: [
    {
      id: "obs-0",
      observation_date: "2026-03-24",
      content: "前回の観察記録",
      created_at: "2026-03-24T00:00:00Z",
      recorded_by_name: "テスト職員",
      is_ai_analyzed: true,
      objective: "前回の事実",
      subjective: "前回の所感",
      tag_ids: ["tag-1"],
    },
  ],
  tag_ids: ["tag-1"],
}

const setupFetchMock = () => {
  ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
    if (typeof url === "string" && url.includes("/api/records/personal/tags")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: MOCK_TAGS }),
      } as Response)
    }
    if (typeof url === "string" && url.includes("/api/records/personal/obs-1")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: MOCK_OBSERVATION }),
      } as Response)
    }
    if (typeof url === "string" && url.includes("/api/children")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { children: [{ child_id: "child-1", name: "テスト太郎", class_name: "ひまわり" }] } }),
      } as Response)
    }
    if (typeof url === "string" && url.includes("/api/records/personal/child/")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [] }),
      } as Response)
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true, data: [] }),
    } as Response)
  })
}

global.fetch = jest.fn() as jest.Mock

import { ObservationEditor } from "../observation-editor"

describe("タグUI改善", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupFetchMock()
  })

  describe("全選択ボタンの削除 (#32f092aa-b014-804d)", () => {
    it("全選択・全解除ボタンが表示されないこと", async () => {
      render(<ObservationEditor mode="edit" observationId="obs-1" />)
      // Wait for tags to load and AI output section to render
      await waitFor(() => {
        expect(screen.getByText("非認知能力フラグ")).toBeInTheDocument()
      })
      expect(screen.queryByText("全選択")).not.toBeInTheDocument()
      expect(screen.queryByText("全解除")).not.toBeInTheDocument()
    })
  })

  describe("タグの説明テキスト表示 (#32f092aa-b014-8048)", () => {
    it("descriptionがあるタグの説明テキストが表示されること", async () => {
      render(<ObservationEditor mode="edit" observationId="obs-1" />)
      await waitFor(() => {
        expect(screen.getByText("自分でできることが増える")).toBeInTheDocument()
        expect(screen.getByText("友達と関わる力")).toBeInTheDocument()
      })
    })

    it("descriptionがnullのタグは説明テキストが表示されないこと", async () => {
      render(<ObservationEditor mode="edit" observationId="obs-1" />)
      await waitFor(() => {
        expect(screen.getByText("好奇心")).toBeInTheDocument()
      })
      const curiosityLabel = screen.getByText("好奇心").closest("label")
      expect(curiosityLabel?.querySelector(".text-gray-400")).toBeNull()
    })
  })

  describe("タグの色表示 (#32f092aa-b014-80c2)", () => {
    it("色が設定されたタグの枠にborderColorが適用されること", async () => {
      render(<ObservationEditor mode="edit" observationId="obs-1" />)
      await waitFor(() => {
        expect(screen.getAllByText("自立").length).toBeGreaterThanOrEqual(1)
      })
      const independenceLabel = screen.getAllByText("自立").find((el) => el.closest("label"))?.closest("label")
      expect(independenceLabel).toBeInTheDocument()
      expect((independenceLabel as HTMLElement)?.style.borderColor).toBe("rgb(76, 175, 80)")
    })

    it("色がnullのタグの枠にはデフォルトborderColorが適用されること", async () => {
      render(<ObservationEditor mode="edit" observationId="obs-1" />)
      await waitFor(() => {
        expect(screen.getByText("好奇心")).toBeInTheDocument()
      })
      const curiosityLabel = screen.getByText("好奇心").closest("label")
      expect(curiosityLabel).toBeInTheDocument()
      expect((curiosityLabel as HTMLElement)?.style.borderColor).toBe("rgb(229, 231, 235)")
    })

    it("過去の記録のBadgeにタグ色が反映されること", async () => {
      render(<ObservationEditor mode="edit" observationId="obs-1" />)
      await waitFor(() => {
        expect(screen.getByText("過去の記録（直近10件）")).toBeInTheDocument()
      })
      const badges = screen.getAllByTestId("badge")
      const recentBadge = badges.find((b) => b.textContent?.includes("自立") && b.closest(".divide-y"))
      expect(recentBadge).toBeDefined()
      if (recentBadge) {
        expect(recentBadge.style.color).toBe("rgb(76, 175, 80)")
        expect(recentBadge.style.borderColor).toBe("rgb(76, 175, 80)")
      }
    })
  })
})
