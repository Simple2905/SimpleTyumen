// netlify/functions/sendorder.js
const rub = (n) => (Number.isNaN(n) ? '' : new Intl.NumberFormat('ru-RU').format(n) + ' ₽');
const parsePrice = (s) => Number((s || '').replace(/[^\d.,]/g, '').replace(',', '.')) || NaN;
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const line = (label, value) => (value ? `<b>${label}:</b> ${esc(value)}\n` : '');

function parseBody(event) {
  const raw = event.body || '';
  const ct = (event.headers?.['content-type'] || event.headers?.['Content-Type'] || '').toLowerCase();

  // Netlify иногда присылает base64 при определённых прокси-конфигурациях
  const decoded = event.isBase64Encoded ? Buffer.from(raw, 'base64').toString('utf8') : raw;

  // JSON
  if (ct.includes('application/json')) {
    try { return JSON.parse(decoded || '{}'); } catch (_) { /* fallthrough */ }
  }

  // form-urlencoded
  if (ct.includes('application/x-www-form-urlencoded')) {
    const obj = {};
    decoded.split('&').forEach(pair => {
      const [k, v] = pair.split('=');
      if (!k) return;
      obj[decodeURIComponent(k)] = decodeURIComponent((v || '').replace(/\+/g, ' '));
    });
    return obj;
  }

  // Попытка как JSON без заголовка
  try { return JSON.parse(decoded || '{}'); } catch (_) { /* пусто */ }
  return {};
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const token  = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
    const chatId = process.env.CHAT_ID_POLEVAYA || process.env.CHAT_ID_DEFAULT;
    if (!token || !chatId) {
      return { statusCode: 500, body: JSON.stringify({ ok:false, error:'Missing TELEGRAM envs' }) };
    }

    const data = parseBody(event);

    // ---- Нормализация ----
    const name     = data.name?.trim();
    const phone    = data.phone?.trim();
    const address  = data.address?.trim();
    const comment  = data.comment?.trim();
    const source   = (data.source || 'Мини-приложение').trim();
    const placedAt = data.time ? new Date(data.time) : new Date();
    const orderId  = (data.orderId || Math.random().toString(36).slice(2, 8)).toUpperCase();

    // ---- Товары ----
    let lines = [];
    let total = 0;

    // одиночный товар
    if (data.product && (data.product.name || data.product.price)) {
      const qty = Number(data.product.qty || 1);
      const pn  = parsePrice(data.product.price || '');
      const sum = Number.isNaN(pn) ? NaN : pn * qty;
      if (!Number.isNaN(sum)) total += sum;
      lines.push(`• ${esc(data.product.name || 'Товар')} — ${esc(data.product.price || '')}${qty > 1 ? ` × ${qty} = <b>${rub(sum)}</b>` : ''}`);
    }

    // корзина
    if (Array.isArray(data.items)) {
      for (const it of data.items) {
        if (!it) continue;
        const q = Number(it.qty || 1);
        const pn = parsePrice(it.price || '');
        const sum = Number.isNaN(pn) ? NaN : pn * q;
        if (!Number.isNaN(sum)) total += sum;
        lines.push(`• ${esc(it.name || 'Товар')} — ${esc(it.price || '')}${q > 1 ? ` × ${q} = <b>${rub(sum)}</b>` : ''}`);
      }
    }

    const itemsBlock = lines.length ? `<b>Состав заказа:</b>\n${lines.join('\n')}\n` : '';
    const totalBlock = total > 0 ? `<b>Итого:</b> ${rub(total)}\n` : '';

    // ---- Диагностика: покажем какие поля реально пришли ----
    const missing = [];
    if (!name)    missing.push('name');
    if (!phone)   missing.push('phone');
    if (!address) missing.push('address'); // может быть опц.
    if (!comment) /* опционально */ null;
    if (!lines.length) missing.push('product/items');

    const diag = missing.length ? `\n⚠️ <i>Отсутствуют поля:</i> ${missing.join(', ')}\n` : '';

    // ---- Сообщение ----
    const text =
`🧾 <b>Новый заказ</b>
<b>№</b> ${orderId}
<b>Время:</b> ${esc(placedAt.toLocaleString('ru-RU'))}
${itemsBlock}${totalBlock}${line('Имя', name)}${line('Телефон', phone)}${line('Адрес', address)}${line('Комментарий', comment)}${line('Источник', source)}${diag}`;

    // Кнопка "Позвонить" если есть телефон
    const reply_markup = phone ? {
      inline_keyboard: [
        [{ text: `Позвонить: ${phone}`, url: `tel:${phone.replace(/[^\d+]/g,'')}` }]
      ]
    } : undefined;

    const tgResp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup
      }),
    });
    const tgJson = await tgResp.json();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: true, telegram: tgJson, received: data }),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok:false, error: e.message }) };
  }
};
