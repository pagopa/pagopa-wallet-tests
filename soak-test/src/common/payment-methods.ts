import { chooseWithRatio } from "./utils";

export enum PaymentMethod {
    CARDS,
    PAYPAL
}

// These ids are for DEV
const paymentMethodIdsDev: Record<PaymentMethod, string> = {
    [PaymentMethod.CARDS]: "148ff003-46a6-4790-9376-b0e057352e45",
    [PaymentMethod.PAYPAL]: "9d735400-9450-4f7e-9431-8c1e7fa2a339",
};

// These ids are for UAT
const paymentMethodIdsUat: Record<PaymentMethod, string> = {
    [PaymentMethod.CARDS]: "f25399bf-c56f-4bd2-adc9-7aef87410609",
    [PaymentMethod.PAYPAL]: "0d1450f4-b993-4f89-af5a-1770a45f5d71",
};

export function randomPaymentMethod(apmRatio: number): PaymentMethod {
    if (chooseWithRatio(apmRatio)) {
        return PaymentMethod.PAYPAL;
    } else {
        return PaymentMethod.CARDS;
    }
}

export function paymentMethodsIdsFor(url: string): Record<PaymentMethod, string> {
    if (url.indexOf("uat") >= 0) {
        return paymentMethodIdsUat;
    }
    return paymentMethodIdsDev;
}