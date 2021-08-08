import {Telegraf} from 'telegraf'
import fetch from 'node-fetch';
import {token} from './config.js'
import sqlite from 'sqlite-sync'

let url;
sqlite.connect('./db/sales.db');
const bot = new Telegraf(token);

const fn = (answer, chatID) => {
    setInterval(async () => {
        await bot.telegram.sendMessage(chatID, answer);
        //ctx.reply(answer);
    }, 20000);
}

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
            fn(answer, ctx.message.chat.id);
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

function addToDB(url, description, domain, price, oldPrice, chatID) {
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
        let rows = sqlite.run("SELECT * FROM sales;");
        await rows.forEach(async (item) => {
            switch (item.domain) {
                case 'reserved.com':
                case 'sinsay.com':
                case 'housebrand.com':
                case 'mohito.com':
                case 'cropp.com': {
                    let answer = await getReservedMetadata(item.url);
                    let result = sqlite.run(`SELECT old_price, new_price FROM sales WHERE url='${item.url}' AND user_id=${item.user_id}`);
                    if (result[0].old_price === +answer.oldPrice && result[0].new_price === +answer.price) return;
                    else //update db request and send message
                        console.log(result);
                    console.log("______________")
                    //    fn(`${answer.description}\nСтарая цена ${answer.oldPrice} ${answer.oldPriceCurrency}\nНовая цена ${answer.price} ${answer.priceCurrency}`, item.user_id);
                    break;
                }
                default:
                    break;
            }
        });
        //  trackReservedSales()
    }, 4000);

}

let trackReservedSales = () => {
    //const data = getReservedMetadata(url, domain, chatID);
    //select price, oldPrice
    //pass url

}
// name - url: array of objects

let getMeta = (property) => `<meta property="${property}" content="`;
let getRegular = (property) => new RegExp(`${getMeta(property)}(.*?)">`, "g");

let getContent = (context, property) => {
    let regular = getRegular(property);
    let result = context.match(regular);

    if (result != null) {
        return result[0].substring(getMeta(property).length, result[0].length - 2);
    }
}
