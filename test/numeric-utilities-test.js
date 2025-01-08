var NumericUtilities = require("../app/util/numeric-utilities");

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
    })
})