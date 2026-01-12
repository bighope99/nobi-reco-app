const header = [
  '姓',
  '名',
  'セイ',
  'メイ',
  'ニックネーム',
  '性別',
  '生年月日',
  '入所種別(通年、一時、スポット)',
  '入所日',
  '保護者氏名',
  '保護者電話',
  '保護者メール',
  'アレルギー',
  '子どもの特性',
  '保護者の状況・要望',
  '写真公開許可',
  '写真共有許可',
  '緊急連絡先1_氏名',
  '緊急連絡先1_続柄',
  '緊急連絡先1_電話',
  '緊急連絡先2_氏名',
  '緊急連絡先2_続柄',
  '緊急連絡先2_電話',
];

const sample = [
  '山田',
  '花子',
  'ヤマダ',
  'ハナコ',
  '',
  '女',
  '2019-04-12',
  '通年',
  '2024-04-01',
  '山田 太郎',
  '090-1234-5678',
  'taro@example.com',
  '',
  '',
  '',
  'true',
  'true',
  '山田 次郎',
  '叔父',
  '090-0000-0000',
  '',
  '',
  '',
];

export async function GET() {
  const csv = `\ufeff${header.join(',')}\r\n${sample.join(',')}\r\n`;

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="children-import-template.csv"',
    },
  });
}
