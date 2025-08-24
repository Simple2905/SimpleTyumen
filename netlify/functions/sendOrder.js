exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    const token  = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
    const chatId = process.env.CHAT_ID_POLEVAYA || process.env.CHAT_ID_DEFAULT;
    if (!token || !chatId) {
      return { statusCode: 500, body: JSON.stringify({ ok:false, error:'Missing TELEGRAM envs' }) };
    }

    const data = JSON.parse(event.body || '{}');
    const text = [
      '🧾 *Новый заказ*',
      data.product ? `Товар: ${data.product.name} — ${data.product.price} × ${data.product.qty||1}` : null,
      data.name ? `Имя: ${data.name}` : null,
      data.phone ? `Телефон: ${data.phone}` : null,
      data.address ? `Адрес: ${data.address}` : null,
      data.comment ? `Комментарий: ${data.comment}` : null,
      data.source ? `Источник: ${data.source}` : 'Источник: Мини-приложение',
      data.time ? `Время: ${data.time}` : null,
    ].filter(Boolean).join('\n');

    const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode:'Markdown', disable_web_page_preview:true })
    });
    const tg = await resp.json();

    return {
      statusCode: 200,
      headers:{ 'Content-Type': 'application/json', 'Access-Control-Allow-Origin':'*' },
      body: JSON.stringify({ ok:true, telegram: tg })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok:false, error: e.message }) };
  }
};
