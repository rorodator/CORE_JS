import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    compareDecimal,
    formatDecimal,
    parseCanonicalNumber,
    parseDecimal,
    parseInteger,
    parseLocalizedNumber
} from '../lib/value/core-decimal.js';
import {
    compareDateTime,
    formatDate,
    formatDateTime,
    formatTime,
    parseDate,
    parseDateTime,
    parseTime
} from '../lib/value/core-date-time.js';
import {
    formatRelativeDate,
    parseRelativeDate,
    registerRelativePreset,
    unregisterRelativePreset
} from '../lib/value/core-relative-date.js';
import { foldText, textEquals, textIncludes } from '../lib/value/core-text-match.js';
import {
    compareValues,
    defaultOperator,
    isEmptyValue,
    operatorCardinality,
    operatorSupports,
    operatorsFor,
    parseRange,
    parseValue
} from '../lib/value/core-value-registry.js';

const BIG = '9007199254740993';

test('rxjs is declared for runtime, not only for development', () => {
    const packagePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../package.json');
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    assert.equal(pkg.dependencies.rxjs, '^7.8.2');
    assert.equal(pkg.peerDependencies.rxjs, '^7.8.2');
    assert.equal(pkg.devDependencies.rxjs, undefined);
});

test('US and FR decimals share one exact canonical string', () => {
    const us = parseDecimal('1,234,567.89', { locale: 'en' });
    const fr = parseDecimal('1\u00A0234\u00A0567,89', { locale: 'fr' });
    const narrow = parseDecimal('1\u202F234\u202F567,89', { locale: 'fr' });
    const spaced = parseDecimal('1 234 567,89', { locale: 'fr' });
    assert.equal(us.status, 'valid');
    assert.equal(us.value, '1234567.89');
    assert.equal(fr.value, '1234567.89');
    assert.equal(narrow.value, '1234567.89');
    assert.equal(spaced.value, '1234567.89');
    assert.equal(formatDecimal('1234567.89', { locale: 'en' }), '1,234,567.89');
    assert.equal(formatDecimal('1234567.89', { locale: 'fr' }), '1\u00A0234\u00A0567,89');
});

test('integers keep every digit past the safe integer limit', () => {
    const parsed = parseInteger(BIG);
    assert.equal(parsed.status, 'valid');
    assert.equal(parsed.value, BIG);
    assert.equal(compareDecimal(BIG, '9007199254740992'), 1);
    assert.equal(parseInteger('007').value, '7');
    assert.equal(parseInteger('1.0').status, 'invalid');
});

test('zero is present and false is not a decimal', () => {
    assert.equal(parseDecimal('0').value, '0');
    assert.equal(parseInteger('-0').value, '0');
    assert.equal(parseDecimal('-0.0').value, '0.0');
    assert.equal(isEmptyValue('decimal', '0'), false);
    assert.equal(isEmptyValue('boolean', false), false);
    assert.equal(parseDecimal(false).status, 'invalid');
    assert.equal(parseDecimal('').status, 'empty');
    assert.notEqual(parseValue('boolean', 'false').value, null);
    assert.equal(parseValue('boolean', 'false').value, false);
});

test('intermediate numeric input stays pending and raw mistakes stay invalid', () => {
    assert.equal(parseDecimal('-').status, 'pending');
    assert.equal(parseDecimal('12,', { locale: 'fr' }).status, 'pending');
    assert.equal(parseDecimal('12.', { locale: 'en' }).status, 'pending');
    assert.equal(parseInteger('12,', { locale: 'en' }).status, 'pending');
    assert.equal(parseDecimal('abc').status, 'invalid');
    assert.equal(parseDecimal('1e3').status, 'invalid');
    assert.equal(parseDecimal('+12').status, 'invalid');
    assert.equal(parseDecimal('12.3.4', { locale: 'en' }).status, 'invalid');
});

test('maxFractionDigits never rounds or truncates the canonical value', () => {
    const rejected = parseDecimal('1.239', { maxFractionDigits: 2 });
    assert.equal(rejected.status, 'invalid');
    assert.equal(rejected.value, null);
    assert.equal(rejected.errors[0].code, 'E_PRECISION');
    assert.equal(rejected.errors[0].details.exact, '1.239');
    assert.notEqual(rejected.errors[0].details.exact, '1.24');
    assert.notEqual(rejected.errors[0].details.exact, '1.23');

    const kept = parseDecimal('1.239', { maxFractionDigits: 2, excessPrecision: 'keep' });
    assert.equal(kept.status, 'valid');
    assert.equal(kept.value, '1.239');
    assert.equal(formatDecimal('1.239', { locale: 'en', maxFractionDigits: 2 }), '1.239');
    assert.equal(parseDecimal('1.10').value, '1.10');
    assert.equal(compareDecimal('1.10', '1.1'), 0);
    assert.equal(compareDecimal('-2', '-10'), 1);
});

test('dates, times, and datetimes stay strict', () => {
    const shown = parseDate('02 Nov 2026', { format: 'dd MMM yyyy' });
    assert.equal(shown.value, '2026-11-02');
    assert.equal(formatDate('2026-11-02', { format: 'dd MMM yyyy' }), '02 Nov 2026');
    assert.equal(parseDate('31 Feb 2026', { format: 'dd MMM yyyy' }).status, 'invalid');
    assert.equal(parseDate('2024-02-29').value, '2024-02-29');
    assert.equal(parseDate('1900-02-29').status, 'invalid');
    assert.equal(parseDate('2000-02-29').value, '2000-02-29');
    assert.equal(parseDate('02 Nov', { format: 'dd MMM yyyy' }).status, 'pending');

    assert.equal(parseTime('14:35:08').value, '14:35:08');
    assert.equal(parseTime('14:35', { format: 'HH:mm' }).value, '14:35:00');
    assert.equal(parseTime('14:35', { format: 'HH:mm:ss' }).status, 'pending');
    assert.equal(parseTime('24:00:00').status, 'invalid');
    const fraction = parseTime('14:35:08.1234', { fractionDigits: 3 });
    assert.equal(fraction.status, 'invalid');
    assert.equal(fraction.value, null);
    assert.equal(formatTime('14:35:08'), '14:35:08');

    const local = parseDateTime('02 Nov 2026 14:35:08', {
        format: 'dd MMM yyyy HH:mm:ss',
        temporal: 'local'
    });
    assert.equal(local.value, '2026-11-02T14:35:08');
    assert.equal(parseDateTime('2026-11-02T14:35:08Z', { temporal: 'local' }).errors[0].code, 'E_TEMPORAL_MIX');
    assert.equal(parseDateTime('2026-11-02T14:35:08', { temporal: 'offset' }).errors[0].code, 'E_TEMPORAL_MIX');

    const offset = parseDateTime('02 Nov 2026 14:35:08 +02:00', {
        format: 'dd MMM yyyy HH:mm:ss xxx',
        temporal: 'offset'
    });
    assert.equal(offset.value, '2026-11-02T14:35:08+02:00');
    assert.equal(formatDateTime('2026-11-02T14:35:08+02:00', {
        format: 'dd MMM yyyy HH:mm:ss xxx',
        temporal: 'offset'
    }), '02 Nov 2026 14:35:08 +02:00');
    assert.equal(compareDateTime('2026-11-02T14:35:08+02:00', '2026-11-02T12:35:08Z'), 0);
    assert.equal(compareDateTime('2026-11-02T14:35:08', '2026-11-02T14:35:08Z'), null);

    const badOffset = parseDateTime('2026-11-02T14:35:08+99:99', { temporal: 'offset' });
    assert.equal(badOffset.status, 'invalid');
    assert.equal(badOffset.value, null);
    assert.equal(parseDateTime('2026-11-02T14:35:08+24:00', { temporal: 'offset' }).status, 'invalid');
    assert.equal(parseDateTime('2026-11-02T14:35:08+00:60', { temporal: 'offset' }).status, 'invalid');
    assert.equal(parseDateTime('2026-11-02T14:35:08-99:99', { temporal: 'offset' }).status, 'invalid');
    assert.equal(parseDateTime('2026-11-02T14:35:08+23:59', { temporal: 'offset' }).value, '2026-11-02T14:35:08+23:59');
    assert.equal(compareDateTime('2026-11-02T14:35:08+99:99', '2026-11-02T12:35:08Z'), null);
});

test('canonical numbers and localized numbers stay distinct when grouping uses a dot', () => {
    const dot = { decimalSeparator: ',', groupSeparator: '.' };
    assert.equal(parseLocalizedNumber('1.234', dot).value, '1234');
    assert.equal(parseInteger('1.234', dot).value, '1234');
    assert.equal(parseCanonicalNumber('1.234').value, '1.234');
    assert.equal(parseDecimal('1.234', { source: 'canonical', ...dot }).value, '1.234');
    assert.equal(parseDecimal('1.234', { locale: 'fr' }).value, '1.234');
    assert.equal(parseCanonicalNumber('1.234', { locale: 'fr' }).value, '1.234');

    const samples = ['0', '1234', '1234.5', '1234567.89', '1.10'];
    const formats = [{ locale: 'en' }, { locale: 'fr' }, dot];
    for (const canonical of samples) {
        for (const options of formats) {
            const shown = formatDecimal(canonical, options);
            const parsed = parseLocalizedNumber(shown, options);
            assert.equal(parsed.status, 'valid', shown);
            assert.equal(parsed.value, canonical, `${shown} -> ${parsed.value}`);
        }
    }
});

test('relativeDate stays symbolic', () => {
    assert.deepEqual(parseRelativeDate({ preset: 'today' }).value, { preset: 'today' });
    assert.deepEqual(parseRelativeDate('{"preset":"this-month"}').value, { preset: 'this-month' });
    assert.deepEqual(parseRelativeDate({ preset: 'last-n-days', amount: 7 }).value, {
        preset: 'last-n-days',
        amount: 7
    });
    assert.deepEqual(parseRelativeDate('next-n-days:7').value, { preset: 'next-n-days', amount: 7 });
    assert.equal(formatRelativeDate({ preset: 'last-n-days', amount: 7 }), 'Last 7 days');
    assert.equal(parseRelativeDate('Last 7 days').value.preset, 'last-n-days');
    assert.equal(JSON.stringify(parseRelativeDate('Last 7 days').value).includes('2026'), false);
    assert.equal(parseRelativeDate({ preset: 'yesterday' }).errors[0].code, 'E_UNKNOWN_PRESET');
    assert.equal(parseRelativeDate({ preset: 'last-n-days', amount: 0 }).status, 'invalid');
    assert.equal(parseRelativeDate({ preset: 'last-n-days', amount: '7' }).status, 'invalid');
    assert.equal(parseRelativeDate({ preset: 'today', amount: 1 }).status, 'invalid');
    assert.equal(parseRelativeDate({ preset: 'last-n-days', amount: 1.5 }).status, 'invalid');

    registerRelativePreset('fiscal-year', {
        needsAmount: false,
        label: () => 'Fiscal year'
    });
    assert.equal(parseRelativeDate({ preset: 'fiscal-year' }).status, 'valid');
    unregisterRelativePreset('fiscal-year');
    assert.equal(parseRelativeDate({ preset: 'fiscal-year' }).status, 'invalid');
});

test('operator registry matches cardinality and defaults', () => {
    assert.equal(defaultOperator('string'), 'contains');
    assert.equal(defaultOperator('decimal'), 'eq');
    assert.equal(defaultOperator('multiSelect'), 'containsAny');
    assert.equal(defaultOperator('range'), 'between');
    assert.ok(operatorSupports('date', 'before'));
    assert.equal(operatorSupports('relativeDate', 'gt'), false);
    assert.equal(operatorCardinality('isEmpty'), 'none');
    assert.equal(operatorCardinality('between'), 'range');
    assert.equal(operatorCardinality('in'), 'list');
    assert.ok(operatorsFor('integer').includes('lte'));
    assert.equal(compareValues('decimal', '10', '2'), 1);
});

test('partial ranges are valid and reversed bounds are not', () => {
    const partial = parseRange({ min: '10', max: null }, { valueType: 'integer' });
    assert.equal(partial.status, 'valid');
    assert.deepEqual(partial.value, { min: '10', max: null });
    const reversed = parseRange({ min: '20', max: '5' }, { valueType: 'integer' });
    assert.equal(reversed.status, 'invalid');
    assert.equal(reversed.value, null);
    assert.equal(reversed.errors[0].code, 'E_RANGE_ORDER');
    assert.deepEqual(reversed.errors[0].details.exact, { min: '20', max: '5' });
    assert.equal(parseRange({ min: null, max: null }, { valueType: 'decimal' }).status, 'empty');
});

test('accent and case folding does not rewrite the original helpers', () => {
    assert.equal(textIncludes('Été', 'ete'), true);
    assert.equal(textEquals('CAFÉ', 'cafe'), true);
    assert.equal(foldText('à'), 'a');
    assert.equal(textIncludes('œuvre', 'oeuvre'), false);
});
