const crypto = require('crypto');

const host = 'open.volcengineapi.com';
const action = 'GetAFPUsage';
const version = '2024-01-01';
const secretKey = 'SKTEST';
const region = 'cn-beijing';
const service = 'ark';
const payload = Buffer.from('{}');
const xDate = '20260720T010203Z';
const shortDate = '20260720';
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const hmac = (key, value) => crypto.createHmac('sha256', key).update(value).digest();
const payloadHash = sha256(payload);
const query = `Action=${action}&Version=${version}`;
const signedHeaders = 'host;x-content-sha256;x-date';
const canonicalHeaders = `host:${host}\nx-content-sha256:${payloadHash}\nx-date:${xDate}\n`;
const canonicalRequest = `POST\n/\n${query}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
const scope = `${shortDate}/${region}/${service}/request`;
const stringToSign = `HMAC-SHA256\n${xDate}\n${scope}\n${sha256(Buffer.from(canonicalRequest))}`;
const kDate = hmac(Buffer.from(secretKey), shortDate);
const kRegion = hmac(kDate, region);
const kService = hmac(kRegion, service);
const kSigning = hmac(kService, 'request');

process.stdout.write(hmac(kSigning, stringToSign).toString('hex'));
