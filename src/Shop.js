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
        let context = await getHTML(url);
        try {
            const description = this.getContent(context, "og:description");
            const oldPrice = this.getContent(context, "product:original_price:amount");
            const oldPriceCurrency = this.getContent(context, "product:original_price:currency");
            const price = this.getContent(context, "product:price:amount");
            const priceCurrency = this.getContent(context, "product:price:currency");
            return {url, description, price, oldPrice, oldPriceCurrency, priceCurrency};
        } catch (e) {
            throw Error("There is an error parsing website")
        }
    }

    getMeta = (property) => `<meta property="${property}" content="`;

    getContent = (context, property) => {
        let regular = new RegExp(`${this.getMeta(property)}(.*?)">`, "g");
        let result = context.match(regular);

        if (result != null) {
            return result[0].substring(this.getMeta(property).length, result[0].length - 2);
        }
    }
}

export class Rozetka extends Shop {
    constructor(domain) {
        super(domain);
    }

    async getMetadata(url) {
        //get id from url
        let id = url.match('\\/p[0-9]{7,9}\\/');
        if (!id) throw new Error('Id of product is not found'); else {
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
