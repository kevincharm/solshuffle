import { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { randomBytes } from 'crypto'
import { ERC721Shuffled, ERC721Shuffled__factory } from '../../typechain-types'

describe('ERC721Shuffled', () => {
    let deployer: SignerWithAddress
    let erc721Shuffled: ERC721Shuffled
    let seed: string
    let maxSupply: number
    before(async () => {
        const signers = await ethers.getSigners()
        deployer = signers[0]
        maxSupply = 1000
        erc721Shuffled = await new ERC721Shuffled__factory(deployer).deploy(
            'My NFT contract',
            'YEET',
            maxSupply
        )
        seed = ethers.utils.defaultAbiCoder.encode(
            ['bytes32'],
            ['0x' + randomBytes(32).toString('hex')]
        )
    })

    it('should correctly shuffle tokenIds of an NFT collection', async () => {
        await erc721Shuffled.setRandomSeed(seed)
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
