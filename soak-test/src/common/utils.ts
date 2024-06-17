// @ts-ignore
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

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