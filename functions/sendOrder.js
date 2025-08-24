
// netlify/functions/sendOrder.js
const CORS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

export default async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ ok:false, error:"Use POST" }), { status: 405, headers: CORS });
  }

  const BOT_TOKEN =
    process.env.TELEGRAM_BOT_TOKEN ||
    process.env.BOT_TOKEN;

  // Chats: try specific by pickup point, then default
  const CHATS = {
    polevaya: process.env.CHAT_ID_POLEVAYA,
    burlaki: process.env.CHAT_ID_BURLAKI,
    delivery: process.env.CHAT_ID_DEFAULT // optional
  };
  const DEFAULT_CHAT =
    process.env.CHAT_ID_DEFAULT ||
    process.env.CHAT_ID_POLEVAYA; // fallback to your main group

  if (!BOT_TOKEN || !DEFAULT_CHAT) {
    return new Response(JSON.stringify({ ok:false, error:"Missing env: TELEGRAM_BOT_TOKEN and CHAT_ID_*" }), { status: 500, headers: CORS });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok:false, error:"Invalid JSON" }), { status: 400, headers: CORS });
  }

  // Expecting fields from your index.html: deliveryMethod, pickupPoint, text
  const method = String(body.deliveryMethod || "pickup");
  const pickup = String(body.pickupPoint || "polevaya");
  const text   = String(body.text || "");

  if (!text) {
    return new Response(JSON.stringify({ ok:false, error:"Empty 'text' field" }), { status: 400, headers: CORS });
  }

  // Choose chat by pickup/delivery
  const chatId =
    (method === "pickup" ? (CHATS[pickup] || DEFAULT_CHAT) : (CHATS.delivery || DEFAULT_CHAT));

  try {
    const resp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true
      })
    });
    const tg = await resp.json().catch(()=>({}));
    if (!tg.ok) {
      return new Response(JSON.stringify({ ok:false, error:"Telegram API error", details: tg }), { status: 502, headers: CORS });
    }
    return new Response(JSON.stringify({ ok:true }), { status: 200, headers: CORS });
  } catch (e) {
    return new Response(JSON.stringify({ ok:false, error: String(e) }), { status: 500, headers: CORS });
  }
};
