import NumericUtilities from "../app/util/numeric-utilities.js";

describe('numeric-utilities', () => {
    describe('determineShiftedValues', () => {
        it('single value extracted', () => {
            const v = NumericUtilities.determineShiftedValues(64)
            expect(v.length).toBe(1)
            expect(v[0]).toBe(64)
        })

        it('multiple values extracted', () => {
            const v = NumericUtilities.determineShiftedValues(98)
            expect(v.length).toBe(3)
            expect(v.includes(64)).toBe(true)
            expect(v.includes(32)).toBe(true)
            expect(v.includes(2)).toBe(true)
        })

        it('returns empty array when total is zero', () => {
            const v = NumericUtilities.determineShiftedValues(0)
            expect(v).toEqual([])
        })

        it('handles consecutive power of two flags', () => {
            const v = NumericUtilities.determineShiftedValues(127)
            expect(v).toEqual([64, 32, 16, 8, 4, 2, 1])
        })

        it('respects custom highestCount parameter limiting max bit checked', () => {
            // 98 is 0b1100010 (64 + 32 + 2).
            // With highestCount = 6 (2^6 = 64), max check starts at bit position 6.
            const v = NumericUtilities.determineShiftedValues(98, 6)
            expect(v).toEqual([64, 32, 2])
        })

        it('handles single bit with 2^0 = 1', () => {
            const v = NumericUtilities.determineShiftedValues(1)
            expect(v).toEqual([1])
        })
    })
})