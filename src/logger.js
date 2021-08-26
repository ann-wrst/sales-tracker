import {getCurrectTime} from "./utils.js";
import {createObjectCsvWriter} from 'csv-writer'
import {logPath} from "../config.js";

export default function writeLog(action, chatId) {
    const log = {
        time: getCurrectTime(), action: action, chatId: chatId
    }
    writeToCSV([log]);
}

function writeToCSV(records) {
    const csvWriter = createObjectCsvWriter({
        path: logPath,
        header: [
            {id: 'time', title: 'TIME'},
            {id: 'action', title: 'ACTION'},
            {id: 'chatId', title: 'CHATID'}
        ],
        append: true
    });
    csvWriter.writeRecords(records)
        .then(() => {
        });
}
