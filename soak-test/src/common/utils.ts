// @ts-ignore
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import { fail } from 'k6';

export function randomIntBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1) + min)
}

export const charsetAlphanumeric = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'

export function randomString(length: number, charset = 'abcdefghijklmnopqrstuvwxyz') {
    let res = ''
    while (length--) res += charset[(Math.random() * charset.length) | 0]
    return res
}

export function uuid(): string {
    return uuidv4().toString();
}

export function extractFragment(url: string, fragmentName: string): string {
    const regex = `(#|&)(${fragmentName}=)([^(&|$)]*)`;
    const matches = url.match(regex)
    if (matches != null && matches.length >= 3) {
        return matches[3]
    } else {
        fail(`Cannot get ${fragmentName} from fragments`)
    }
}

export function chooseWithRatio(ratio: number): boolean {
    return Math.random() <= ratio;
}


export type Environment = "dev" | "uat"
export function getEnvironment(baseUrl: string): Environment {
    return baseUrl.indexOf("uat") >= 0 ? "uat" : "dev";
}