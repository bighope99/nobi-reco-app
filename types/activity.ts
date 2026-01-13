/**
 * 活動記録関連の型定義
 *
 * このファイルは活動記録（r_activity）テーブルの拡張フィールド用の型定義を提供します。
 * データベーススキーマ: 015_add_activity_extended_fields.sql
 */

/**
 * 活動写真の型
 */
export interface ActivityPhoto {
  url: string;
  caption?: string | null;
  thumbnail_url?: string | null;
  file_id?: string;
  file_path?: string;
}

/**
 * 1日の流れの項目
 *
 * @example
 * {
 *   time: "09:00",
 *   content: "朝の会"
 * }
 */
export interface DailyScheduleItem {
  /** 時刻（"09:00" 形式） */
  time: string;
  /** 活動内容（例: "朝の会", "外遊び"） */
  content: string;
}

/**
 * 役割分担
 *
 * @example
 * {
 *   user_id: "550e8400-e29b-41d4-a716-446655440000",
 *   user_name: "山田太郎",
 *   role: "主担当"
 * }
 */
export interface RoleAssignment {
  /** 職員ID（UUID） */
  user_id: string;
  /** 職員名（表示用キャッシュ） */
  user_name: string;
  /** 役割（例: "主担当", "配膳", "掃除"） */
  role: string;
}

/**
 * ごはん情報
 *
 * @example
 * {
 *   menu: "カレーライス",
 *   items_to_bring: "フォーク、スプーン",
 *   notes: "アレルギー対応済み"
 * }
 */
export interface Meal {
  /** メニュー名（例: "カレーライス"） */
  menu: string;
  /** 持ち物（オプション） */
  items_to_bring?: string;
  /** 備考（オプション） */
  notes?: string;
}

/**
 * 活動記録（拡張フィールド含む）
 *
 * r_activityテーブルの完全な型定義
 */
export interface ActivityRecord {
  /** 活動記録ID */
  activity_id: string;
  /** 施設ID */
  facility_id: string;
  /** クラスID */
  class_id: string;
  /** 活動日 */
  activity_date: string;
  /** タイトル */
  title: string;
  /** 活動内容 */
  content: string;
  /** おやつ情報 */
  snack?: string | null;
  /** 写真配列 */
  photos?: ActivityPhoto[];
  /** メンションされた児童のID配列 */
  mentioned_children?: string[];

  // 拡張フィールド
  /** 行事・イベント名（例: "運動会", "遠足"） */
  event_name?: string | null;
  /** 1日の流れ */
  daily_schedule?: DailyScheduleItem[];
  /** 役割分担 */
  role_assignments?: RoleAssignment[];
  /** 特記事項 */
  special_notes?: string | null;
  /** ごはん情報 */
  meal?: Meal | null;

  /** 作成者ID */
  created_by: string;
  /** 作成日時 */
  created_at: string;
  /** 更新日時 */
  updated_at?: string;
  /** 削除日時 */
  deleted_at?: string | null;
}
