import { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber, BigNumberish } from 'ethers'
import { randomBytes } from 'crypto'
import {
    ERC721Shuffled,
    ERC721Shuffled__factory,
    FeistelShuffle__factory,
} from '../../typechain-types'

describe('ERC721Shuffled', () => {
    let deployer: SignerWithAddress
    let erc721Shuffled: ERC721Shuffled
    let seed: BigNumber
    let maxSupply: number
    before(async () => {
        const signers = await ethers.getSigners()
        deployer = signers[0]
        const feistelShuffleLibrary = await new FeistelShuffle__factory(deployer).deploy()
        maxSupply = 1000
        erc721Shuffled = await new ERC721Shuffled__factory(
            {
                'contracts/FeistelShuffle.sol:FeistelShuffle': feistelShuffleLibrary.address,
            },
            deployer
        ).deploy('My NFT contract', 'YEET', maxSupply)
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

    it('should correctly shuffle tokenIds of an NFT collection', async () => {
        await erc721Shuffled.setRandomSeed(seed.toHexString())
        for (let i = 0; i < maxSupply; i++) {
            await erc721Shuffled.mint()
        }
        const tokenUris = new Set<string>()
        for (let i = 0; i < maxSupply; i++) {
            tokenUris.add(await erc721Shuffled.tokenURI(i + 1))
        }
        expect(tokenUris.size).to.equal(maxSupply)
    }).timeout(60_000)
})
