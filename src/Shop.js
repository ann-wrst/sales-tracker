import {fetchJSON, getHTML} from "./utils.js";

export class Shop {
    constructor(domain) {
        this.domain = domain;
    }

    getMetadata(url) {
        return 'Unable to parse this site so far';
    }
}

export class Reserved extends Shop {
    constructor(domain) {
        super(domain);
    }

    async getMetadata(url) {
        let document = await getHTML(url, true);
        try {
            const description = document.querySelector("head > meta[property=\"og:description\"]").getAttribute('content');
            const oldPrice = document.querySelector("head > meta[property=\"product:original_price:amount\"]").getAttribute('content');
            const oldPriceCurrency = document.querySelector("head > meta[property=\"product:original_price:currency\"]").getAttribute('content');
            const price = document.querySelector("head > meta[property=\"product:price:amount\"]").getAttribute('content');
            const priceCurrency = document.querySelector("head > meta[property=\"product:price:currency\"]").getAttribute('content');
            return {url, description, price, oldPrice, oldPriceCurrency, priceCurrency};
        } catch (e) {
            throw Error("There is an error parsing website")
        }
    }
}

export class Rozetka extends Shop {
    constructor(domain) {
        super(domain);
    }

    async getMetadata(url) {
        //get id from url
        let id = url.match('\\/p[0-9]{6,9}\\/');
        if (!id) throw new Error('The product with these id is not supported to be tracked'); else {
            id = id[0].substring(2, id[0].length - 1);
        }
        let response = await fetchJSON(`https://xl-catalog-api.rozetka.com.ua/v4/goods/getDetails?front-type=xl&country=UA&lang=ru&product_ids=${id}`)
        let item = response.data[0];
        let description = item.title;
        let price = item.price;
        let oldPrice = item.old_price;
        let href = item.href;
        return {href, description, price, oldPrice, oldPriceCurrency: 'UAH', priceCurrency: 'UAH'};
    }
}

export class Makeup extends Shop {
    constructor(domain) {
        super(domain);
    }

    async getMetadata(url) {
        let document = await getHTML(url, true);
        let description = document.querySelector("body > div.site-wrap > div.main-wrap > div > div > div:nth-child(2) > div.product-item > div > div.product-item__description > div.product-item__name")?.innerHTML;
        if (!description) return {};
        let price = document.querySelector("body > div.site-wrap > div.main-wrap > div > div > div:nth-child(2) > div.product-item > div > div.product-item__buy > div.product-item__row > div.product-item__price-wrap > span.product-item__price > div > span.price_item").innerHTML;
        let oldPrice = document.querySelector("body > div.site-wrap > div.main-wrap > div > div > div:nth-child(2) > div.product-item > div > div.product-item__buy > div.product-item__row > div.product-item__price-wrap > span.product-item__old-price > span.price_item").innerHTML;
        if (oldPrice === '0') oldPrice = price;
        let currency = 'UAH';
        return {url, description, price, oldPrice, oldPriceCurrency: currency, priceCurrency: currency};
    }
}
