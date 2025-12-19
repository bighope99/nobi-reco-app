"use client"

import { useState } from "react"
import { StaffLayout } from "@/components/layout/staff-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"

type FormState = {
  to: string
  cc: string
  bcc: string
  senderName: string
  subject: string
  htmlBody: string
  replyTo: string
}

type SendStatus =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "success"; message: string }
  | { type: "error"; message: string }

const splitRecipients = (value: string) =>
  value
    .split(/,|\n/)
    .map((text) => text.trim())
    .filter((text) => text.length > 0)

export default function EmailTestPage() {
  const [formState, setFormState] = useState<FormState>({
    to: "",
    cc: "",
    bcc: "",
    senderName: "のびレコ テスト送信",
    subject: "メール送信テスト",
    htmlBody: "<p>テスト送信です。</p>",
    replyTo: "",
  })
  const [status, setStatus] = useState<SendStatus>({ type: "idle" })

  const handleChange = (field: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormState((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus({ type: "loading" })

    try {
      const payload = {
        to: splitRecipients(formState.to),
        cc: splitRecipients(formState.cc),
        bcc: splitRecipients(formState.bcc),
        senderName: formState.senderName || undefined,
        subject: formState.subject,
        htmlBody: formState.htmlBody,
        replyTo: formState.replyTo || undefined,
      }

      const response = await fetch("/api/email_test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "送信に失敗しました")
      }

      setStatus({ type: "success", message: result?.message || "sent" })
    } catch (error) {
      const message = error instanceof Error ? error.message : "送信に失敗しました"
      setStatus({ type: "error", message })
    }
  }

  return (
    <StaffLayout title="メール送信テスト" subtitle="GAS経由のテスト送信APIを呼び出します">
      <Card>
        <CardHeader>
          <CardTitle>GAS メールAPI テスター</CardTitle>
          <CardDescription>
            本番利用は禁止のテスト用フォームです。宛先はカンマまたは改行区切りで入力してください。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="to">宛先 (必須)</Label>
                <Textarea
                  id="to"
                  placeholder="example@example.com"
                  value={formState.to}
                  onChange={handleChange("to")}
                  required
                />
                <p className="text-xs text-muted-foreground">カンマまたは改行で複数指定できます。</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cc">CC</Label>
                <Textarea
                  id="cc"
                  placeholder="cc@example.com"
                  value={formState.cc}
                  onChange={handleChange("cc")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bcc">BCC</Label>
                <Textarea
                  id="bcc"
                  placeholder="bcc@example.com"
                  value={formState.bcc}
                  onChange={handleChange("bcc")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="senderName">送信者名</Label>
                <Input
                  id="senderName"
                  placeholder="のびレコ"
                  value={formState.senderName}
                  onChange={handleChange("senderName")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">件名</Label>
                <Input
                  id="subject"
                  placeholder="件名を入力"
                  value={formState.subject}
                  onChange={handleChange("subject")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="replyTo">Reply-To</Label>
                <Input
                  id="replyTo"
                  placeholder="reply@example.com"
                  value={formState.replyTo}
                  onChange={handleChange("replyTo")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="htmlBody">本文 (HTML)</Label>
              <Textarea
                id="htmlBody"
                className="min-h-[160px]"
                placeholder="<p>本文</p>"
                value={formState.htmlBody}
                onChange={handleChange("htmlBody")}
                required
              />
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={status.type === "loading"}>
                {status.type === "loading" ? "送信中..." : "テスト送信"}
              </Button>
              {status.type === "success" && (
                <span className="text-sm text-green-600">送信完了: {status.message}</span>
              )}
              {status.type === "error" && (
                <span className="text-sm text-destructive">エラー: {status.message}</span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </StaffLayout>
  )
}
