import {Telegraf} from 'telegraf'
import sqlite from 'sqlite-sync'
import {getDomain, validateName} from './utils.js'
import {timerInterval, token} from "../config.js";
import writeLog from "./logger.js";
import {getList, addToDB, deleteItem, updateItem, reload} from "./db-requests.js";
import {Makeup, Reserved, Rozetka} from "./Shop.js";
import Tracker from "./Tracker.js";

let url;
reload();
const bot = new Telegraf(token);

bot.launch().then(async () => {
    let tracker = new Tracker(bot);
    await tracker.launchTimer();
});

bot.start(async (ctx) => {
    ctx.reply('Welcome. Send link to track sale');
    let chat = await bot.telegram.getChat(ctx.message.chat.id)
        .then(chat => chat.username || chat.first_name)
        .catch(err => console.error(err));
    writeLog(`Start command of user ${chat}`, ctx.message.chat.id);
})

bot.command('list', async (ctx) => {
    let list = await getList(ctx.message.chat.id);
    let message = "";
    if (list.length === 0) message = 'No items were found';
    for (let i = 0; i < list.length; i++) {
        message += `${i + 1}\. ` + JSON.stringify(list[i].description) + '' + JSON.stringify(list[i].url) + '\n ' + JSON.stringify(list[i].new_price) + '\n';
    }
    if (message.length > 4096) {
        for (let x = 0; x < message.length; x += 4096) {
            await ctx.telegram.sendMessage(ctx.message.chat.id, `${message.slice(x, x + 4096)}`);
        }
    } else await ctx.telegram.sendMessage(ctx.message.chat.id, `${message}`);
})
bot.command('delete', async (ctx) => {
    let list = await getList(ctx.message.chat.id);

    let itemToDelete = ctx.message.text.split(' ')[1];
    if (!itemToDelete) {
        await ctx.telegram.sendMessage(ctx.message.chat.id, `Enter 'delete' command and the number from the \/list of items that you want to delete`);
        return;
    }
    let item = list[+itemToDelete - 1];
    let itemId = list[+itemToDelete - 1]?.id;
    if (!itemId) {
        await ctx.telegram.sendMessage(ctx.message.chat.id, `Incorrect number of item. Enter the number from \/list`);
        return;
    }
    if (deleteItem(itemId)) {
        await ctx.telegram.sendMessage(ctx.message.chat.id, `The item ${item.url} was deleted`);
        writeLog(`Deleted item ${item.url}`, ctx.message.chat.id);
    } else await ctx.telegram.sendMessage(ctx.message.chat.id, `There is an error deleting item`);
})


bot.on('text', async ctx => {
    url = ctx.message.text;
    if (!validateName(url)) return ctx.reply("Invalid url")
    let domain = getDomain(url);
    let answer = await trackProduct(url, domain, ctx.message.chat.id);
    ctx.reply(answer);
});


async function trackProduct(url, domain, chatID) {
    let data;
    try {
        switch (domain) {
            case 'reserved.com':
            case 'sinsay.com':
            case 'housebrand.com':
            case 'mohito.com':
            case 'cropp.com':
            case 'localhost:8081': {
                let reservedShop = new Reserved(domain);
                data = await reservedShop.getMetadata(url);
                break;
            }
            case 'rozetka.com.ua':
            case 'bt.rozetka.com.ua':
            case 'hard.rozetka.com.ua': {
                let rozetkaShop = new Rozetka(domain);
                data = await rozetkaShop.getMetadata(url);
                break;
            }
            case 'makeup.com.ua': {
                let makeupShop = new Makeup(domain);
                data = await makeupShop.getMetadata(url);
                break;
            }
            default:
                return 'Unable to parse this site so far';
        }
        if (Object.keys(data).length === 0) return 'Unable to get data';
        let notTracked = await addToDB(url, data.description, domain, data.price, data.oldPrice, chatID);
        if (!notTracked) return `Product is already tracked\n${data.description}\nOld price ${data.oldPrice} ${data.oldPriceCurrency}\nNew price ${data.price} ${data.priceCurrency}`;

        return `${data.description}\nOld price ${data.oldPrice} ${data.oldPriceCurrency}\nNew price ${data.price} ${data.priceCurrency}`;
    } catch (e) {
        return e.message;
    }
}
