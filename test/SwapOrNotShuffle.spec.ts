import { expect } from 'chai'
import { ethers } from 'hardhat'
import { SwapOrNotShuffle, SwapOrNotShuffle__factory } from '../typechain-types'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber, BigNumberish } from 'ethers'
import { randomBytes } from 'crypto'
import { execFile as execFileCb } from 'child_process'
import { promisify } from 'util'
import { pyMultiSwapOrNot, pySwapOrNot } from '../scripts/pySwapOrNot'
const execFile = promisify(execFileCb)

describe('SwapOrNotShuffle', () => {
    let deployer: SignerWithAddress
    let swapOrNotShuffle: SwapOrNotShuffle
    let indices: number[]
    let seed: string
    before(async () => {
        const signers = await ethers.getSigners()
        deployer = signers[0]
        swapOrNotShuffle = await new SwapOrNotShuffle__factory(deployer).deploy()
        indices = Array(100)
            .fill(0)
            .map((_, i) => i)
        seed = ethers.utils.defaultAbiCoder.encode(
            ['bytes32'],
            ['0x' + randomBytes(32).toString('hex')]
        )
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

    /**
     * Same as calling `swapOrNotShuffle.getPermutedIndex_REF(...)`, but additionally
     * checks the return value against the Python reference implementation and asserts
     * they're equal.
     *
     * @param x
     * @param modulus
     * @param seed
     * @param rounds
     * @returns
     */
    async function getPermutedIndexRefsChecked(
        x: BigNumberish,
        modulus: BigNumberish,
        seed: BigNumberish,
        rounds: number
    ) {
        const contractRefAnswer = await swapOrNotShuffle.getPermutedIndex_REF(
            x,
            modulus,
            seed,
            rounds
        )
        const pyRefAnswer = await pySwapOrNot(x, modulus, seed, rounds)
        expect(contractRefAnswer).to.equal(pyRefAnswer)
        return contractRefAnswer
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
            const s = await getPermutedIndexRefsChecked(i, indices.length, seed, rounds)
            const sOpt = await swapOrNotShuffle.getPermutedIndex(i, indices.length, seed, rounds)
            expect(s).to.equal(sOpt)
            shuffled.push(sOpt.toNumber())
        }
        // console.log('impl', shuffled)

        const parsedConsensusSpecOutput = await pyMultiSwapOrNot(indices.length, seed, rounds)
        // console.log('spec', parsedConsensusSpecOutput)

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

    it('should revert if modulus == 0', async () => {
        const rounds = Math.ceil(6 * Math.log2(indices.length))
        await expect(swapOrNotShuffle.getPermutedIndex_REF(0, 0, seed, rounds)).to.be.revertedWith(
            'x too large or modulus OOB'
        )
        await expect(swapOrNotShuffle.getPermutedIndex(0, 0, seed, rounds)).to.be.reverted
    })

    it('should handle small modulus', async () => {
        // This is mainly to ensure the sqrt / nextPerfectSquare functions are correct
        const rounds = 4

        // list size of 1
        let modulus = 1
        const permutedOneRef = await getPermutedIndexRefsChecked(0, modulus, seed, rounds)
        expect(permutedOneRef).to.equal(0)
        expect(permutedOneRef).to.equal(
            await swapOrNotShuffle.getPermutedIndex(0, modulus, seed, rounds)
        )

        // list size of 2
        modulus = 2
        const shuffledTwo = new Set<number>()
        for (let i = 0; i < modulus; i++) {
            shuffledTwo.add(
                (await getPermutedIndexRefsChecked(i, modulus, seed, rounds)).toNumber()
            )
        }
        // |shuffledSet| = modulus
        expect(shuffledTwo.size).to.equal(modulus)
        // set equality with optimised version
        for (let i = 0; i < modulus; i++) {
            shuffledTwo.delete(
                (await swapOrNotShuffle.getPermutedIndex(i, modulus, seed, rounds)).toNumber()
            )
        }
        expect(shuffledTwo.size).to.equal(0)

        // list size of 3
        modulus = 3
        const shuffledThree = new Set<number>()
        for (let i = 0; i < modulus; i++) {
            shuffledThree.add(
                (await getPermutedIndexRefsChecked(i, modulus, seed, rounds)).toNumber()
            )
        }
        // |shuffledSet| = modulus
        expect(shuffledThree.size).to.equal(modulus)
        // set equality with optimised version
        for (let i = 0; i < modulus; i++) {
            shuffledThree.delete(
                (await swapOrNotShuffle.getPermutedIndex(i, modulus, seed, rounds)).toNumber()
            )
        }
        expect(shuffledThree.size).to.equal(0)
    })
})
