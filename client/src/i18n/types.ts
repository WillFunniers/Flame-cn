export type Lang = 'en' | 'zh-CN';

export type Dictionary = Record<string, string>;

export type Vars = Record<string, string | number>;

export type Translate = (key: string, vars?: Vars) => string;
