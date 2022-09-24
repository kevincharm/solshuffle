import { expect } from 'chai'
import { ethers } from 'hardhat'
import { FeistelShuffle, FeistelShuffle__factory } from '../typechain-types'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber, BigNumberish } from 'ethers'
import { randomBytes } from 'crypto'
import { pyFeistel, pyMultiFeistel } from '../scripts/pyFeistel'

describe('FeistelShuffle', () => {
    let deployer: SignerWithAddress
    let feistelShuffle: FeistelShuffle
    let indices: number[]
    let seed: BigNumber
    before(async () => {
        const signers = await ethers.getSigners()
        deployer = signers[0]
        feistelShuffle = await new FeistelShuffle__factory(deployer).deploy()
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

    /**
     * Same as calling `feistelShuffle.getPermutedIndex_REF(...)`, but additionally
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
        const contractRefAnswer = await feistelShuffle.getPermutedIndex_REF(
            x,
            modulus,
            seed,
            rounds
        )
        const pyRefAnswer = await pyFeistel(x, modulus, seed, rounds)
        expect(contractRefAnswer).to.equal(pyRefAnswer)
        return contractRefAnswer
    }

    it('should create permutation with FeistelShuffle', async () => {
        const rounds = 4
        const shuffled: BigNumber[] = []
        for (let i = 0; i < indices.length; i++) {
            const s = await feistelShuffle.getPermutedIndex(i, indices.length, seed, rounds)
            shuffled.push(s)
        }
        assertSetEquality(
            indices,
            shuffled.map((s) => s.toNumber())
        )
        // console.log(
        //     shuffled.length,
        //     shuffled.map((s) => s.toNumber())
        // )

        // GASSSS
        let sumGasUsed = BigNumber.from(0)
        let maxGasUsed = BigNumber.from(0)
        for (let i = 0; i < indices.length; i++) {
            const _txSingle = await deployer.sendTransaction(
                await feistelShuffle.populateTransaction.getPermutedIndex_REF(
                    i,
                    indices.length,
                    seed,
                    rounds
                )
            )
            const txSingle = await _txSingle.wait()
            const _txSingleOpt = await deployer.sendTransaction(
                await feistelShuffle.populateTransaction.getPermutedIndex(
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
        console.log('Feistel avg gas:', averageGasUsed)
        console.log('Feistel max gas:', maxGasUsed)
        expect(averageGasUsed).to.be.lessThanOrEqual(3450) // <-- AVG gas
        expect(maxGasUsed).to.be.lessThanOrEqual(3450) // <-- MAX gas per single call
    })

    it('should match ethereum/research implementation', async () => {
        const rounds = 4
        const shuffled: number[] = []
        for (const i of indices) {
            // Test both unoptimised & optimised versions
            const s = await getPermutedIndexRefsChecked(i, indices.length, seed, rounds)
            const sOpt = await feistelShuffle.getPermutedIndex(i, indices.length, seed, rounds)
            expect(s).to.equal(sOpt)
            shuffled.push(sOpt.toNumber())
        }
        // console.log('impl', shuffled)

        const parsedConsensusSpecOutput = await pyMultiFeistel(indices.length, seed, rounds)
        // console.log('spec', parsedConsensusSpecOutput)

        expect(shuffled).to.deep.equal(parsedConsensusSpecOutput)
    })

    it('should revert if x >= modulus', async () => {
        const rounds = 4
        // on boundary
        await expect(
            feistelShuffle.getPermutedIndex_REF(100, 100, seed, rounds)
        ).to.be.revertedWith('x too large')
        await expect(feistelShuffle.getPermutedIndex(100, 100, seed, rounds)).to.be.reverted
        // past boundary
        await expect(
            feistelShuffle.getPermutedIndex_REF(101, 100, seed, rounds)
        ).to.be.revertedWith('x too large')
        await expect(feistelShuffle.getPermutedIndex(101, 100, seed, rounds)).to.be.reverted
    })

    it('should revert if modulus == 0', async () => {
        const rounds = 4
        await expect(feistelShuffle.getPermutedIndex_REF(0, 0, seed, rounds)).to.be.revertedWith(
            'modulus must be > 0'
        )
        await expect(feistelShuffle.getPermutedIndex(0, 0, seed, rounds)).to.be.reverted
    })

    it('should handle small modulus', async () => {
        // This is mainly to ensure the sqrt / nextPerfectSquare functions are correct
        const rounds = 4

        // list size of 1
        let modulus = 1
        const permutedOneRef = await getPermutedIndexRefsChecked(0, modulus, seed, rounds)
        expect(permutedOneRef).to.equal(0)
        expect(permutedOneRef).to.equal(
            await feistelShuffle.getPermutedIndex(0, modulus, seed, rounds)
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
                (await feistelShuffle.getPermutedIndex(i, modulus, seed, rounds)).toNumber()
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
                (await feistelShuffle.getPermutedIndex(i, modulus, seed, rounds)).toNumber()
            )
        }
        expect(shuffledThree.size).to.equal(0)

        // list size of 4 (past boundary)
        modulus = 4
        const shuffledFour = new Set<number>()
        for (let i = 0; i < modulus; i++) {
            shuffledFour.add(
                (await getPermutedIndexRefsChecked(i, modulus, seed, rounds)).toNumber()
            )
        }
        // |shuffledSet| = modulus
        expect(shuffledFour.size).to.equal(modulus)
        // set equality with optimised version
        for (let i = 0; i < modulus; i++) {
            shuffledFour.delete(
                (await feistelShuffle.getPermutedIndex(i, modulus, seed, rounds)).toNumber()
            )
        }
        expect(shuffledFour.size).to.equal(0)
    })

    it('should revert if modulus**(round-1) would revert', async () => {
        const rounds = 3

        const modulusLt128 = BigNumber.from(2).pow(128).sub(1)
        // before boundary
        expect(
            await getPermutedIndexRefsChecked(14351, modulusLt128, seed, rounds)
        ).to.be.instanceOf(BigNumber)
        expect(
            await feistelShuffle.getPermutedIndex(14351, modulusLt128, seed, rounds)
        ).to.be.instanceOf(BigNumber)

        const modulusEq128 = BigNumber.from(2).pow(128)
        // on boundary
        await expect(getPermutedIndexRefsChecked(14351, modulusEq128, seed, rounds)).to.be.reverted
        await expect(feistelShuffle.getPermutedIndex(58470, modulusEq128, seed, rounds)).to.be
            .reverted

        const modulusGt128 = BigNumber.from(2).pow(128).add(1)
        // past boundary
        await expect(getPermutedIndexRefsChecked(4664563, modulusGt128, seed, rounds)).to.be
            .reverted
        await expect(feistelShuffle.getPermutedIndex(2454266, modulusGt128, seed, rounds)).to.be
            .reverted
    })
})
