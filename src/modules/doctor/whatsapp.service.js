export function configuredWhatsAppSender(env = process.env, request = fetch) {
  const {
    WHATSAPP_ACCESS_TOKEN: token,
    WHATSAPP_PHONE_NUMBER_ID: senderId,
    WHATSAPP_FOLLOW_UP_TEMPLATE: template,
    WHATSAPP_TEMPLATE_LANGUAGE: language = 'en_US',
    WHATSAPP_GRAPH_API_VERSION: version = 'v27.0',
  } = env;
  if (!token?.trim() || !/^\d+$/.test(senderId || '') || !/^[a-z0-9_]+$/.test(template || '') ||
      !/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(language) || !/^v\d+\.\d+$/.test(version)) return null;

  return async phone => {
    const response = await request(`https://graph.facebook.com/${version}/${senderId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token.trim()}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone.slice(1),
        type: 'template',
        template: { name: template, language: { code: language } },
      }),
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      throw Object.assign(new Error('WhatsApp message rejected'), { status: response.status });
    }
    await response.body?.cancel().catch(() => {});
  };
}
