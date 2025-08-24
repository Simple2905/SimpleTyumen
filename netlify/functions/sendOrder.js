// netlify/functions/sendOrder.js

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const token = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
    const chatId = process.env.CHAT_ID_POLEVAYA || process.env.CHAT_ID_DEFAULT;
    if (!token || !chatId) {
      return {
        statusCode: 500,
        body: JSON.stringify({ ok: false, error: "Missing TELEGRAM envs" }),
      };
    }

    const data = JSON.parse(event.body || "{}");

    const {
      customer = {},
      recipient = {},
      deliveryMethod,
      pickupPoint,
      address,
      date,
      time,
      comment,
      items = [],
      total = 0,
      fee = 0,
      source = "Мини-приложение",
    } = data;

    const pickupMap = {
      polevaya: "Полевая, 109с9",
      burlaki: "Бурлаки, 2ак3",
    };

    let calcSubtotal = 0;
    const lines = items.map((it) => {
      const qty = Number(it.qty || 1);
      const pEach = parseInt((it.price || "").replace(/[^\d]/g, ""), 10) || 0;
      const sum = qty * pEach;
      calcSubtotal += sum;
      return `• ${esc(it.name || "Товар")} — ${qty} × ${esc(it.price)} = <b>${sum.toLocaleString("ru-RU")} ₽</b>`;
    });

    const subtotal = total || calcSubtotal;
    const grand = subtotal + (fee || 0);

    const orderId = (data.orderId || Math.random().toString(36).slice(2, 8)).toUpperCase();

    const text = `🧾 <b>Новый заказ</b>
<b>№</b> ${orderId}

👤 <b>Заказчик:</b> ${esc(customer.name || "—")}
📞 ${esc(customer.phone || "—")}

🎁 <b>Получатель:</b> ${esc(recipient.name || "—")}
📱 ${esc(recipient.phone || "—")}

🚚 <b>Способ:</b> ${
      deliveryMethod === "pickup"
        ? "Самовывоз — " + esc(pickupMap[pickupPoint] || "—")
        : "Доставка"
    }
${deliveryMethod === "delivery" ? "🏠 " + esc(address || "—") : ""}

📦 <b>Состав заказа:</b>
${lines.length ? lines.join("\n") : "—"}
━━━━━━━━━━
💰 <b>Товары:</b> ${subtotal.toLocaleString("ru-RU")} ₽
🚚 <b>Доставка:</b> ${(fee || 0).toLocaleString("ru-RU")} ₽
💳 <b>Итого:</b> ${grand.toLocaleString("ru-RU")} ₽
━━━━━━━━━━
🕒 <b>Дата/время:</b> ${esc(date || "—")} ${esc(time || "")}
📝 <b>Комментарий:</b> ${esc(comment || "—")}
📲 <b>Источник:</b> ${esc(source)}
`;

    const reply_markup =
      deliveryMethod === "delivery" && address
        ? { inline_keyboard: [[{ text: "🗺 Открыть адрес", url: `https://yandex.ru/maps/?text=${encodeURIComponent(address)}` }]] }
        : undefined;

    const tgResp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup,
      }),
    });
    const tgJson = await tgResp.json();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: true, telegram: tgJson }),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};
