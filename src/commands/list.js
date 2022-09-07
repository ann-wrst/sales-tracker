import {getList} from "../db-requests.js";

function getMesForI(list, start, end) {
    let message = "";
    let shownMessage = "";
    for (let i = start; i < end + 1; i++) {
        message += `${i + 1}\. <a href=${JSON.stringify(list[i].url)}>${JSON.stringify(list[i].description)}</a>` + '\n ' + JSON.stringify(list[i].new_price) + '\n';
        shownMessage += `${i + 1}\. ${JSON.stringify(list[i].description)}` + '\n ' + JSON.stringify(list[i].new_price) + '\n';
    }
    return {message, meslength: shownMessage.length}
}

export async function list(bot, ctx) {
    let list = await getList(ctx.message.chat.id);
    let message = "";
    if (list.length === 0) message = 'No items were found';
    let lastListIndex = 0;

    for (let i = lastListIndex; i < list.length; i++) {
        message = "";
        if (getMesForI(list, lastListIndex, i).meslength > 4096) {
            message = getMesForI(list, lastListIndex, i - 1).message;
            lastListIndex = i - 1;
        }
        if (message !== "") {
            await ctx.telegram.sendMessage(ctx.message.chat.id, `${message}`, {
                parse_mode: "HTML",
                disable_web_page_preview: true
            });

        } else if (i === list.length - 1) {
            message = getMesForI(list, lastListIndex, i).message;
            await ctx.telegram.sendMessage(ctx.message.chat.id, `${message}`, {
                parse_mode: "HTML",
                disable_web_page_preview: true
            });
        }
    }
}
