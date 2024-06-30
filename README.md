# 🃏 solshuffle 🃏

Gas-efficient stateless shuffle implemented in Solidity/Yul, for all your onchain permutation needs.

👇👇👇👇👇👇👇👇👇👇👇👇👇👇👇

```sh
    npm install solshuffle
```

👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆

## 1) What

You've probably tried writing a raffle in Solidity. How much does it cost to pick 10 winners? 100? 1000? Probably millions of gas. Using `solshuffle`, you can determine the draw sequence of the user at the time of claiming. Combine this with a Merkle tree and you can have extremely efficient raffles (think cutting 10M gas down to <100k gas). Check out [my talk at EthCC](https://www.youtube.com/watch?v=d7C1pLKM_Oc) to learn how you can do extremely gas-efficient raffles with the [Lazy Merkle Raffle](https://docs.fairy.dev/theory/lazy-merkle-raffle).

Another application for `solshuffle` is to shuffle NFT token identifiers. You've probably seen NFT contracts that simply add a randomised offset and call that a "shuffle". Now you can stop faking it and actually shuffle your token identifiers.

Shoutout to [@rpal\_](https://twitter.com/rpal_) for shilling me cool shuffle algos!

Find the accompanying TypeScript library (and reference implementation) [here](https://github.com/kevincharm/gfc-fpe).

## Usage

### Example: Just-in-time NFT tokenId<->metadata shuffle

> Difficulty level: SHADOWY SUPER CODER 🥷

Shown below is a truncated example of how you'd shuffle your ERC721 metadata using the `FeistelShuffleOptimised` library, after calling a VRF (or whatever) to set a `randomSeed`.

```solidity
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ERC721Enumerable } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import { FeistelShuffleOptimised } from "solshuffle/contracts/FeistelShuffleOptimised.sol";

contract ERC721Shuffled is ERC721, ERC721Enumerable {
    using Strings for uint256;

    /// @notice The first token ID. For most NFT collections, this is 1.
    uint256 public constant FIRST_TOKEN_ID = 1;
    /// @notice The max supply is used as the modulus parameter in the shuffle algos.
    uint256 public immutable maxSupply;
    /// @notice Random seed that determines the permutation of the shuffle,
    ///     should only be set once.
    bytes32 public randomSeed;

    /// @notice Return a shuffled tokenURI, calculated just-in-time when this function
    ///     is called
    /// @param tokenId token id
    /// @return URI pointing to metadata
    function tokenURI(
        uint256 tokenId
    ) public view virtual override returns (string memory) {
        require(randomSeed != 0, "random seed must be initialised!!!");
        _requireMinted(tokenId);

        // statelessly map tokenId -> shuffled tokenId,
        // deterministically according to the `randomSeed` and `rounds` parameters
        uint256 shuffledTokenId = FIRST_TOKEN_ID +
            FeistelShuffleOptimised.shuffle(
                tokenId -
                    FIRST_TOKEN_ID /** shuffle is 0-indexed, so we add offsets */,
                maxSupply /** Must stay constant */,
                uint256(randomSeed) /** Must stay constant (once set) */,
                4 /** Must stay constant */
            );

        // use the shuffled tokenId as the metadata index
        return string(abi.encodePacked(_baseURI(), shuffledTokenId.toString()));
    }
}
```

## Specifications

The stateless shuffle implemented by `solshuffle` is the Generalised Feistel Cipher, but we'll just call it the Feistel Shuffle. The Feistel shuffle is cheap, coming in at ~4350 gas to calculate a permutation for a single index for a list size of 10,000.

Feistel networks are based on _round functions_, and these are run a fixed number of times, as specified in the `rounds` parameter. As long as you input a cryptographically secure random `seed`, it is sufficient to set `rounds = 4` to make a _strong_ pseudorandom permutation [[1]](#m-luby-and-c-rackoff-1988).

The figure below shows the distribution of shuffled indices (y-axis) against their original indices (x-axis) when picking $y \mid 0 \leq y \lt 1000$ with `modulus = 10_000`. Each colour represents a different run, with its own 32-byte cryptorandom seed. Every run sets `rounds = 4`. Re-run this for yourself with `yarn plot:feistel`.

![feistel_1000_1000](https://user-images.githubusercontent.com/10385659/193012477-60f74cef-c7eb-4a91-ad93-30ee6c7ab4c6.png)

### Gas Benchmarks

```
domain = 96_722
┌─────────────────────────┬────────┬──────┬───────┬──────┐
│         (index)         │ rounds │ min  │  max  │ avg  │
├─────────────────────────┼────────┼──────┼───────┼──────┤
│ FeistelShuffleOptimised │   4    │ 4008 │ 5430  │ 4040 │
│     FeistelShuffle      │   4    │ 7255 │ 11786 │ 7297 │
└─────────────────────────┴────────┴──────┴───────┴──────┘
```

## Security

This repository has not received an individual security audit. However, both `FeistelShuffle.sol` and `FeistelShuffleOptimised.sol` were audited by Trail of Bits as part of the Ethereum Foundation's [Devcon Auction-Raffle contracts](https://github.com/efdevcon/devcon-raffle). [View the audit here](https://github.com/efdevcon/devcon-raffle/blob/849ad0b18e48a10900c37a5275e5b16b997abf59/audits/Ethereum%20Foundation%20Devcon%20Auction-Raffle%20Summary%20Report.pdf).

## License

This library is permissively licenced with the MIT license. Send tokens to `kevincharm.eth` if you find the library useful for your project :^)

## Disclaimer

Ensure you understand the theory behind the [Generalised Feistel Cipher](https://github.com/kevincharm/gfc-fpe/blob/master/README.md), such as the iteration upper bounds, which may consume more gas than the expected average in unlucky scenarios.

## WEN TOKEN?

soon™

## References

<a name="m-luby-and-c-rackoff-1988">[1]</a> M. Luby and C. Rackoff, “How to construct pseudorandom permutations from pseudorandom functions,” SIAM Journal on Computing, vol. 17, no. 2, pp. 373–386, 1988.

<a name="v-t-hoang-2012">[2]</a> V. T. Hoang, B. Morris, and P. Rogaway, “An enciphering scheme based on a card shuffle,” in Annual Cryptology Conference, 2012, pp. 1–13.
