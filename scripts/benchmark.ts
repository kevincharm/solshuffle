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

    console.table({
        Feistel: feistelResult,
    })
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

    let minGas = BigNumber.from(2n ** 255n - 1n)
    let maxGas = BigNumber.from(-(2n ** 255n - 1n))
    let sumGasUsed = BigNumber.from(0)
    for (let i = 0; i < indices.length; i++) {
        process.stdout.write(`Sending tx \x1B[33K${i}/${indices.length}\r`)
        const tx = await deployer.sendTransaction(
            await feistelShuffle.populateTransaction.shuffle__OPT(i, indices.length, seed, rounds)
        )
        const { gasUsed } = await tx.wait()
        sumGasUsed = sumGasUsed.add(gasUsed)
        if (gasUsed.gt(maxGas)) {
            maxGas = gasUsed
        }
        if (gasUsed.lt(minGas)) {
            minGas = gasUsed
        }
    }
    return {
        rounds,
        min: minGas.sub(21000).toNumber(),
        max: maxGas.sub(21000).toNumber(),
        avg: sumGasUsed.div(indices.length).sub(21000).toNumber(),
    }
}
