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
    const seed = BigInt('0x' + randomBytes(32).toString('hex'))

    let minGasUnopt = BigInt(2n ** 255n - 1n)
    let maxGasUnopt = BigInt(-(2n ** 255n - 1n))
    let sumGasUsedUnopt = BigInt(0)
    let minGasOpt = BigInt(2n ** 255n - 1n)
    let maxGasOpt = BigInt(-(2n ** 255n - 1n))
    let sumGasUsedOpt = BigInt(0)
    for (let i = 0; i < indices.length; i++) {
        process.stdout.write(`Sending tx \x1B[33K${i}/${indices.length}\r`)
        // Optimised function
        const gasUsedOpt = await deployer
            .sendTransaction(
                await feistelShuffle.shuffle__OPT.populateTransaction(
                    i,
                    indices.length,
                    seed,
                    rounds
                )
            )
            .then((tx) => tx.wait())
            .then((receipt) => receipt!.gasUsed)
        sumGasUsedOpt = sumGasUsedOpt + gasUsedOpt
        if (gasUsedOpt > maxGasOpt) {
            maxGasOpt = gasUsedOpt
        }
        if (gasUsedOpt < minGasOpt) {
            minGasOpt = gasUsedOpt
        }
        // Un-ptimised function
        const gasUsedUnopt = await deployer
            .sendTransaction(
                await feistelShuffle.shuffle.populateTransaction(i, indices.length, seed, rounds)
            )
            .then((tx) => tx.wait())
            .then((receipt) => receipt!.gasUsed)
        sumGasUsedUnopt = sumGasUsedUnopt + gasUsedUnopt
        if (gasUsedUnopt > maxGasUnopt) {
            maxGasUnopt = gasUsedUnopt
        }
        if (gasUsedUnopt < minGasUnopt) {
            minGasUnopt = gasUsedUnopt
        }
    }
    return {
        FeistelShuffleOptimised: {
            rounds,
            min: Number(minGasOpt - 21000n),
            max: Number(maxGasOpt - 21000n),
            avg: Number(sumGasUsedOpt / BigInt(indices.length) - 21000n),
        },
        FeistelShuffle: {
            rounds,
            min: Number(minGasUnopt - 21000n),
            max: Number(maxGasUnopt - 21000n),
            avg: Number(sumGasUsedUnopt / BigInt(indices.length) - 21000n),
        },
    }
}
