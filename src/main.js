import {Telegraf} from 'telegraf'
import fetch from 'node-fetch';
import sqlite from 'sqlite-sync'
import {getDomain, validateName} from './utils.js'
import {timerInterval, token} from "../config.js";
import writeLog from "./logger.js";
import {getList, addToDB, deleteItem} from "./db-requests.js";

let url;
let reload = () => {
    sqlite?.connect('./db/sales.db');
}
reload();
const bot = new Telegraf(token);

bot.launch().then(async () => {
    await launchTimer();
    // bot.telegram.getChat(700613897)
    //     .then(chat => console.log(chat))
    //     .catch(err => console.error(err));
});

bot.start((ctx) => {
    ctx.reply('Welcome. Send link to track sale');
    writeLog('Start command', ctx.message.chat.id);
})

bot.command('list', async (ctx) => {
    let list = await getList(ctx.message.chat.id);
    let message = "";
    if (list.length === 0) message = 'No items were added';
    for (let i = 0; i < list.length; i++) {
        message += `${i + 1}\. ` + JSON.stringify(list[i].description) + '' + JSON.stringify(list[i].url) + '\n ' + JSON.stringify(list[i].new_price) + '\n';
    }
    await ctx.telegram.sendMessage(ctx.message.chat.id, `${message}`);
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
    if (deleteItem(itemId)) await ctx.telegram.sendMessage(ctx.message.chat.id, `The item ${item.url} was deleted`);
    else await ctx.telegram.sendMessage(ctx.message.chat.id, `There is an error deleting item`);
})


bot.on('text', async ctx => {
    url = ctx.message.text;
    if (!validateName(url)) return ctx.reply("Invalid url")
    let domain = getDomain(url);
    let answer = await processMetadata(url, domain, ctx.message.chat.id);
    ctx.reply(answer);
});

async function getReservedMetadata(url) {
    let context;
    try {
        context = await getHTML(url);
    } catch (e) {
        throw Error("There is an error accessing website");
    }
    try {
        const description = getContent(context, "og:description");
        const oldPrice = getContent(context, "product:original_price:amount");
        const oldPriceCurrency = getContent(context, "product:original_price:currency");
        const price = getContent(context, "product:price:amount");
        const priceCurrency = getContent(context, "product:price:currency");
        return {url, description, price, oldPrice, oldPriceCurrency, priceCurrency};
    } catch (e) {
        throw Error("There is an error parsing website")
    }
}

async function processMetadata(url, domain, chatID) {
    let data;
    try {
        switch (domain) {
            case 'reserved.com':
            case 'sinsay.com':
            case 'housebrand.com':
            case 'mohito.com':
            case 'cropp.com': {
                data = await getReservedMetadata(url);
                break;
            }
            default:
                return 'Unable to parse this site so far';
        }
        let notTracked = await addToDB(url, data.description, domain, data.price, data.oldPrice, chatID);
        if (!notTracked) return `Product is already tracked\n${data.description}\nСтарая цена ${data.oldPrice} ${data.oldPriceCurrency}\nНовая цена ${data.price} ${data.priceCurrency}`;

        return `${data.description}\nСтарая цена ${data.oldPrice} ${data.oldPriceCurrency}\nНовая цена ${data.price} ${data.priceCurrency}`;
    } catch (e) {
        return e.message;
    }
}

async function getHTML(url) {
    try {
        const response = await fetch(url);
        return await response.text();
    } catch (e) {
        throw Error("There is an error accessing website");
    }
}

async function launchTimer() {
    let timerId = setInterval(async () => {
        sqlite.close();
        reload();
        let rows = sqlite.run("SELECT * FROM sales;");
        for (let item of rows) {
            switch (item.domain) {
                case 'reserved.com':
                case 'sinsay.com':
                case 'housebrand.com':
                case 'mohito.com':
                case 'cropp.com': {
                    let answer = await getReservedMetadata(item.url);
                    if (item.old_price === +answer.oldPrice && item.new_price === +answer.price) {
                        writeLog(`Values haven\'t changed of ${item.url}`, item.user_id);
                        break;
                    } else {
                        let previous_price = item.new_price;
                        let new_price = answer.price;
                        console.log(sqlite.run(`UPDATE sales SET new_price = ${+answer.price}, old_price = ${+answer.oldPrice} WHERE id=${item.id};`));
                        let message = `The price of ${item.description}\n ${item.url} was changed from ${previous_price} to ${new_price}`;

                        writeLog(`Values have changed from ${previous_price} to ${new_price} of ${item.url}`, item.user_id)
                        await bot.telegram.sendMessage(item.user_id, message);
                        break;
                    }
                }
                default:
                    break;
            }
        }
    }, timerInterval);
}

let getMeta = (property) => `<meta property="${property}" content="`;
let getRegular = (property) => new RegExp(`${getMeta(property)}(.*?)">`, "g");

let getContent = (context, property) => {
    let regular = getRegular(property);
    let result = context.match(regular);

    if (result != null) {
        return result[0].substring(getMeta(property).length, result[0].length - 2);
    }
}
