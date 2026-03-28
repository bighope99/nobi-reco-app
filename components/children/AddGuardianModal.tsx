"use client"

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

interface AddGuardianModalProps {
  childId: string
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

const RELATIONSHIP_OPTIONS = ['母', '父', '祖母', '祖父', 'その他']

export function AddGuardianModal({ childId, open, onClose, onSuccess }: AddGuardianModalProps) {
  const [name, setName] = useState('')
  const [kana, setKana] = useState('')
  const [phone, setPhone] = useState('')
  const [relationship, setRelationship] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('氏名は必須です')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/guardians', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), kana: kana.trim(), phone: phone.trim(), relationship: relationship.trim() || '保護者', child_id: childId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '保護者の追加に失敗しました')
        return
      }
      // 成功: フォームリセットしてコールバック
      setName(''); setKana(''); setPhone(''); setRelationship('')
      onSuccess()
    } catch {
      setError('通信エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setName(''); setKana(''); setPhone(''); setRelationship(''); setError(null)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={open => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>保護者を追加</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="guardian-name">氏名 <span className="text-red-500">*</span></Label>
            <input
              id="guardian-name"
              className="mt-1 w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="例: 山田 花子"
              required
            />
          </div>
          <div>
            <Label htmlFor="guardian-kana">ふりがな</Label>
            <input
              id="guardian-kana"
              className="mt-1 w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              value={kana}
              onChange={e => setKana(e.target.value)}
              placeholder="例: やまだ はなこ"
            />
          </div>
          <div>
            <Label htmlFor="guardian-phone">電話番号</Label>
            <input
              id="guardian-phone"
              className="mt-1 w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="例: 090-1234-5678"
            />
          </div>
          <div>
            <Label htmlFor="guardian-relationship">続柄</Label>
            <input
              id="guardian-relationship"
              list="guardian-relationship-options"
              className="mt-1 w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              value={relationship}
              onChange={e => setRelationship(e.target.value)}
              placeholder="例: 母（自由入力可）"
              maxLength={50}
            />
            <datalist id="guardian-relationship-options">
              {RELATIONSHIP_OPTIONS.map(opt => <option key={opt} value={opt} />)}
            </datalist>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>キャンセル</Button>
            <Button type="submit" disabled={loading}>{loading ? '追加中...' : '追加'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
