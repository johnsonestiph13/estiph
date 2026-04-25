const { deepClone, mergeDeep, isEmpty } = require('../../utils/objects');
const { chunk, unique, shuffle } = require('../../utils/arrays');
const { truncate, slugify } = require('../../utils/strings');

describe('Utils Tests', () => {
    describe('Object Utils', () => {
        it('should deep clone object', () => {
            const obj = { a: 1, b: { c: 2 } };
            const cloned = deepClone(obj);
            cloned.b.c = 3;
            expect(obj.b.c).toBe(2);
        });

        it('should detect empty object', () => {
            expect(isEmpty({})).toBe(true);
            expect(isEmpty({ a: 1 })).toBe(false);
        });
    });

    describe('Array Utils', () => {
        it('should chunk array', () => {
            expect(chunk([1,2,3,4,5], 2)).toEqual([[1,2],[3,4],[5]]);
        });

        it('should get unique values', () => {
            expect(unique([1,2,2,3,3,3])).toEqual([1,2,3]);
        });
    });

    describe('String Utils', () => {
        it('should truncate string', () => {
            expect(truncate('Hello World', 5)).toBe('Hello...');
        });

        it('should create slug', () => {
            expect(slugify('Hello World!')).toBe('hello-world');
        });
    });
});