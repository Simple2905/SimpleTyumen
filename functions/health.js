
exports.handler = async () => ({
  statusCode: 200,
  headers: {"Content-Type":"application/json","Access-Control-Allow-Origin":"*"},
  body: JSON.stringify({ ok: Boolean(process.env.TELEGRAM_BOT_TOKEN||process.env.BOT_TOKEN) && Boolean(process.env.CHAT_ID_POLEVAYA||process.env.CHAT_ID_DEFAULT),
                         bot:Boolean(process.env.TELEGRAM_BOT_TOKEN||process.env.BOT_TOKEN),
                         chat:Boolean(process.env.CHAT_ID_POLEVAYA||process.env.CHAT_ID_DEFAULT)})
});
