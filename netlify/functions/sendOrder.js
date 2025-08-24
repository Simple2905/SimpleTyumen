// netlify/functions/sendOrder.js
const rub = (n) => {
  if (Number.isNaN(n)) return '';
  return new Intl.NumberFormat('ru-RU').format(n) + ' ₽';
};

const parsePrice = (s) => {
  if (typeof s !== 'string') return NaN;
  // "2 990 ₽" -> 2990
  return Number(s.replace(/[^\d.,]/g, '').replace(',', '.')) || NaN;
};

const esc = (s) => {
  // Экранируем под parse_mode: "HTML"
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

const line = (label, value) => (value ? `<b>${label}:</b> ${esc(value)}\n` : '');

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

    const data = JSON.parse(event.body || '{}');

    // ---- Нормализуем вход ----
    const name     = data.name?.trim();
    const phone    = data.phone?.trim();
    const address  = data.address?.trim();
    const comment  = data.comment?.trim();
    const source   = data.source?.trim() || 'Мини-приложение';
    const placedAt = data.time ? new Date(data.time) : new Date();
    const orderId  = data.orderId || Math.random().toString(36).slice(2, 8).toUpperCase();

    // Поддержка одного товара { name, price, qty }
    let lines = [];
    let total = 0;

    if (data.product && (data.product.name || data.product.price)) {
      const pname = data.product.name || 'Товар';
      const qty   = Number(data.product.qty || 1);
      const pnum  = parsePrice(data.product.price || '');
      const sum   = Number.isNaN(pnum) ? NaN : (pnum * qty);
      if (!Number.isNaN(sum)) total += sum;

      lines.push(`• ${esc(pname)} — ${esc(data.product.price || '')}${qty > 1 ? ` × ${qty} = <b>${rub(sum)}</b>` : ''}`);
    }

    // Поддержка корзины items: [{ name, price, qty }]
    if (Array.isArray(data.items)) {
      for (const it of data.items) {
        if (!it) continue;
        const nm  = it.name || 'Товар';
        const q   = Number(it.qty || 1);
        const pn  = parsePrice(it.price || '');
        const sum = Number.isNaN(pn) ? NaN : (pn * q);
        if (!Number.isNaN(sum)) total += sum;
        lines.push(`• ${esc(nm)} — ${esc(it.price || '')}${q > 1 ? ` × ${q} = <b>${rub(sum)}</b>` : ''}`);
      }
    }

    const itemsBlock = lines.length
      ? `<b>Состав заказа:</b>\n${lines.join('\n')}\n`
      : '';

    const totalBlock = total > 0
      ? `<b>Итого:</b> ${rub(total)}\n`
      : '';

    // ---- Формируем сообщение ----
    const text =
`🧾 <b>Новый заказ</b>
<b>№</b> ${orderId}
<b>Время:</b> ${esc(placedAt.toLocaleString('ru-RU'))}
${itemsBlock}${totalBlock}${line('Имя', name)}${line('Телефон', phone)}${line('Адрес', address)}${line('Комментарий', comment)}${line('Источник', source)}`;

    // ---- Отправка в Telegram ----
    const tgResp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    const tgJson = await tgResp.json();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: true, telegram: tgJson }),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok:false, error: e.message }) };
  }
};
