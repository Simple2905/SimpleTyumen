// functions/sendOrder.js
exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const token = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
    const chatId = process.env.CHAT_ID_POLEVAYA || process.env.CHAT_ID_DEFAULT;

    if (!token || !chatId) {
      return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Missing TELEGRAM envs' }) };
    }

    const data = JSON.parse(event.body || '{}');

    // Собери текст уведомления
    const lines = [
      '🧾 *Новый заказ*',
      data.product ? `Товар: ${data.product.name} — ${data.product.price}` : null,
      data.name ? `Имя: ${data.name}` : null,
      data.phone ? `Телефон: ${data.phone}` : null,
      data.comment ? `Комментарий: ${data.comment}` : null,
      data.address ? `Адрес: ${data.address}` : null,
      data.source ? `Источник: ${data.source}` : 'Источник: Мини-приложение',
    ].filter(Boolean);

    const text = lines.join('\n');

    // Отправка в Telegram (Node 18+ — глобальный fetch есть у Netlify)
    const tgResp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    });

    const tgJson = await tgResp.json();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ ok: true, telegram: tgJson }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
};
