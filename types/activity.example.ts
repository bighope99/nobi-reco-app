/**
 * 活動記録型の使用例
 *
 * このファイルは types/activity.ts で定義された型の使用方法を示します。
 */

import type {
  DailyScheduleItem,
  RoleAssignment,
  Meal,
  ActivityRecord,
} from './activity';

// 1日の流れの例
const exampleSchedule: DailyScheduleItem[] = [
  {
    time: '09:00',
    content: '朝の会',
  },
  {
    time: '10:00',
    content: '外遊び',
  },
  {
    time: '12:00',
    content: '昼食',
  },
  {
    time: '13:00',
    content: '自由時間',
  },
  {
    time: '15:00',
    content: 'おやつ',
  },
  {
    time: '16:00',
    content: '帰りの会',
  },
];

// 役割分担の例
const exampleRoles: RoleAssignment[] = [
  {
    user_id: '550e8400-e29b-41d4-a716-446655440000',
    user_name: '山田太郎',
    role: '主担当',
  },
  {
    user_id: '550e8400-e29b-41d4-a716-446655440001',
    user_name: '佐藤花子',
    role: '配膳',
  },
  {
    user_id: '550e8400-e29b-41d4-a716-446655440002',
    user_name: '鈴木次郎',
    role: '掃除',
  },
];

// ごはん情報の例
const exampleMeal: Meal = {
  menu: 'カレーライス',
  items_to_bring: 'フォーク、スプーン',
  notes: 'アレルギー対応済み',
};

// 完全な活動記録の例
const exampleActivity: ActivityRecord = {
  activity_id: '550e8400-e29b-41d4-a716-446655440003',
  facility_id: '550e8400-e29b-41d4-a716-446655440004',
  class_id: '550e8400-e29b-41d4-a716-446655440005',
  activity_date: '2026-01-13',
  title: '運動会の練習',
  content: '今日は運動会の練習をしました。かけっこと玉入れの練習を行いました。',
  snack: 'クッキー',
  photos: [
    {
      url: 'https://example.com/photo1.jpg',
      thumbnail_url: 'https://example.com/photo1_thumb.jpg',
      caption: '練習中の様子',
      file_id: 'file_123',
      file_path: 'facility-1/2026-01-13/photo1.jpg',
    },
  ],
  mentioned_children: [
    '550e8400-e29b-41d4-a716-446655440010',
    '550e8400-e29b-41d4-a716-446655440011',
  ],
  event_name: '運動会練習',
  daily_schedule: exampleSchedule,
  role_assignments: exampleRoles,
  special_notes: '天気がよく、子どもたちは元気いっぱいでした。',
  meal: exampleMeal,
  created_by: '550e8400-e29b-41d4-a716-446655440006',
  created_at: '2026-01-13T09:00:00Z',
  updated_at: '2026-01-13T16:00:00Z',
  deleted_at: null,
};

// API レスポンスでの使用例
interface ActivityApiResponse {
  success: boolean;
  data?: {
    activity: ActivityRecord;
  };
  error?: string;
}

// JSONからの型安全なパース例
function parseActivityFromJson(json: any): ActivityRecord | null {
  // 必須フィールドの検証
  if (
    !json.activity_id ||
    !json.facility_id ||
    !json.class_id ||
    !json.activity_date ||
    !json.title ||
    !json.content ||
    !json.created_by ||
    !json.created_at
  ) {
    return null;
  }

  // 拡張フィールドの検証
  const daily_schedule: DailyScheduleItem[] | undefined = Array.isArray(
    json.daily_schedule
  )
    ? json.daily_schedule.filter(
        (item: any) =>
          item &&
          typeof item.time === 'string' &&
          typeof item.content === 'string'
      )
    : undefined;

  const role_assignments: RoleAssignment[] | undefined = Array.isArray(
    json.role_assignments
  )
    ? json.role_assignments.filter(
        (item: any) =>
          item &&
          typeof item.user_id === 'string' &&
          typeof item.user_name === 'string' &&
          typeof item.role === 'string'
      )
    : undefined;

  const meal: Meal | undefined | null =
    json.meal && typeof json.meal.menu === 'string' ? json.meal : null;

  return {
    activity_id: json.activity_id,
    facility_id: json.facility_id,
    class_id: json.class_id,
    activity_date: json.activity_date,
    title: json.title,
    content: json.content,
    snack: json.snack ?? null,
    photos: json.photos ?? [],
    mentioned_children: json.mentioned_children ?? [],
    event_name: json.event_name ?? null,
    daily_schedule,
    role_assignments,
    special_notes: json.special_notes ?? null,
    meal,
    created_by: json.created_by,
    created_at: json.created_at,
    updated_at: json.updated_at,
    deleted_at: json.deleted_at ?? null,
  };
}

export {
  exampleSchedule,
  exampleRoles,
  exampleMeal,
  exampleActivity,
  parseActivityFromJson,
};
