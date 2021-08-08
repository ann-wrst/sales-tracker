import {Telegraf} from 'telegraf'
import fetch from 'node-fetch';
import {token} from './config.js'
import sqlite from 'sqlite-sync'

let url;
let reload = () => {
    sqlite?.connect('./db/sales.db');
}
reload();
const bot = new Telegraf(token);

bot.launch().then(async () => {
    await launchTimer();
});

bot.start((ctx) => ctx.reply('Welcome'))
bot.command('new', (ctx) => {
    ctx.telegram.sendMessage(ctx.message.chat.id, `Send url`).then(r => {
        url = r
    });
})


bot.on('text', async ctx => {
    url = ctx.message.text;
    if (!validateName(url)) return ctx.reply("Invalid url")
    let domain = getDomain(url);
    switch (domain) {
        case 'reserved.com':
        case 'sinsay.com':
        case 'housebrand.com':
        case 'mohito.com':
        case 'cropp.com': {
            let answer = await processReservedMetadata(url, domain, ctx.message.chat.id);
            ctx.reply(answer);
            break;
        }
        default:
            ctx.reply("Unable to parse this site so far")
    }
});

async function getReservedMetadata(url) {
    const context = await getHTML(url);
    const description = getContent(context, "og:description");
    const oldPrice = getContent(context, "product:original_price:amount");
    const oldPriceCurrency = getContent(context, "product:original_price:currency");
    const price = getContent(context, "product:price:amount");
    const priceCurrency = getContent(context, "product:price:currency");
    return {url, description, price, oldPrice, oldPriceCurrency, priceCurrency};
}

async function processReservedMetadata(url, domain, chatID) {
    const data = await getReservedMetadata(url, domain, chatID);
    let success = addToDB(url, data.description, domain, data.price, data.oldPrice, chatID);
    if (!success) return `Product is already tracked\n${data.description}\nСтарая цена ${data.oldPrice} ${data.oldPriceCurrency}\nНовая цена ${data.price} ${data.priceCurrency}`;

    return `${data.description}\nСтарая цена ${data.oldPrice} ${data.oldPriceCurrency}\nНовая цена ${data.price} ${data.priceCurrency}`;
}

async function addToDB(url, description, domain, price, oldPrice, chatID) {
    if (sqlite.run(`SELECT url FROM sales WHERE user_id=${chatID} AND url='${url}'`).length !== 0) return false;
    else {
        const db_request = `INSERT INTO sales(url, description, domain, new_price, old_price, user_id) VALUES('${url}', '${description}', '${domain}', ${price}, ${oldPrice},${chatID});`;
        console.log(sqlite.run(db_request));
        return true;
    }
}

async function getHTML(url) {
    const response = await fetch(url);
    return await response.text();
}

function validateName(url) {
    const URLRegex = '^(https?|ftp)://[^\\s/$.?#].[^\\s]*$';
    return url.match(URLRegex);
}

function getDomain(url, subdomain) {
    subdomain = subdomain || false;
    url = url.replace(/(https?:\/\/)?(www.)?/i, '');

    if (!subdomain) {
        url = url.split('.');

        url = url.slice(url.length - 2).join('.');
    }

    if (url.indexOf('/') !== -1) {
        return url.split('/')[0];
    }

    return url;
}

async function launchTimer() {
    let timerId = setInterval(async () => {
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
                        break;
                    } else {
                        console.log("there is diff")
                        let previous_price = item.new_price;
                        let new_price = answer.price;
                        console.log(sqlite.run(`UPDATE sales SET new_price = ${+answer.price}, old_price = ${+answer.oldPrice} WHERE id=${item.id};`));
                        let message = `The price of ${item.description}\n ${item.url} was changed from ${previous_price} to ${new_price}`;
                        await bot.telegram.sendMessage(item.user_id, message);
                        break;
                    }
                }
                default:
                    break;
            }
        }
    }, 8000);
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
