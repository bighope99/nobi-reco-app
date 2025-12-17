import { NextRequest, NextResponse } from 'next/server'

interface MentionSuggestion {
  child_id: string
  name: string
  kana: string
  nickname?: string
  grade?: string
  class_id?: string
  class_name?: string
  photo_url?: string | null
  display_name: string
  unique_key: string
}

const mockMentionSuggestions: MentionSuggestion[] = [
  {
    child_id: 'uuid-child-1',
    name: 'りゅうくん',
    kana: 'りゅう くん',
    nickname: 'リュー',
    grade: '年長',
    class_id: 'tanpopo',
    class_name: 'たんぽぽ組',
    photo_url: null,
    display_name: 'りゅうくん（たんぽぽ組）',
    unique_key: 'child-1-ryu-tanpopo',
  },
  {
    child_id: 'uuid-child-2',
    name: 'ひなちゃん',
    kana: 'ひな ちゃん',
    nickname: 'ひな',
    grade: '年少',
    class_id: 'tanpopo',
    class_name: 'たんぽぽ組',
    photo_url: null,
    display_name: 'ひなちゃん（たんぽぽ組）',
    unique_key: 'child-2-hina-tanpopo',
  },
  {
    child_id: 'uuid-child-3',
    name: '田中 陽翔',
    kana: 'たなか はると',
    nickname: 'はるくん',
    grade: '4年生',
    class_id: 'tanpopo',
    class_name: 'さくら組',
    photo_url: null,
    display_name: '田中 陽翔（4年生・さくら組）',
    unique_key: 'child-3-tanaka-haruto',
  },
]

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const classId = searchParams.get('class_id')
  const query = searchParams.get('query')?.trim() || ''
  const limit = Number(searchParams.get('limit')) || 20

  const normalizeText = (text: string) => text.toLocaleLowerCase('ja-JP').normalize('NFKC')

  if (!classId) {
    return NextResponse.json({ success: false, error: 'class_id is required' }, { status: 400 })
  }

  const filtered = mockMentionSuggestions.filter((child) => {
    const matchesClass = child.class_id ? child.class_id === classId : true
    if (!query) return matchesClass

    const normalizedQuery = normalizeText(query)
    const fieldsToSearch = [child.name, child.kana, child.nickname, child.display_name].filter(
      Boolean,
    ) as string[]
    return (
      matchesClass &&
      fieldsToSearch.some((field) => normalizeText(field).includes(normalizedQuery))
    )
  })

  return NextResponse.json({
    success: true,
    data: {
      suggestions: filtered.slice(0, limit),
    },
  })
}
