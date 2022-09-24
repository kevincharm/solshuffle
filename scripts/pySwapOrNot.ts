import { execFile as execFileCb } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { BigNumber, BigNumberish } from 'ethers'
import assert from 'assert'
import { parseBigNumberArray } from './parseBigNumberArray'
const execFile = promisify(execFileCb)

const swapOrNotPyScript = path.resolve(__dirname, '../scripts/swap_or_not.py')

/**
 * Run the reference Python script for swap-or-not shuffle, returning entire shuffled list
 *
 * @param x index to permute
 * @param modulus cardinality of list to shuffle
 * @param seed random seed
 * @param rounds how many rounds of swap-or-not to apply
 * @returns array of shuffled indices
 */
export async function pySwapOrNot(
    x: BigNumberish,
    modulus: BigNumberish,
    seed: BigNumberish,
    rounds: number
) {
    const { stdout } = await execFile('python3', [
        swapOrNotPyScript,
        BigNumber.from(modulus).toString(),
        BigNumber.from(seed).toString(),
        BigNumber.from(rounds).toString(),
        BigNumber.from(x).toString(),
    ])
    return BigNumber.from(stdout.trim())
}

/**
 * Run the reference Python script for swap-or-not shuffle, returning entire shuffled list
 *
 * @param modulus cardinality of list to shuffle
 * @param seed random seed
 * @param rounds how many rounds of swap-or-not to apply
 * @returns array of shuffled indices
 */
export async function pyMultiSwapOrNot(modulus: BigNumberish, seed: BigNumberish, rounds: number) {
    const { stdout } = await execFile('python3', [
        swapOrNotPyScript,
        BigNumber.from(modulus).toString(),
        BigNumber.from(seed).toString(),
        BigNumber.from(rounds).toString(),
    ])
    // JSON.parse already parses numbers into number types, so doesn't support bigints
    const shuffled = parseBigNumberArray(stdout)
    assert(
        shuffled.length === modulus,
        `py output didn't match input modulus (${shuffled.length} !== ${modulus})`
    )
    return shuffled
}
