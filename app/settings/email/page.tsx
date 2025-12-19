"use client"

import { useState } from "react"
import { Mail, Send } from "lucide-react"

import { StaffLayout } from "@/components/layout/staff-layout"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type SendResult = {
  type: "success" | "error"
  message: string
}

export default function EmailTestPage() {
  const [email, setEmail] = useState("")
  const [senderName, setSenderName] = useState("")
  const [text, setText] = useState("")
  const [status, setStatus] = useState<SendResult | null>(null)
  const [isSending, setIsSending] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSending(true)
    setStatus(null)

    try {
      const response = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senderName, text }),
      })

      const result = await response.json()

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "メール送信に失敗しました。")
      }

      setStatus({
        type: "success",
        message: "テストメールを送信しました。受信ボックスを確認してください。",
      })
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "予期せぬエラーが発生しました。",
      })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <StaffLayout title="メール送信テスト" subtitle="Resend経由で認証メールを試験送信">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>テストメール送信</CardTitle>
            <CardDescription>
              認証メールなどに使う送信設定をResendで確認します。送信元ドメインの設定と
              RESEND_API_KEY / RESEND_FROM_EMAIL の環境変数が整っていることを確認してください。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {status && (
              <div
                className={`rounded-lg border px-4 py-3 text-sm ${
                  status.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-destructive/30 bg-destructive/5 text-destructive"
                }`}
              >
                {status.message}
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">送信先メールアドレス</Label>
                <div className="relative">
                  <Mail className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="[email protected]"
                    className="pl-9"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  受信できるアドレスを入力してテスト送信してください。メールが届かない場合は送信元ドメインと環境変数を再確認してください。
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="senderName">送信者名（任意）</Label>
                <Input
                  id="senderName"
                  type="text"
                  value={senderName}
                  onChange={(event) => setSenderName(event.target.value)}
                  placeholder="のびレコ運営"
                />
                <p className="text-sm text-muted-foreground">
                  指定すると「送信者名 &lt;[email protected]&gt;」の形式で送信されます。
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="text">本文（任意）</Label>
                <textarea
                  id="text"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder="未入力の場合はテスト用の文面で送信します。"
                  className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
                <p className="text-sm text-muted-foreground">
                  未入力のときは接続確認用の定型文を送信します。
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={!email.trim() || isSending}>
                  <Send className="mr-2 h-4 w-4" />
                  {isSending ? "送信中..." : "テストメールを送る"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isSending && !status}
                  onClick={() => {
                    setEmail("")
                    setSenderName("")
                    setText("")
                    setStatus(null)
                  }}
                >
                  入力をクリア
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>送信内容</CardTitle>
            <CardDescription>テスト送信で使用する文面と設定のメモです。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div>
              <p className="font-semibold text-foreground">件名</p>
              <p>のびレコ メール送信テスト</p>
            </div>
            <div>
              <p className="font-semibold text-foreground">本文</p>
              <p>このメールはResendの接続確認用に送信されています。受信できたら設定完了です。</p>
            </div>
            <div>
              <p className="font-semibold text-foreground">環境変数</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <span className="font-semibold text-foreground">RESEND_API_KEY</span> - ResendのAPIキー
                </li>
                <li>
                  <span className="font-semibold text-foreground">RESEND_FROM_EMAIL</span> - 送信元メールアドレス
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </StaffLayout>
  )
}
