import {getHTML} from "./utils.js";

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
        return 'in development'
    }
}
