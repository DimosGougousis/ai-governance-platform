import { expect, test } from 'vitest';
import { canonicalJson, sha256Hex } from '../src/enforcement/canonical-json.js';

test('key order does not change the canonical form', () => {
  expect(canonicalJson({ b: 1, a: { d: [2, { y: 1, x: 2 }], c: null } }))
    .toBe('{"a":{"c":null,"d":[2,{"x":2,"y":1}]},"b":1}');
  expect(canonicalJson({ a: 2, b: 1 })).toBe(canonicalJson({ b: 1, a: 2 }));
});

test('undefined members are dropped, as JSON.stringify does', () => {
  expect(canonicalJson({ a: undefined, b: 1 })).toBe('{"b":1}');
});

test('sha256Hex is hex SHA-256 of UTF-8', () => {
  expect(sha256Hex("Returns the authenticated customer's own savings goals and progress."))
    .toBe('1e8d81d8e6f7a9302d95adb98bd35da93425ce3f2b803c1009d8ec9ef43cb413');
});
