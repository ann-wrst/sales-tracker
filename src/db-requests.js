import sqlite from "sqlite-sync";
import writeLog from "./logger.js";

export async function addToDB(url, description, domain, price, oldPrice, chatID) {
    try {
        if (sqlite.run(`SELECT url FROM sales WHERE user_id=${chatID} AND url='${url}'`).length !== 0) return false;
        else {
            const db_request = `INSERT INTO sales(url, description, domain, new_price, old_price, user_id) VALUES('${url}', '${description}', '${domain}', ${price}, ${oldPrice},${chatID});`;
            console.log(sqlite.run(db_request));
            writeLog(`Added link ${url}`, chatID)
            return true;
        }
    } catch (e) {
        throw Error("There is an error when working with database");
    }
}

export async function getList(userId) {
    try {
        return sqlite.run(`SELECT * FROM sales WHERE user_id="${userId}"`);
    } catch (e) {
        throw Error("There is an error getting the list");
    }
}

export function deleteItem(id) {
    try {
        sqlite.run(`DELETE FROM sales WHERE id=${id}`);
    } catch {
        return false;
    }
    return true;
}

export function updateItem(id, new_price, old_price) {
    sqlite.run(`UPDATE sales SET new_price = ${+new_price}, old_price = ${+old_price} WHERE id=${id};`);
}
