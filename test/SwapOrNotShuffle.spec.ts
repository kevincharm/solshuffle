import { expect } from 'chai'
import { ethers } from 'hardhat'
import { SwapOrNotShuffle, SwapOrNotShuffle__factory } from '../typechain-types'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber } from 'ethers'
import { randomBytes } from 'crypto'
import { execFile as execFileCb } from 'child_process'
import { promisify } from 'util'
import path from 'path'
const execFile = promisify(execFileCb)

describe('SwapOrNotShuffle', () => {
    let deployer: SignerWithAddress
    let swapOrNotShuffle: SwapOrNotShuffle
    let indices: number[]
    let seed: BigNumber
    before(async () => {
        const signers = await ethers.getSigners()
        deployer = signers[0]
        swapOrNotShuffle = await new SwapOrNotShuffle__factory(deployer).deploy()
        indices = Array(100)
            .fill(0)
            .map((_, i) => i)
        seed = BigNumber.from('0x' + randomBytes(32).toString('hex'))
    })

    function assertSetEquality(left: number[], right: number[]) {
        const set = new Set<number>()
        for (const l of left) {
            set.add(l)
        }
        expect(set.size).to.equal(left.length)
        for (const r of right) {
            expect(set.delete(r)).to.equal(true, `${r} exists in left`)
        }
        expect(set.size).to.equal(0)
    }

    it('should create permutation with SwapOrNotShuffle', async () => {
        const shuffled: number[] = []
        // On # of rounds for theoretical security:
        //  https://github.com/ethereum/annotated-spec/blob/master/phase0/beacon-chain.md
        const rounds = Math.ceil(6 * Math.log2(indices.length))
        for (const i of indices) {
            const s = await swapOrNotShuffle.getPermutedIndex(i, indices.length, seed, rounds)
            shuffled.push(s.toNumber())
        }
        // console.log(indices.length, indices)
        // console.log(shuffled.length, shuffled)
        // console.log(
        //     shuffled.length,
        //     shuffled.slice().sort((a, b) => a - b)
        // )
        assertSetEquality(indices, shuffled)

        // GAS!
        const _txSingle = await deployer.sendTransaction(
            await swapOrNotShuffle.populateTransaction.getPermutedIndex_REF(
                Math.floor(Math.random() * indices.length),
                indices.length,
                seed,
                rounds
            )
        )
        const txSingle = await _txSingle.wait()
        const _txSingleOpt = await deployer.sendTransaction(
            await swapOrNotShuffle.populateTransaction.getPermutedIndex(
                Math.floor(Math.random() * indices.length),
                indices.length,
                seed,
                rounds
            )
        )
        const txSingleOpt = await _txSingleOpt.wait()
        expect(txSingleOpt.gasUsed).is.lessThan(txSingle.gasUsed)
        expect(txSingleOpt.gasUsed.sub(21_000)).to.be.lessThanOrEqual(16_500) // <-- max gas per single call
    })

    it('should match consensus specs', async () => {
        const rounds = Math.ceil(6 * Math.log2(indices.length))
        const shuffled: number[] = []
        for (const i of indices) {
            // Test both unoptimised & optimised versions
            const s = await swapOrNotShuffle.getPermutedIndex_REF(i, indices.length, seed, rounds)
            const sOpt = await swapOrNotShuffle.getPermutedIndex(i, indices.length, seed, rounds)
            expect(s).to.equal(sOpt)
            shuffled.push(sOpt.toNumber())
        }
        console.log('impl', shuffled)

        const { stdout } = await execFile('python3', [
            path.resolve(__dirname, '../scripts/swap_or_not.py'),
            indices.length.toString(),
            seed.toString(),
            rounds.toString(),
        ])
        const parsedConsensusSpecOutput = JSON.parse(stdout)
        console.log('spec', parsedConsensusSpecOutput)

        expect(shuffled).to.deep.equal(parsedConsensusSpecOutput)
    })

    it('should reject out-of-bounds modulus', async () => {
        const rounds = Math.ceil(6 * Math.log2(indices.length))
        const oobModulus = BigNumber.from(2).pow(255)
        await expect(
            swapOrNotShuffle.getPermutedIndex_REF(69, oobModulus, seed, rounds)
        ).to.be.revertedWith('x too large or modulus OOB')
        await expect(swapOrNotShuffle.getPermutedIndex(69, oobModulus, seed, rounds)).to.be.reverted
    })

    it('should reject if x >= modulus', async () => {
        const rounds = Math.ceil(6 * Math.log2(indices.length))
        // on boundary
        await expect(
            swapOrNotShuffle.getPermutedIndex_REF(100, 100, seed, rounds)
        ).to.be.revertedWith('x too large or modulus OOB')
        await expect(swapOrNotShuffle.getPermutedIndex(100, 100, seed, rounds)).to.be.reverted
        // past boundary
        await expect(
            swapOrNotShuffle.getPermutedIndex_REF(101, 100, seed, rounds)
        ).to.be.revertedWith('x too large or modulus OOB')
        await expect(swapOrNotShuffle.getPermutedIndex(101, 100, seed, rounds)).to.be.reverted
    })
})
