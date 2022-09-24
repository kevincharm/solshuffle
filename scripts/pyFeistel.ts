import { execFile as execFileCb } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { BigNumber, BigNumberish } from 'ethers'
import assert from 'assert'
import { parseBigNumberArray } from './parseBigNumberArray'
const execFile = promisify(execFileCb)

const feistelPyScript = path.resolve(__dirname, '../scripts/feistel.py')

/**
 * Run the reference Python script for Feistel shuffle, returning entire shuffled list
 *
 * @param x index to permute
 * @param modulus cardinality of list to shuffle
 * @param seed random seed
 * @param rounds how many rounds of Feistel to apply
 * @returns array of shuffled indices
 */
export async function pyFeistel(
    x: BigNumberish,
    modulus: BigNumberish,
    seed: BigNumberish,
    rounds: number
) {
    const { stdout } = await execFile('python3', [
        feistelPyScript,
        BigNumber.from(modulus).toString(),
        BigNumber.from(seed).toString(),
        BigNumber.from(rounds).toString(),
        BigNumber.from(x).toString(),
    ])
    return BigNumber.from(stdout.trim())
}

/**
 * Run the reference Python script for Feistel shuffle, returning entire shuffled list
 *
 * @param modulus cardinality of list to shuffle
 * @param seed random seed
 * @param rounds how many rounds of Feistel to apply
 * @returns array of shuffled indices
 */
export async function pyMultiFeistel(modulus: BigNumberish, seed: BigNumberish, rounds: number) {
    const { stdout } = await execFile('python3', [
        feistelPyScript,
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
