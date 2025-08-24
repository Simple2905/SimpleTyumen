// netlify/functions/sendOrder.js
// Красивый чек: имя, телефон, адрес/самовывоз, товары, суммы, дата/время, комментарий, источник.

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const rub = (n) => new Intl.NumberFormat('ru-RU').format(n) + ' ₽';

// Достаём число из строки цены "2 200 ₽" -> 2200
const toNumber = (price) => {
  if (typeof price === 'number') return price;
  const n = Number(String(price || '').replace(/[^\d.,]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

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

    // --- Поля заказа ---
    const {
      name,
      phone,
      address,
      comment,
      deliveryMethod,     // 'pickup' | 'delivery'
      pickupPoint,        // 'polevaya' | 'burlaki'
      zone,               // 'city' | 'suburb' | 'far'
      date,
      time,
      items = [],
      fee = 0,
      total,
      source = 'Мини-приложение',
      timePlaced
    } = data;

    // Человеческие подписи
    const pickupMap = { polevaya: 'Полевая, 109с9', burlaki: 'Бурлаки, 2ак3' };
    const zoneMap   = { city: 'В черте города', suburb: 'Пригород', far: 'Далёкая зона' };

    // Пересчёт, если total не прислали
    let calcSubtotal = 0;
    const lines = (items || []).map((it) => {
      const qty   = Number(it.qty || 1);
      const pEach = toNumber(it.price);
      const sum   = qty * pEach;
      calcSubtotal += sum;
      return `• ${esc(it.name || 'Товар')} — ${qty} × ${rub(pEach)} = <b>${rub(sum)}</b>`;
    });

    const subtotal = Number.isFinite(Number(total)) ? Number(total) : calcSubtotal;
    const deliveryFee = Number(fee) || 0;
    const grand = subtotal + deliveryFee;

    const orderId = (data.orderId || Math.random().toString(36).slice(2, 8)).toUpperCase();

    // Адрес/самовывоз
    const addressLine =
      deliveryMethod === 'pickup'
        ? `Самовывоз — ${esc(pickupMap[pickupPoint] || '—')}`
        : esc(address || '—');

    // Когда
    const whenText = [date, time].filter(Boolean).join(' ') || timePlaced || new Date().toLocaleString('ru-RU');

    // Собираем чек
    const text =
`🧾 <b>Новый заказ</b>
<b>№</b> ${orderId}

👤 <b>Имя:</b> ${esc(name || '—')}
📞 <b>Телефон:</b> ${esc(phone || '—')}
🏠 <b>Адрес:</b> ${addressLine}
${deliveryMethod === 'delivery' ? `🚩 <b>Зона:</b> ${esc(zoneMap[zone] || '—')}\n` : ''}📦 <b>Состав заказа:</b>
${lines.length ? lines.join('\n') : '—'}
━━━━━━━━━━
💰 <b>Товары:</b> ${rub(subtotal)}
🚚 <b>Доставка:</b> ${rub(deliveryFee)}
💳 <b>Итого:</b> ${rub(grand)}
━━━━━━━━━━
🕒 <b>Дата/время:</b> ${esc(whenText)}
📝 <b>Комментарий:</b> ${esc(comment || '—')}
📲 <b>Источник:</b> ${esc(source)}`;

    // Инлайн-кнопка только для карты (если доставка)
    const mapUrl =
      deliveryMethod === 'delivery' && address
        ? `https://yandex.ru/maps/?text=${encodeURIComponent(address)}`
        : null;

    const reply_markup = mapUrl
      ? { inline_keyboard: [[{ text: '🗺 Открыть адрес', url: mapUrl }]] }
      : undefined;

    // Отправка в Telegram
    const tgResp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup
      })
    });
    const tgJson = await tgResp.json();

    return {
      statusCode: 200,
      headers: { 'Content-Type':'application/json', 'Access-Control-Allow-Origin':'*' },
      body: JSON.stringify({ ok: true, telegram: tgJson })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok:false, error: e.message }) };
  }
};
