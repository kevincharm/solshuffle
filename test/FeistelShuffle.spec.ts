import { expect } from 'chai'
import { ethers } from 'hardhat'
import { FeistelShuffleConsumer, FeistelShuffleConsumer__factory } from '../typechain-types'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber, BigNumberish } from 'ethers'
import { randomBytes } from 'crypto'
import * as tsFeistel from '@kevincharm/gfc-fpe'
import { solidityKeccak256 } from 'ethers/lib/utils'

const f = (R: bigint, i: bigint, seed: bigint, domain: bigint) =>
    BigNumber.from(
        solidityKeccak256(['uint256', 'uint256', 'uint256', 'uint256'], [R, i, seed, domain])
    ).toBigInt()

describe('FeistelShuffle', () => {
    let deployer: SignerWithAddress
    let feistelShuffle: FeistelShuffleConsumer
    let indices: number[]
    let seed: string
    before(async () => {
        const signers = await ethers.getSigners()
        deployer = signers[0]
        feistelShuffle = await new FeistelShuffleConsumer__factory(deployer).deploy()
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
     * Same as calling `feistelShuffle.shuffle(...)`, but additionally
     * checks the return value against the reference implementation and asserts
     * they're equal.
     *
     * @param x
     * @param domain
     * @param seed
     * @param rounds
     * @returns
     */
    async function checkedShuffle(
        x: BigNumberish,
        domain: BigNumberish,
        seed: BigNumberish,
        rounds: number
    ) {
        const contractRefAnswer = await feistelShuffle.shuffle(x, domain, seed, rounds)
        const refAnswer = await tsFeistel.encrypt(
            BigNumber.from(x).toBigInt(),
            BigNumber.from(domain).toBigInt(),
            BigNumber.from(seed).toBigInt(),
            BigNumber.from(rounds).toBigInt(),
            f
        )
        expect(contractRefAnswer).to.equal(refAnswer)
        // Compute x from x' using the inverse function
        expect(await feistelShuffle.deshuffle(contractRefAnswer, domain, seed, rounds)).to.eq(x)
        expect(await feistelShuffle.deshuffle__OPT(contractRefAnswer, domain, seed, rounds)).to.eq(
            x
        )
        return contractRefAnswer
    }

    it('should create permutation with FeistelShuffle', async () => {
        const rounds = 4
        const shuffled: BigNumber[] = []
        for (let i = 0; i < indices.length; i++) {
            const s = await feistelShuffle.shuffle__OPT(i, indices.length, seed, rounds)
            shuffled.push(s)
        }
        assertSetEquality(
            indices,
            shuffled.map((s) => s.toNumber())
        )

        // GASSSS
        let sumGasUsed = BigNumber.from(0)
        let maxGasUsed = BigNumber.from(0)
        for (let i = 0; i < indices.length; i++) {
            const _txSingle = await deployer.sendTransaction(
                await feistelShuffle.populateTransaction.shuffle(i, indices.length, seed, rounds)
            )
            const txSingle = await _txSingle.wait()
            const _txSingleOpt = await deployer.sendTransaction(
                await feistelShuffle.populateTransaction.shuffle__OPT(
                    i,
                    indices.length,
                    seed,
                    rounds
                )
            )
            const txSingleOpt = await _txSingleOpt.wait()
            expect(txSingleOpt.gasUsed).to.be.lessThan(txSingle.gasUsed)
            const actualGasUsed = txSingleOpt.gasUsed.sub(21_000)
            if (actualGasUsed.gt(maxGasUsed)) {
                maxGasUsed = actualGasUsed
            }
            sumGasUsed = sumGasUsed.add(actualGasUsed)
        }
        const averageGasUsed = sumGasUsed.div(indices.length)
        // console.log('Feistel avg gas:', averageGasUsed)
        expect(averageGasUsed).to.be.lessThanOrEqual(3450) // <-- AVG gas
        // console.log('Feistel max gas:', maxGasUsed)
        expect(maxGasUsed).to.be.lessThanOrEqual(3450) // <-- MAX gas per single call
    })

    it('should match reference implementation', async () => {
        const rounds = 4
        const shuffled: number[] = []
        for (const i of indices) {
            // Test both unoptimised & optimised versions
            const s = await checkedShuffle(i, indices.length, seed, rounds)
            // Test that optimised Yul version spits out the same output
            const sOpt = await feistelShuffle.shuffle__OPT(i, indices.length, seed, rounds)
            expect(s).to.equal(sOpt)
            shuffled.push(sOpt.toNumber())
        }

        const specOutput: bigint[] = []
        for (const index of indices) {
            const xPrime = await tsFeistel.encrypt(
                BigInt(index),
                BigInt(indices.length),
                BigNumber.from(seed).toBigInt(),
                BigNumber.from(rounds).toBigInt(),
                f
            )
            specOutput.push(xPrime)
        }

        expect(shuffled).to.deep.equal(specOutput)
    })

    it('should revert if x >= modulus', async () => {
        const rounds = 4
        // on boundary
        await expect(feistelShuffle.shuffle(100, 100, seed, rounds)).to.be.revertedWith(
            'x too large'
        )
        await expect(feistelShuffle.shuffle__OPT(100, 100, seed, rounds)).to.be.reverted
        // past boundary
        await expect(feistelShuffle.shuffle(101, 100, seed, rounds)).to.be.revertedWith(
            'x too large'
        )
        await expect(feistelShuffle.shuffle__OPT(101, 100, seed, rounds)).to.be.reverted
    })

    it('should revert if modulus == 0', async () => {
        const rounds = 4
        await expect(feistelShuffle.shuffle(0, 0, seed, rounds)).to.be.revertedWith(
            'modulus must be > 0'
        )
        await expect(feistelShuffle.shuffle__OPT(0, 0, seed, rounds)).to.be.reverted
    })

    it('should handle small modulus', async () => {
        // This is mainly to ensure the sqrt / nextPerfectSquare functions are correct
        const rounds = 4

        // list size of 1
        let modulus = 1
        const permutedOneRef = await checkedShuffle(0, modulus, seed, rounds)
        expect(permutedOneRef).to.equal(0)
        expect(permutedOneRef).to.equal(await feistelShuffle.shuffle__OPT(0, modulus, seed, rounds))

        // list size of 2
        modulus = 2
        const shuffledTwo = new Set<number>()
        for (let i = 0; i < modulus; i++) {
            shuffledTwo.add((await checkedShuffle(i, modulus, seed, rounds)).toNumber())
        }
        // |shuffledSet| = modulus
        expect(shuffledTwo.size).to.equal(modulus)
        // set equality with optimised version
        for (let i = 0; i < modulus; i++) {
            shuffledTwo.delete(
                (await feistelShuffle.shuffle__OPT(i, modulus, seed, rounds)).toNumber()
            )
        }
        expect(shuffledTwo.size).to.equal(0)

        // list size of 3
        modulus = 3
        const shuffledThree = new Set<number>()
        for (let i = 0; i < modulus; i++) {
            shuffledThree.add((await checkedShuffle(i, modulus, seed, rounds)).toNumber())
        }
        // |shuffledSet| = modulus
        expect(shuffledThree.size).to.equal(modulus)
        // set equality with optimised version
        for (let i = 0; i < modulus; i++) {
            shuffledThree.delete(
                (await feistelShuffle.shuffle__OPT(i, modulus, seed, rounds)).toNumber()
            )
        }
        expect(shuffledThree.size).to.equal(0)

        // list size of 4 (past boundary)
        modulus = 4
        const shuffledFour = new Set<number>()
        for (let i = 0; i < modulus; i++) {
            shuffledFour.add((await checkedShuffle(i, modulus, seed, rounds)).toNumber())
        }
        // |shuffledSet| = modulus
        expect(shuffledFour.size).to.equal(modulus)
        // set equality with optimised version
        for (let i = 0; i < modulus; i++) {
            shuffledFour.delete(
                (await feistelShuffle.shuffle__OPT(i, modulus, seed, rounds)).toNumber()
            )
        }
        expect(shuffledFour.size).to.equal(0)
    })
})
