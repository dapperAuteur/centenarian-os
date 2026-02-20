// lib/email/adminMessageTemplate.ts
// HTML email template for admin → user messages

export function adminMessageTemplate({
  subject,
  body,
  siteUrl,
}: {
  subject: string;
  body: string;
  siteUrl: string;
}): string {
  // If body is already HTML (from Tiptap), use it directly; otherwise convert plain text.
  const bodyHtml = body.trimStart().startsWith('<')
    ? body
    : body
        .split('\n')
        .map((line) => (line.trim() === '' ? '<br>' : `<p style="margin:0 0 12px">${line}</p>`))
        .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#c026d3,#0284c7);padding:32px 40px;">
              <p style="margin:0;color:#fff;font-size:22px;font-weight:700;">CentenarianOS</p>
              <p style="margin:6px 0 0;color:rgba(255,255,255,.8);font-size:14px;">Message from Admin</p>
            </td>
          </tr>
          <!-- Subject -->
          <tr>
            <td style="padding:32px 40px 0;">
              <h1 style="margin:0;font-size:20px;font-weight:700;color:#111827;">${subject}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:16px 40px 32px;color:#374151;font-size:15px;line-height:1.6;">
              ${bodyHtml}
            </td>
          </tr>
          <!-- CTA -->
          <tr>
            <td style="padding:0 40px 32px;">
              <a href="${siteUrl}/dashboard/messages"
                 style="display:inline-block;padding:12px 24px;background:#c026d3;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
                View in Dashboard
              </a>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #f3f4f6;color:#9ca3af;font-size:12px;">
              You received this message because you have a CentenarianOS account.
              <br>© ${new Date().getFullYear()} CentenarianOS
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
