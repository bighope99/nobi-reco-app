"use client"

import { use, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AdminLayout } from "@/components/layout/admin-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export default function EditCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [company, setCompany] = useState<any>(null)
  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const fetchCompany = async () => {
      try {
        const response = await fetch(`/api/companies/${id}`)
        const result = await response.json()
        
        if (result.success) {
          const data = result.data
          setCompany(data)
          setName(data.name || "")
          setAddress(data.address || "")
          setPhone(data.phone || "")
          setEmail(data.email || "")
        } else {
          alert(`エラー: ${result.error}`)
        }
      } catch (error) {
        console.error('Company fetch error:', error)
        alert('会社情報の取得でエラーが発生しました')
      } finally {
        setIsLoading(false)
      }
    }

    fetchCompany()
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      alert('会社名を入力してください')
      return
    }

    setIsSubmitting(true)
    
    try {
      const response = await fetch(`/api/companies/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          address: address.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          status: company?.status || 'active',
        }),
      })

      const result = await response.json()
      
      if (result.success) {
        alert('✅ 会社情報を更新しました')
        router.push('/admin/companies')
      } else {
        alert(`❌ エラー: ${result.error}`)
      }
    } catch (error) {
      console.error('Company update error:', error)
      alert('会社情報の更新でエラーが発生しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    router.push('/admin/companies')
  }

  if (isLoading) {
    return (
      <AdminLayout title="会社編集">
        <p>読み込み中...</p>
      </AdminLayout>
    )
  }

  if (!company) {
    return (
      <AdminLayout title="会社編集">
        <p>会社が見つかりません</p>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="会社編集" subtitle={company.name}>
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>会社情報の編集</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="name">会社名</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">住所</Label>
                <Textarea 
                  id="address" 
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">電話番号</Label>
                <Input 
                  id="phone" 
                  type="tel" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">メールアドレス</Label>
                <Input 
                  id="email" 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? '保存中...' : '保存'}
                </Button>
                <Button type="button" variant="outline" onClick={handleCancel}>
                  キャンセル
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
