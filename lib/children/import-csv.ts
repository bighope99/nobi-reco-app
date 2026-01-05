import { ChildPayload } from '@/app/api/children/save/route';

export type CsvRow = Record<string, string>;

export type ImportDefaults = {
  school_id?: string | null;
  class_id?: string | null;
};

export type ImportPreviewRow = {
  row: number;
  family_name: string;
  given_name: string;
  birth_date: string;
  gender: string;
  enrollment_status: string;
  enrolled_at: string;
  parent_name: string;
  errors: string[];
};

const headerLabels = {
  family_name: '姓',
  given_name: '名',
  family_name_kana: 'セイ',
  given_name_kana: 'メイ',
  nickname: 'ニックネーム',
  gender: '性別',
  birth_date: '生年月日',
  enrollment_status: '入所状況',
  enrollment_type: '入所種別',
  enrolled_at: '入所日',
  withdrawn_at: '退所日',
  parent_name: '保護者氏名',
  parent_phone: '保護者電話',
  parent_email: '保護者メール',
  allergies: 'アレルギー',
  child_characteristics: '子どもの特性',
  parent_characteristics: '保護者の状況・要望',
  photo_permission_public: '写真公開許可',
  photo_permission_share: '写真共有許可',
  emergency_contact_1_name: '緊急連絡先1_氏名',
  emergency_contact_1_relation: '緊急連絡先1_続柄',
  emergency_contact_1_phone: '緊急連絡先1_電話',
  emergency_contact_2_name: '緊急連絡先2_氏名',
  emergency_contact_2_relation: '緊急連絡先2_続柄',
  emergency_contact_2_phone: '緊急連絡先2_電話',
} as const;

export function parseCsvText(text: string): { headers: string[]; rows: CsvRow[] } {
  const sanitized = text.startsWith('\ufeff') ? text.slice(1) : text;
  const records = parseCsvRecords(sanitized);

  if (records.length === 0) {
    return { headers: [], rows: [] };
  }

  const rawHeaders = records[0].map((value) => value.trim());
  const headers = rawHeaders.map((value) => value.replace(/^\ufeff/, '').trim());

  const rows = records.slice(1).map((record) => {
    const row: CsvRow = {};
    headers.forEach((header, index) => {
      row[header] = (record[index] ?? '').trim();
    });
    return row;
  });

  return { headers, rows };
}

export function buildChildPayload(
  row: CsvRow,
  defaults: ImportDefaults
): { payload?: ChildPayload; errors: string[] } {
  const errors: string[] = [];

  const familyName = getValue(row, headerLabels.family_name);
  const givenName = getValue(row, headerLabels.given_name);
  const birthDate = getValue(row, headerLabels.birth_date);
  const enrolledAt = getValue(row, headerLabels.enrolled_at);

  if (!familyName) errors.push('姓が未入力です');
  if (!givenName) errors.push('名が未入力です');
  if (!birthDate) errors.push('生年月日が未入力です');
  if (!enrolledAt) errors.push('入所日が未入力です');

  if (errors.length > 0) {
    return { errors };
  }

  const gender = normalizeGender(getValue(row, headerLabels.gender));
  const enrollmentStatus = normalizeEnrollmentStatus(
    getValue(row, headerLabels.enrollment_status)
  );
  const enrollmentType = normalizeEnrollmentType(
    getValue(row, headerLabels.enrollment_type)
  );

  const emergencyContacts = buildEmergencyContacts(row);

  const payload: ChildPayload = {
    basic_info: {
      family_name: familyName,
      given_name: givenName,
      family_name_kana: getValue(row, headerLabels.family_name_kana),
      given_name_kana: getValue(row, headerLabels.given_name_kana),
      nickname: getValue(row, headerLabels.nickname) || null,
      gender,
      birth_date: birthDate,
      school_id: defaults.school_id || null,
    },
    affiliation: {
      enrollment_status: enrollmentStatus,
      enrollment_type: enrollmentType,
      enrolled_at: enrolledAt,
      withdrawn_at: getValue(row, headerLabels.withdrawn_at) || null,
      class_id: defaults.class_id || null,
    },
    contact: {
      parent_name: getValue(row, headerLabels.parent_name) || undefined,
      parent_phone: getValue(row, headerLabels.parent_phone),
      parent_email: getValue(row, headerLabels.parent_email),
      emergency_contacts: emergencyContacts.length > 0 ? emergencyContacts : undefined,
    },
    care_info: {
      allergies: getValue(row, headerLabels.allergies) || null,
      child_characteristics: getValue(row, headerLabels.child_characteristics) || null,
      parent_characteristics: getValue(row, headerLabels.parent_characteristics) || null,
    },
    permissions: {
      photo_permission_public: parseBoolean(
        getValue(row, headerLabels.photo_permission_public),
        true
      ),
      photo_permission_share: parseBoolean(
        getValue(row, headerLabels.photo_permission_share),
        true
      ),
    },
  };

  return { payload, errors };
}

export function buildPreviewRow(
  row: CsvRow,
  rowNumber: number,
  payload: ChildPayload | undefined,
  errors: string[]
): ImportPreviewRow {
  const gender = payload?.basic_info?.gender ?? normalizeGender(getValue(row, headerLabels.gender));
  const enrollmentStatus =
    payload?.affiliation?.enrollment_status ??
    normalizeEnrollmentStatus(getValue(row, headerLabels.enrollment_status));

  return {
    row: rowNumber,
    family_name: payload?.basic_info?.family_name || getValue(row, headerLabels.family_name),
    given_name: payload?.basic_info?.given_name || getValue(row, headerLabels.given_name),
    birth_date: payload?.basic_info?.birth_date || getValue(row, headerLabels.birth_date),
    gender: formatGenderLabel(gender),
    enrollment_status: formatEnrollmentStatusLabel(enrollmentStatus),
    enrolled_at: payload?.affiliation?.enrolled_at || getValue(row, headerLabels.enrolled_at),
    parent_name: payload?.contact?.parent_name || getValue(row, headerLabels.parent_name),
    errors,
  };
}

export function normalizeGender(value: string): 'male' | 'female' | 'other' {
  const normalized = normalizeText(value);
  if (!normalized) return 'other';

  if (['female', 'femal', 'f', 'woman', 'women', '女', '女性', '女子'].includes(normalized)) {
    return 'female';
  }
  if (['male', 'mal', 'm', 'man', 'men', '男', '男性', '男子'].includes(normalized)) {
    return 'male';
  }
  return 'other';
}

export function normalizeEnrollmentStatus(value: string): 'enrolled' | 'withdrawn' | 'suspended' {
  const normalized = normalizeText(value);
  if (!normalized) return 'enrolled';
  if (['withdrawn', '退所', '退園'].includes(normalized)) return 'withdrawn';
  if (['suspended', '休所', '休園', '休所中', '休園中'].includes(normalized)) return 'suspended';
  if (['enrolled', '在籍', '在籍中'].includes(normalized)) return 'enrolled';
  return 'enrolled';
}

export function normalizeEnrollmentType(value: string): 'regular' | 'temporary' | 'spot' {
  const normalized = normalizeText(value);
  if (!normalized) return 'regular';
  if (['temporary', '一時', '一時利用'].includes(normalized)) return 'temporary';
  if (['spot', 'スポット', 'スポット利用'].includes(normalized)) return 'spot';
  if (['regular', '通常'].includes(normalized)) return 'regular';
  return 'regular';
}

export function formatGenderLabel(value: string): string {
  if (value === 'female') return '女';
  if (value === 'male') return '男';
  return 'その他';
}

export function formatEnrollmentStatusLabel(value: string): string {
  if (value === 'withdrawn') return '退所';
  if (value === 'suspended') return '休所';
  return '在籍中';
}

function buildEmergencyContacts(row: CsvRow) {
  const contacts: Array<{ name: string; relation: string; phone: string }> = [];
  const first = {
    name: getValue(row, headerLabels.emergency_contact_1_name),
    relation: getValue(row, headerLabels.emergency_contact_1_relation),
    phone: getValue(row, headerLabels.emergency_contact_1_phone),
  };
  const second = {
    name: getValue(row, headerLabels.emergency_contact_2_name),
    relation: getValue(row, headerLabels.emergency_contact_2_relation),
    phone: getValue(row, headerLabels.emergency_contact_2_phone),
  };

  if (first.name || first.phone) {
    contacts.push({ name: first.name, relation: first.relation, phone: first.phone });
  }
  if (second.name || second.phone) {
    contacts.push({ name: second.name, relation: second.relation, phone: second.phone });
  }
  return contacts;
}

function getValue(row: CsvRow, key: string): string {
  return row[key] ?? '';
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function parseBoolean(value: string, defaultValue: boolean): boolean {
  const normalized = normalizeText(value);
  if (!normalized) return defaultValue;
  if (['true', '1', 'yes', 'y', 'はい', '可', '○', 'ok', 'on'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'n', 'いいえ', '不可', '×', 'off'].includes(normalized)) {
    return false;
  }
  return defaultValue;
}

function parseCsvRecords(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentField);
      currentField = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i += 1;
      }
      currentRow.push(currentField);
      currentField = '';
      if (currentRow.some((value) => value.trim() !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      continue;
    }

    currentField += char;
  }

  currentRow.push(currentField);
  if (currentRow.some((value) => value.trim() !== '')) {
    rows.push(currentRow);
  }

  return rows;
}
