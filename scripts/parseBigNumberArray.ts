import { BigNumber } from 'ethers'
import assert from 'assert'

/**
 * Parse a JSON-like array into a BigNumber array.
 * Must be valid JSON and must be a top-level array.
 *
 * @param input
 * @returns array of BigNumber
 */
export function parseBigNumberArray(input: string): BigNumber[] {
    const maybeArray = JSON.parse(input)
    assert(Array.isArray(maybeArray), `expected array, but got\n${input}`)

    const trimmed = input.trim()
    assert(
        trimmed.charAt(0) === '[' && trimmed.charAt(trimmed.length - 1) === ']',
        `expected array, but got malformed input:\n${input}`
    )
    const values = trimmed
        // remove '[' and ']'
        .slice(1, trimmed.length - 1)
        // split each number separated by ',' into an array element
        .split(',')
        // trim whitespace for each number
        .map((v) => v.trim())
        // finally, parse each element as BigNumber
        .map((v) => BigNumber.from(v))
    return values
}
