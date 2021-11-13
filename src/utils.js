import fetch from "node-fetch";
import jsdom from "jsdom";

export function getDomain(url) {
    url = url.replace(/(https?:\/\/)?(www.)?/i, '');

    if (url.indexOf('/') !== -1) {
        return url.split('/')[0];
    }
    return url;
}

export async function getHTML(url, getDom = false) {
    const html = await fetch(url).then((response) => {
        return response.text();
    }).catch((error) => {
        console.log(error);
    });
    if (!getDom) return html;
    const dom = new jsdom.JSDOM(html);
    return dom.window.document;
}

export async function fetchJSON(url) {
    const response = await fetch(url);
    return await response.json();
}

export function getCurrectTime() {
    let today = new Date();
    let date = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
    let time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    return date + ' ' + time;
}

export function validateName(url) {
    const URLRegex = '^(https?|ftp)://[^\\s/$.?#].[^\\s]*$';
    return url.match(URLRegex);
}
