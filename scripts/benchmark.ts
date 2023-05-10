import { BigNumber } from 'ethers'
import { ethers } from 'hardhat'
import { FeistelShuffleConsumer__factory } from '../typechain-types'
import { randomBytes } from 'crypto'
import { performance } from 'perf_hooks'

main()
    .then(() => {
        process.exit(0)
    })
    .catch((err) => {
        console.error(err)
        process.exit(1)
    })

async function main() {
    const begin = performance.now()

    const feistelResult = await benchmarkFeistel()

    console.table(feistelResult)
    console.log(`Finished in ${(performance.now() - begin) / (1000 * 60)}min.`)
}

// "1 larger than a power of 2" should (?) give a worst-case scenario
const indices = Array(96_722) // 311^2 + 1
    .fill(0)
    .map((_, i) => i)

async function benchmarkFeistel() {
    console.log('Benchmarking Feistel...')

    const signers = await ethers.getSigners()
    const deployer = signers[0]

    const feistelShuffle = await new FeistelShuffleConsumer__factory(deployer).deploy()

    // params
    const rounds = 4
    const seed = BigNumber.from('0x' + randomBytes(32).toString('hex'))

    let minGasUnopt = BigNumber.from(2n ** 255n - 1n)
    let maxGasUnopt = BigNumber.from(-(2n ** 255n - 1n))
    let sumGasUsedUnopt = BigNumber.from(0)
    let minGasOpt = BigNumber.from(2n ** 255n - 1n)
    let maxGasOpt = BigNumber.from(-(2n ** 255n - 1n))
    let sumGasUsedOpt = BigNumber.from(0)
    for (let i = 0; i < indices.length; i++) {
        process.stdout.write(`Sending tx \x1B[33K${i}/${indices.length}\r`)
        // Optimised function
        const gasUsedOpt = await deployer
            .sendTransaction(
                await feistelShuffle.populateTransaction.shuffle__OPT(
                    i,
                    indices.length,
                    seed,
                    rounds
                )
            )
            .then((tx) => tx.wait())
            .then((receipt) => receipt.gasUsed)
        sumGasUsedOpt = sumGasUsedOpt.add(gasUsedOpt)
        if (gasUsedOpt.gt(maxGasOpt)) {
            maxGasOpt = gasUsedOpt
        }
        if (gasUsedOpt.lt(minGasOpt)) {
            minGasOpt = gasUsedOpt
        }
        // Un-ptimised function
        const gasUsedUnopt = await deployer
            .sendTransaction(
                await feistelShuffle.populateTransaction.shuffle(i, indices.length, seed, rounds)
            )
            .then((tx) => tx.wait())
            .then((receipt) => receipt.gasUsed)
        sumGasUsedUnopt = sumGasUsedUnopt.add(gasUsedUnopt)
        if (gasUsedUnopt.gt(maxGasUnopt)) {
            maxGasUnopt = gasUsedUnopt
        }
        if (gasUsedUnopt.lt(minGasUnopt)) {
            minGasUnopt = gasUsedUnopt
        }
    }
    return {
        FeistelShuffleOptimised: {
            rounds,
            min: minGasOpt.sub(21000).toNumber(),
            max: maxGasOpt.sub(21000).toNumber(),
            avg: sumGasUsedOpt.div(indices.length).sub(21000).toNumber(),
        },
        FeistelShuffle: {
            rounds,
            min: minGasUnopt.sub(21000).toNumber(),
            max: maxGasUnopt.sub(21000).toNumber(),
            avg: sumGasUsedUnopt.div(indices.length).sub(21000).toNumber(),
        },
    }
}
