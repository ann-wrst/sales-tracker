import sqlite from "sqlite-sync";
import {Makeup, Reserved, Rozetka} from "./Shop.js";
import {timerInterval} from "../config.js";
import writeLog from "./logger.js";
import {reload, updateItem} from "./db-requests.js";

class Tracker {
    constructor(bot) {
        this.bot = bot;
    }

    async launchTimer() {
        let timerId = setInterval(async () => {
            sqlite.close();
            reload();
            let rows = sqlite.run("SELECT * FROM sales;");
            for (let db_item of rows) {
                let answer;
                switch (db_item.domain) {
                    case 'reserved.com':
                    case 'sinsay.com':
                    case 'housebrand.com':
                    case 'mohito.com':
                    case 'cropp.com':
                    case 'localhost:8081': {
                        let reservedShop = new Reserved(db_item.domain);
                        answer = await reservedShop.getMetadata(db_item.url);
                        break;
                    }
                    case 'rozetka.com.ua':
                    case 'bt.rozetka.com.ua':
                    case 'hard.rozetka.com.ua': {
                        let rozetkaShop = new Rozetka(db_item.domain);
                        answer = await rozetkaShop.getMetadata(db_item.url);
                        break;
                    }
                    case 'makeup.com.ua': {
                        let makeupShop = new Makeup(db_item.domain);
                        answer = await makeupShop.getMetadata(db_item.url);
                        break;
                    }
                    default:
                        break;
                }
                await this.actualizePrice(db_item, answer);
            }
        }, timerInterval || 512000);
    }

    async actualizePrice(db_item, answer) {
        if (db_item.old_price === +answer.oldPrice && db_item.new_price === +answer.price) {
            writeLog(`Values haven\'t changed of ${db_item.url}`, db_item.user_id);
        } else {
            let previous_price = db_item.new_price;
            let new_price = answer.price;
            if (!updateItem(db_item.id, answer.price, answer.oldPrice) || typeof new_price === 'undefined') return;
            let message = `The price of ${db_item.description}\n ${db_item.url} was changed from ${previous_price} to ${new_price}`;
            writeLog(`Values have changed from ${previous_price} to ${new_price} of ${db_item.url}`, db_item.user_id)
            await this.bot.telegram.sendMessage(db_item.user_id, message);
        }
    }
}

export default Tracker;
