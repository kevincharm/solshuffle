```diff
- THESE CONTRACTS ARE NOT AUDITED NFA DYOR WAGMI 🫡🫡🫡
```

# 🃏 solshuffle 🃏

A smol collection of efficient, stateless shuffles written in Solidity/Yul adapted from [ethereum/research](https://github.com/ethereum/research/tree/master/shuffling).

👇👇👇👇👇👇👇👇👇👇👇👇👇👇👇

```sh
    npm install solshuffle
```

👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆

## STATELESS SHUFFLES? WUTCHU TALKIN BOUT WILLIS?

**FOR TOO LONG** have the beeple suffered trust-based off-chain raffling and lame token ID offsets passed off as ✌️"shuffles"✌️ (lookin at you, NFT devs). The predominant reason being that it costs too much gas to shuffle on-chain using a naïve algorithm that picks random elements 1-by-1 from a list or using the Fisher-Yates shuffle.

**NO LONGER❗️** Now you, too, can have CHEAP💰 SECURE🔒 INSTANT⏰ shuffles in your smart contracts. You can thank our Lord and Saviour Vitalik for doing research on shuffling for ETH-PoS block proposer selection. Shoutout to [@rpal\_](https://twitter.com/rpal_) for shilling me these cool shuffle algos :^)

## ROLL THE DICE, YOU ABSOLUTE DEGENERATE

You have a choice between:

### `FeistelShuffle`

The Feistel shuffle is cheap, coming in at ~4350 gas to calculate a permutation for a single index for a list size of 10,000.

Feistel networks are based on _round functions_, and these are run a fixed number of times, as specified in the `rounds` parameter. As long as you input a cryptographically secure random `seed`, it is sufficient to set `rounds = 4` to make a _strong_ pseudorandom permutation [[1]](#m-luby-and-c-rackoff-1988).

The figure below shows the distribution of shuffled indices (y-axis) against their original indices (x-axis) when picking $y \mid 0 \leq y \lt 1000$ with `modulus = 10_000`. Each colour represents a different run, with its own 32-byte cryptorandom seed. Every run sets `rounds = 4`. Re-run this for yourself with `yarn plot:feistel`.

![feistel_1000_1000](https://user-images.githubusercontent.com/10385659/193012477-60f74cef-c7eb-4a91-ad93-30ee6c7ab4c6.png)

### `SwapOrNotShuffle`

The swap-or-not shuffle is the algorithm used in ETH-PoS consensus clients. It is more expensive, coming in at ~34,000 gas to calculate a single permutation for a list size of 10,000.

Each round of swap-or-not performs an index swap along a pivot. As explained in [this post](https://hackmd.io/@benjaminion/shuffling), the original paper [[2]](#v-t-hoang-2012) suggests setting $\text{rounds} = 6 \cdot lg{N}$ where $N$ is the length of the list to shuffle (i.e., `modulus` parameter). The [Ethereum annotated spec](https://github.com/ethereum/annotated-spec/blob/master/phase0/beacon-chain.md#misc) sets $\text{rounds} = 90$ to support a maximum validator list size of $2^{22}$.

The figure below shows the distribution of shuffled indices (y-axis) against their original indices (x-axis) when picking $y \mid 0 \leq y \lt 1000$ with `modulus = 10_000`. Each colour represents a different run, with its own 32-byte cryptorandom seed. Every run sets `rounds = 90`. Re-run this for yourself with `yarn plot:swapornot`.

![swapornot_1000_10000_100runs](https://user-images.githubusercontent.com/10385659/193012508-ce484f46-12f2-4af7-8ea5-0c4bfd5259f1.png)

### Gas Benchmarks

```
modulus = 10_000
┌───────────┬────────┬───────┬───────┬───────┐
│  shuffle  │ rounds │  min  │  max  │  avg  │
├───────────┼────────┼───────┼───────┼───────┤
│  Feistel  │   4    │ 4326  │ 4350  │ 4349  │
│ SwapOrNot │   90   │ 33342 │ 34550 │ 33993 │
└───────────┴────────┴───────┴───────┴───────┘
```

## OK ANON, I'M CONVINCED. WHERE DO I APE?

### Example: Just-in-time NFT tokenId<->metadata shuffle

> Difficulty level: SHADOWY SUPER CODER 🥷

Shown below is a truncated example of how you'd shuffle your ERC721 metadata using the `FeistelShuffle` library, after calling VRF (or whatever CSPRNG, idgaf) to set a `randomSeed`.

```solidity
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ERC721Enumerable } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import { FeistelShuffle } from "@kevincharm/solshuffle/contracts/FeistelShuffle.sol";

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
    function tokenURI(uint256 tokenId)
        public
        view
        virtual
        override
        returns (string memory)
    {
        require(randomSeed != 0, "random seed must be initialised!!!");
        _requireMinted(tokenId);

        // statelessly map tokenId -> shuffled tokenId,
        // deterministically according to the `randomSeed` and `rounds` parameters
        uint256 shuffledTokenId = FIRST_TOKEN_ID +
            FeistelShuffle.getPermutedIndex(
                tokenId - FIRST_TOKEN_ID, /** shuffle is 0-indexed, so we add offsets */
                maxSupply, /** Must stay constant */
                uint256(randomSeed), /** Must stay constant (once set) */
                4 /** Must stay constant */
            );

        // use the shuffled tokenId as the metadata index
        return string(abi.encodePacked(_baseURI(), shuffledTokenId.toString()));
    }
}

```

## WEN TOKEN?

soon™

## License

This library is permissively licenced with the Apache 2.0 license. Additionally, you must send 1% of the gross revenue from your mint to `kevincharm.eth` if you use this library in your NFT project. This is enforced by code when you import the library, just like sudoswap is forced to pay out royalties to NFT contracts that implement EIP-2981.

## References

<a name="m-luby-and-c-rackoff-1988">[1]</a> M. Luby and C. Rackoff, “How to construct pseudorandom permutations from pseudorandom functions,” SIAM Journal on Computing, vol. 17, no. 2, pp. 373–386, 1988.

<a name="v-t-hoang-2012">[2]</a> V. T. Hoang, B. Morris, and P. Rogaway, “An enciphering scheme based on a card shuffle,” in Annual Cryptology Conference, 2012, pp. 1–13.
