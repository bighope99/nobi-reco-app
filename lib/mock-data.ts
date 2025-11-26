// モックデータ - 開発用

export const mockChildren = [
  { id: "1", name: "田中 太郎", className: "うさぎ組", age: 5, status: "present" },
  { id: "2", name: "鈴木 花子", className: "うさぎ組", age: 5, status: "present" },
  { id: "3", name: "佐藤 健太", className: "くま組", age: 4, status: "absent" },
  { id: "4", name: "山田 美咲", className: "くま組", age: 4, status: "present" },
  { id: "5", name: "高橋 翔太", className: "ぞう組", age: 6, status: "present" },
  { id: "6", name: "伊藤 さくら", className: "ぞう組", age: 6, status: "late" },
]

export const mockClasses = [
  { id: "1", name: "うさぎ組", childrenCount: 15 },
  { id: "2", name: "くま組", childrenCount: 12 },
  { id: "3", name: "ぞう組", childrenCount: 18 },
]

export const mockStaff = [
  { id: "1", name: "山本 先生", role: "admin", email: "yamamoto@example.com" },
  { id: "2", name: "中村 先生", role: "staff", email: "nakamura@example.com" },
  { id: "3", name: "小林 先生", role: "staff", email: "kobayashi@example.com" },
]

export const mockCompanies = [
  { id: "1", name: "株式会社 ひまわり保育園", facilitiesCount: 3 },
  { id: "2", name: "社会福祉法人 たんぽぽ", facilitiesCount: 5 },
  { id: "3", name: "NPO法人 あおぞら", facilitiesCount: 2 },
]

export const mockFacilities = [
  { id: "1", name: "ひまわり保育園 本園", companyId: "1", childrenCount: 45 },
  { id: "2", name: "ひまわり保育園 分園", companyId: "1", childrenCount: 30 },
  { id: "3", name: "たんぽぽ学童クラブ", companyId: "2", childrenCount: 25 },
]

export const mockRecords = [
  {
    id: "1",
    childId: "1",
    date: "2024-01-15",
    type: "observation",
    content: "今日は積み木で高い塔を作っていました。集中力がついてきています。",
  },
  { id: "2", childId: "1", date: "2024-01-15", type: "voice", content: "「明日もこれ作りたい！」" },
  { id: "3", childId: "2", date: "2024-01-15", type: "observation", content: "お友達と協力して絵を描いていました。" },
]

export const mockActivities = [
  { id: "1", date: "2024-01-15", title: "外遊び", content: "園庭で鬼ごっこや砂場遊びを行いました。" },
  { id: "2", date: "2024-01-15", title: "製作活動", content: "折り紙でお花を作りました。" },
]
