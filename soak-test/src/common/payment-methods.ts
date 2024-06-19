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
    [PaymentMethod.CARDS]: "378d0b4f-8b69-46b0-8215-07785fe1aad4",
    [PaymentMethod.PAYPAL]: "8991c3f1-4ac4-418c-a359-5aaa9199bbeb",
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