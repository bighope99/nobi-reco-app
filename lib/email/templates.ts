/**
 * メールテンプレート関数群
 */

/**
 * 新規ユーザー招待メールのHTMLテンプレート
 */
export const buildUserInvitationEmailHtml = (params: {
  userName: string
  userEmail: string
  role: string
  companyName?: string
  facilityName?: string
  inviteUrl?: string
}): string => {
  const roleNameMap: Record<string, string> = {
    site_admin: 'サイト管理者',
    facility_admin: '施設管理者',
    staff: 'スタッフ',
  }

  const roleName = roleNameMap[params.role] || params.role

  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>アカウント登録のご案内</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">のびレコ</h1>
              <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 14px;">成長記録システム</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 20px;">アカウント登録のご案内</h2>

              <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                ${params.userName} 様
              </p>

              <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                のびレコへようこそ！<br>
                アカウントが作成されました。以下の情報をご確認ください。
              </p>

              <!-- User Info Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 6px; margin: 20px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; color: #666666; font-size: 14px; width: 120px;">お名前</td>
                        <td style="padding: 8px 0; color: #333333; font-size: 14px; font-weight: bold;">${params.userName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #666666; font-size: 14px;">メールアドレス</td>
                        <td style="padding: 8px 0; color: #333333; font-size: 14px; font-weight: bold;">${params.userEmail}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #666666; font-size: 14px;">権限</td>
                        <td style="padding: 8px 0; color: #333333; font-size: 14px; font-weight: bold;">${roleName}</td>
                      </tr>
                      ${params.companyName ? `
                      <tr>
                        <td style="padding: 8px 0; color: #666666; font-size: 14px;">所属会社</td>
                        <td style="padding: 8px 0; color: #333333; font-size: 14px; font-weight: bold;">${params.companyName}</td>
                      </tr>
                      ` : ''}
                      ${params.facilityName ? `
                      <tr>
                        <td style="padding: 8px 0; color: #666666; font-size: 14px;">所属施設</td>
                        <td style="padding: 8px 0; color: #333333; font-size: 14px; font-weight: bold;">${params.facilityName}</td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>

              ${params.inviteUrl ? `
              <p style="margin: 20px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                以下のボタンをクリックして、パスワードを設定してください。
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
                <tr>
                  <td align="center">
                    <a href="${params.inviteUrl}" style="display: inline-block; padding: 14px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">パスワードを設定する</a>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0; color: #999999; font-size: 14px; line-height: 1.6;">
                ボタンがクリックできない場合は、以下のURLをコピーしてブラウザに貼り付けてください：<br>
                <a href="${params.inviteUrl}" style="color: #667eea; word-break: break-all;">${params.inviteUrl}</a>
              </p>
              ` : `
              <p style="margin: 20px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                招待メールが別途送信されますので、そちらからパスワードを設定してください。
              </p>
              `}

              <p style="margin: 30px 0 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
                ご不明な点がございましたら、お気軽にお問い合わせください。
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; color: #999999; font-size: 12px;">
                このメールは のびレコ から自動送信されています。<br>
                心当たりのない場合は、このメールを破棄してください。
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

/**
 * パスワードリセットメールのHTMLテンプレート
 */
export const buildPasswordResetEmailHtml = (params: {
  userName: string
  resetUrl: string
}): string => {
  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>パスワードリセットのご案内</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">のびレコ</h1>
              <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 14px;">成長記録システム</p>
            </td>
          </tr>

          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 20px;">パスワードリセットのご案内</h2>

              <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                ${params.userName} 様
              </p>

              <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                パスワードリセットのリクエストを受け付けました。<br>
                以下のボタンをクリックして、新しいパスワードを設定してください。
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
                <tr>
                  <td align="center">
                    <a href="${params.resetUrl}" style="display: inline-block; padding: 14px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">パスワードをリセットする</a>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0; color: #999999; font-size: 14px; line-height: 1.6;">
                ボタンがクリックできない場合は、以下のURLをコピーしてブラウザに貼り付けてください：<br>
                <a href="${params.resetUrl}" style="color: #667eea; word-break: break-all;">${params.resetUrl}</a>
              </p>

              <p style="margin: 30px 0 0 0; color: #e74c3c; font-size: 14px; line-height: 1.6;">
                ※このリンクは24時間有効です。<br>
                ※このリクエストに心当たりがない場合は、このメールを無視してください。
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; color: #999999; font-size: 12px;">
                このメールは のびレコ から自動送信されています。
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}
