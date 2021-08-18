import {Telegraf} from 'telegraf'
import fetch from 'node-fetch';
import {token} from './config.js'
import sqlite from 'sqlite-sync'
import {createObjectCsvWriter} from 'csv-writer'
import {getDomain, getCurrectTime, validateName} from './utils.js'

let url;
let reload = () => {
    sqlite?.connect('./db/sales.db');
}
reload();
const bot = new Telegraf(token);

bot.launch().then(async () => {
    await launchTimer();
});

bot.start((ctx) => ctx.reply('Welcome. Send link to track sale'))
bot.command('new', (ctx) => {
    ctx.telegram.sendMessage(ctx.message.chat.id, `Send url`).then(r => {
        url = r
    });
})
bot.command('list', async (ctx) => {
    let list = await getList(ctx.message.chat.id);
    let message = "";
    for (let i = 0; i < list.length; i++) {
        message += `${i + 1}\. ` + JSON.stringify(list[i].description) + '' + JSON.stringify(list[i].url) + '\n';
    }
    await ctx.telegram.sendMessage(ctx.message.chat.id, `${message}`);
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
        console.log(notTracked);
        if (!notTracked) return `Product is already tracked\n${data.description}\nСтарая цена ${data.oldPrice} ${data.oldPriceCurrency}\nНовая цена ${data.price} ${data.priceCurrency}`;

        return `${data.description}\nСтарая цена ${data.oldPrice} ${data.oldPriceCurrency}\nНовая цена ${data.price} ${data.priceCurrency}`;
    } catch (e) {
        return e.message;
    }
}

async function addToDB(url, description, domain, price, oldPrice, chatID) {
    try {
        if (sqlite.run(`SELECT url FROM sales WHERE user_id=${chatID} AND url='${url}'`).length !== 0) return false;
        else {
            const db_request = `INSERT INTO sales(url, description, domain, new_price, old_price, user_id) VALUES('${url}', '${description}', '${domain}', ${price}, ${oldPrice},${chatID});`;
            console.log(sqlite.run(db_request));
            const log = {time: getCurrectTime(), action: `Added link ${url}`, chatID: `${chatID}`};
            console.log(chatID);
            writeToCSV([log]);
            return true;
        }
    } catch (e) {
        throw Error("There is an error when working with database");
    }
}

async function getList(userId) {
    try {
        let list = sqlite.run(`SELECT * FROM sales WHERE user_id="${userId}"`);
        return list;
    } catch (e) {
        throw Error("There is an error getting the list");
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

function writeToCSV(records) {
    const csvWriter = createObjectCsvWriter({
        path: 'logs.csv',
        header: [
            {id: 'time', title: 'TIME'},
            {id: 'action', title: 'ACTION'},
            {id: 'chatId', title: 'CHATID'}
        ],
        append: true
    });
    csvWriter.writeRecords(records)
        .then(() => {
            console.log('...Log written');
        });
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
                        console.log(item.new_price, 'same\n_________');
                        const log = {time: getCurrectTime(), action: `Values haven\'t changed`, chatId: item.user_id};
                        writeToCSV([log]);
                        break;
                    } else {
                        let previous_price = item.new_price;
                        let new_price = answer.price;
                        console.log(sqlite.run(`UPDATE sales SET new_price = ${+answer.price}, old_price = ${+answer.oldPrice} WHERE id=${item.id};`));
                        let message = `The price of ${item.description}\n ${item.url} was changed from ${previous_price} to ${new_price}`;
                        const log = {
                            time: getCurrectTime(),
                            action: `Values have changed from ${previous_price} to ${new_price} of ${item.url}`,
                            chatId: item.user_id
                        };
                        writeToCSV([log]);
                        await bot.telegram.sendMessage(item.user_id, message);
                        break;
                    }
                }
                default:
                    break;
            }
        }
    }, 4000);
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
