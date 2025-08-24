// netlify/functions/sendorder.js

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const rub = (n) => new Intl.NumberFormat('ru-RU').format(n) + ' ₽';

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

    // --- поля покупателя ---
    const name    = data.name?.trim();
    const phone   = data.phone?.trim();
    const address = data.address?.trim();
    const comment = data.comment?.trim();
    const date    = data.date;
    const time    = data.time;
    const source  = data.source || 'Мини-приложение';
    const orderId = (data.orderId || Math.random().toString(36).slice(2, 8)).toUpperCase();

    // --- товары ---
    const items = Array.isArray(data.items) ? data.items : [];
    let total = 0;
    const lines = items.map(it => {
      const qty = it.qty || 1;
      const price = parseFloat(String(it.price).replace(/[^\d]/g,'')) || 0;
      const sum = price * qty;
      total += sum;
      return `• ${esc(it.name)} — ${qty} × ${rub(price)} = <b>${rub(sum)}</b>`;
    });

    const fee   = data.fee || 0;
    const grand = total + fee;

    // --- сообщение ---
    const text =
`🧾 <b>Новый заказ</b>
<b>№</b> ${orderId}

👤 <b>Имя:</b> ${esc(name)}
📞 <b>Телефон:</b> ${esc(phone)}
🏠 <b>Адрес:</b> ${esc(address || (data.deliveryMethod==='pickup' ? 'Самовывоз' : '-'))}

📦 <b>Состав заказа:</b>
${lines.join('\n') || '-'}
━━━━━━━━━━
💰 <b>Товары:</b> ${rub(total)}
🚚 <b>Доставка:</b> ${rub(fee)}
💳 <b>Итого:</b> ${rub(grand)}
━━━━━━━━━━
🕒 <b>Дата/время:</b> ${esc([date, time].filter(Boolean).join(' ') || new Date().toLocaleString('ru-RU'))}
📝 <b>Комментарий:</b> ${esc(comment || '-')}
📲 <b>Источник:</b> ${esc(source)}`;

    // --- отправка ---
    const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });
    const tg = await resp.json();

    return {
      statusCode: 200,
      headers: { 'Content-Type':'application/json','Access-Control-Allow-Origin':'*' },
      body: JSON.stringify({ ok:true, telegram: tg })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok:false, error:e.message }) };
  }
};
