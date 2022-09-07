import {deleteItem, getList} from "../db-requests.js";
import writeLog from "../logger.js";

export async function deleteCommand(bot, ctx) {
    let chatId = ctx.message.chat.id;
    let list = await getList(chatId);
    let messageText = ctx.message.text;
    let itemToDelete = messageText.split(' ')[1];
    let isRange = messageText.includes('-');
    if (!itemToDelete) {
        await ctx.telegram.sendMessage(chatId, `Enter 'delete' command and the number from the \/list of items that you want to delete`);
        return;
    }
    if (isRange) {
        await rangeDelete(bot, ctx, chatId, itemToDelete, list);
    } else {
        await singleDelete(bot, ctx, chatId, itemToDelete, list);
    }
}

async function rangeDelete(bot, ctx, chatId, itemToDelete, list) {
    let from = itemToDelete.split('-')[0];
    let to = itemToDelete.split('-')[1];
    if (to < from) {
        await ctx.telegram.sendMessage(chatId, `Incorrect range specified. To value should be >= then from value`);
        return;
    }
    let itemsToDelete = [];
    for (let i = +from - 1; i <= +to - 1; i++) {
        itemsToDelete.push(list[i]);
    }
    let isSuccessful = true;
    for (let i in itemsToDelete) {
        if (!deleteItem(itemsToDelete[i]?.id)) isSuccessful = false;
    }
    if (!isSuccessful) {
        await ctx.telegram.sendMessage(chatId, `An error occurred when deleting items`);
    } else {
        await ctx.telegram.sendMessage(chatId, `The items were deleted`, {
            parse_mode: "HTML"
        });
        writeLog(`Deleted items`, chatId);
    }
}

async function singleDelete(bot, ctx, chatId, itemToDelete, list) {
    let item = list[+itemToDelete - 1];
    let itemId = list[+itemToDelete - 1]?.id;
    if (!itemId) {
        await ctx.telegram.sendMessage(chatId, `Incorrect number of item. Enter the number from \/list`);
        return;
    }
    if (deleteItem(itemId)) {
        await ctx.telegram.sendMessage(chatId, `The item <a href="${item.url}">${item.description}</a> was deleted`, {
            parse_mode: "HTML"
        });
        writeLog(`Deleted item ${item.url}`, chatId);
    } else await ctx.telegram.sendMessage(chatId, `There is an error deleting item`);
}
