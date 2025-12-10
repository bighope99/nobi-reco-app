import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background p-8">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-3xl font-bold text-primary-foreground">
          の
        </div>
        <h1 className="text-4xl font-bold text-foreground">のびレコ</h1>
        <p className="mt-2 text-muted-foreground">子どもの「のびしろ」を見える化する記録・評価アプリ</p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/login">ログイン</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/dashboard">施設ダッシュボード</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/admin">管理者ダッシュボード</Link>
        </Button>
      </div>
    </div>
  )
}
