import WooCommerceRestApi, {
  type WooRestApiOptions,
} from "woocommerce-rest-ts-api";

const options: WooRestApiOptions = {
  url: "https://biso.no",
  consumerKey: process.env.WC_CONSUMER_KEY || "",
  consumerSecret: process.env.WC_CONSUMER_SECRET || "",
  version: "wc/v3",
};

export const wcApi = new WooCommerceRestApi(options);
