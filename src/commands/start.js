import writeLog from "../logger.js";

export async function start(bot, ctx) {
    ctx.reply('Welcome. Send link to track sale');
    let chat = await bot.telegram.getChat(ctx.message.chat.id)
        .then(chat => chat.username || chat.first_name)
        .catch(err => console.error(err));
    writeLog(`Start command of user ${chat}`, ctx.message.chat.id);
}
