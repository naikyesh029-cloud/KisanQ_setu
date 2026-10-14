import en from '@/messages/en.json';
import hi from '@/messages/hi.json';
import mr from '@/messages/mr.json';
export type Locale='en'|'hi'|'mr';
export function getDictionary(locale:string){return locale==='hi'?hi:locale==='mr'?mr:en;}
