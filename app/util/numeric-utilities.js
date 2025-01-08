function NumericUtilities() {

}

NumericUtilities.determineShiftedValues = (total, highestCount = 20) => {
    const values = []
    let runningTotal = total
    for (let i = highestCount; i >= 0; i--) {
        if (runningTotal >> i === 1) {
            const binValue = Math.pow(2, i)
            runningTotal = runningTotal - binValue
            values.push(binValue)
        }
    }
    return values
}

module.exports = NumericUtilities