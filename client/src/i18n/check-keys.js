#!/usr/bin/env node
/*
 * en / zh-CN dictionary key-set consistency check.
 *
 * Usage:  cd client && node src/i18n/check-keys.js
 *
 * Exits non-zero when the two dictionaries do not expose exactly the same keys.
 * Plain Node, zero dependencies (parses the dictionary files as text so it also
 * works without a TS toolchain).
 */
const fs = require('fs');
const path = require('path');

const KEYS_RE = /^\s*'([^']+)':/gm;

const readKeys = (file) => {
  const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
  const keys = [];
  let match;

  while ((match = KEYS_RE.exec(source)) !== null) {
    keys.push(match[1]);
  }

  return keys;
};

const en = readKeys('en.ts');
const zh = readKeys('zh-CN.ts');

const enSet = new Set(en);
const zhSet = new Set(zh);

const onlyEn = en.filter((key) => !zhSet.has(key));
const onlyZh = zh.filter((key) => !enSet.has(key));
const duplicate = (keys) => {
  const seen = new Set();
  const dupes = new Set();

  keys.forEach((key) => {
    if (seen.has(key)) {
      dupes.add(key);
    }
    seen.add(key);
  });

  return [...dupes];
};

const enDupes = duplicate(en);
const zhDupes = duplicate(zh);

console.log(`en.ts keys      : ${en.length}`);
console.log(`zh-CN.ts keys   : ${zh.length}`);
console.log(
  `missing in zh   : ${onlyEn.length}${onlyEn.length ? ' -> ' + onlyEn.join(', ') : ''}`
);
console.log(
  `missing in en   : ${onlyZh.length}${onlyZh.length ? ' -> ' + onlyZh.join(', ') : ''}`
);
console.log(
  `duplicate keys  : en ${enDupes.length}, zh ${zhDupes.length}${enDupes.concat(zhDupes).length ? ' -> ' + enDupes.concat(zhDupes).join(', ') : ''}`
);

const ok =
  en.length > 0 &&
  en.length === zh.length &&
  onlyEn.length === 0 &&
  onlyZh.length === 0 &&
  enDupes.length === 0 &&
  zhDupes.length === 0;

console.log(ok ? 'KEY SETS MATCH' : 'KEY SETS MISMATCH');

process.exit(ok ? 0 : 1);
