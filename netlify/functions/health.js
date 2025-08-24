exports.handler = async () => {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ok: true,
      env: {
        TELEGRAM_BOT_TOKEN: !!process.env.TELEGRAM_BOT_TOKEN,
        CHAT_ID: !!(process.env.CHAT_ID_POLEVAYA || process.env.CHAT_ID_DEFAULT)
      }
    })
  };
};
