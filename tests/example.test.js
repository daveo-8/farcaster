import { describe, it, expect } from 'vitest';

const assert = require('assert');

describe('Example Test Suite', () => {
    it('should return true for a simple assertion', () => {
        assert.strictEqual(1 + 1, 2);
    });

    it('should check if a string contains a substring', () => {
        const str = 'Hello, world!';
        assert.ok(str.includes('world'));
    });
});