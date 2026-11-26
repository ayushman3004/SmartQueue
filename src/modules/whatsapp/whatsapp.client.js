export class WhatsAppSendError extends Error {
  constructor(outcome) {
    super('WhatsApp message could not be confirmed');
    this.outcome = outcome;
  }
}

export const validMessageId = value => typeof value === 'string' && /^wamid\.[\w+=/-]{1,500}$/.test(value);
export const validCallback = value => typeof value === 'string' && /^[a-f0-9-]{36}$/.test(value);

export function createWhatsAppClient(config, request = fetch) {
  async function send(phone, callback, template) {
    if (!/^\+[1-9]\d{7,14}$/.test(phone) || !validCallback(callback)) throw new WhatsAppSendError('permanent');
    let response;
    try {
      response = await request(`https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.accessToken}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(8000),
        redirect: 'error',
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone.slice(1),
          type: 'template',
          biz_opaque_callback_data: callback,
          template: { ...template, language: { code: config.language } },
        }),
      });
    } catch {
      throw new WhatsAppSendError('unknown');
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      const outcome = response.status === 429 ? 'retry' : response.status >= 500 || response.status === 408 ? 'unknown' : 'permanent';
      throw new WhatsAppSendError(outcome);
    }
    const payload = await response.json().catch(() => null);
    const id = payload?.messages?.[0]?.id;
    if (!validMessageId(id)) throw new WhatsAppSendError('unknown');
    return id;
  }

  return {
    otp(phone, code, callback) {
      if (!/^\d{6}$/.test(code)) throw new WhatsAppSendError('permanent');
      const parameters = [{ type: 'text', text: code }];
      return send(phone, callback, { name: config.otpTemplate, components: [
        { type: 'body', parameters },
        { type: 'button', sub_type: 'url', index: '0', parameters },
      ] });
    },
    document(phone, callback) {
      // A static URL in the approved template opens the authenticated profile.
      return send(phone, callback, { name: config.documentTemplate });
    },
    visitNotice(kind, phone, callback) {
      const name = config.visitTemplates?.[kind];
      if (!name) throw new WhatsAppSendError('permanent');
      return send(phone, callback, { name });
    },
  };
}
