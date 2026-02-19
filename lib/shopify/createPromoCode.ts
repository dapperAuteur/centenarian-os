// lib/shopify/createPromoCode.ts
// Creates a unique, single-use discount code in Shopify under an existing price rule

export async function createShopifyPromoCode(): Promise<string> {
  const domain = process.env.SHOPIFY_SHOP_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_API_TOKEN;
  const ruleId = process.env.SHOPIFY_PRICE_RULE_ID;

  if (!domain || !token || !ruleId) {
    throw new Error('Missing Shopify env vars: SHOPIFY_SHOP_DOMAIN, SHOPIFY_ADMIN_API_TOKEN, SHOPIFY_PRICE_RULE_ID');
  }

  // e.g. CENT-A3X9ZR — human readable, 6 random uppercase alphanumeric chars
  const suffix = Math.random().toString(36).toUpperCase().slice(2, 8);
  const code = `CENT-${suffix}`;

  const res = await fetch(
    `https://${domain}/admin/api/2025-01/price_rules/${ruleId}/discount_codes.json`,
    {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ discount_code: { code } }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Shopify API error ${res.status}: ${body}`);
  }

  return code;
}
