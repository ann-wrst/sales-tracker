import {Telegraf} from 'telegraf'
import {getDomain, validateName} from './utils.js'
import {token} from "../config.js";
import {addToDB, reload} from "./db-requests.js";
import {Makeup, Reserved, Rozetka} from "./Shop.js";
import Tracker from "./Tracker.js";
import {start} from "./commands/start.js"
import {list} from "./commands/list.js";
import {deleteCommand} from "./commands/delete.js";

let url;
reload();
const bot = new Telegraf(token || process.env.token);

bot.launch().then(async () => {
    let tracker = new Tracker(bot);
    await tracker.launchTimer();
});

bot.start(async (ctx) => start(bot, ctx));

bot.command('list', async (ctx) => list(bot, ctx));

bot.command('delete', async (ctx) => deleteCommand(bot, ctx));

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
            case 'cropp.com': {
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
        let message = data.oldPrice === data.price ? `${data.description}\nPrice ${data.price} ${data.priceCurrency}` : `${data.description}\nOld price ${data.oldPrice} ${data.oldPriceCurrency}\nNew price ${data.price} ${data.priceCurrency}`;
        if (!notTracked) return `Product is already tracked\n${message}`;
        else return `${message}`;
    } catch (e) {
        return e.message;
    }
}
//small test
