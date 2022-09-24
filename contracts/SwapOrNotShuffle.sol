// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8;

/// @title SwapOrNotShuffle
/// @author kevincharm
/// @notice Implementation of the swap-or-not shuffle algorithm based on [1].
///     Adapted from vbuterin's python implementation [2].
///     [1]: https://arxiv.org/pdf/1208.1176.pdf
///     [2]: https://github.com/ethereum/research/blob/master/shuffling/swap_or_not_shuffle.py
library SwapOrNotShuffle {
    /// @notice Return higher of `a` or `b`
    /// @param a left value
    /// @param b right value
    function max(int256 a, int256 b) private pure returns (int256 c) {
        assembly {
            switch gt(a, b)
            case 1 {
                c := a
            }
            default {
                c := b
            }
        }
    }

    /// @notice (a mod b) operation, but more sane (??) for negative `a`
    /// @param a dividend
    /// @param b divisor
    /// @return c = a mod b
    function floormod(int256 a, int256 b) private pure returns (int256 c) {
        assembly {
            switch slt(a, 0)
            case 1 {
                a := sub(0, a)
                c := sub(b, smod(a, b))
            }
            default {
                c := smod(a, b)
            }
        }
    }

    /// @notice Returns shuffled index of `pos` after a swap-or-not permutation
    /// @dev This is the unoptimised/reference form intended for testing specs.
    ///     Use #getPermutedIndex in your contract instead.
    /// @param x_ original index to shuffle
    /// @param modulus_ cardinality of list
    /// @param seed random seed; determines permutation
    /// @param rounds number of hashing rounds
    /// @return p shuffled (permuted) index
    function getPermutedIndex_REF(
        uint256 x_,
        uint256 modulus_,
        uint256 seed,
        uint8 rounds
    ) external pure returns (uint256) {
        // We accept uint256 for convenience, but we need signed ints for the algo
        require(
            x_ < modulus_ &&
                modulus_ != 0 &&
                modulus_ <= uint256(type(int256).max),
            "x too large or modulus OOB"
        );
        int256 x = int256(x_);
        int256 modulus = int256(modulus_);

        for (uint8 r = 0; r < rounds; ++r) {
            uint64 h64 = uint64(
                uint256(keccak256(abi.encodePacked(seed, r))) >> 192
            );
            int256 pivot = int256(h64 % uint256(modulus));
            int256 flip = floormod(pivot - x, modulus);
            int256 position = max(x, flip);
            bytes32 source = keccak256(
                abi.encodePacked(seed, r, uint32(uint256(position / 256)))
            );
            uint8 b = uint8(source[uint256((position % 256) / 8)]);
            bool bit = (b >> uint256(position % 8)) % 2 == 0x1;
            x = bit ? flip : x;
        }
        return uint256(x);
    }

    /// @notice Returns shuffled index of `pos` after a swap-or-not permutation
    /// @param x original index to shuffle
    /// @param modulus cardinality of list
    /// @param seed random seed; determines permutation
    /// @param rounds number of hashing rounds
    /// @return p shuffled (permuted) index
    function getPermutedIndex(
        uint256 x,
        uint256 modulus,
        uint256 seed,
        uint8 rounds
    ) external pure returns (uint256) {
        assembly {
            // assert(x < modulus && modulus != 0 && modulus_ <= INT256_MAX)
            let int256Max := sub(exp(2, 255), 1)
            if or(
                or(gt(x, sub(modulus, 1)), eq(modulus, 0)),
                gt(modulus, int256Max)
            ) {
                revert(0, 0)
            }

            // See `floormod` function in public interface
            function floormod(a, b) -> c {
                switch slt(a, 0)
                case 1 {
                    a := sub(0, a)
                    c := sub(b, smod(a, b))
                }
                default {
                    c := smod(a, b)
                }
            }

            // Reserve scratch memory for passing inputs into keccak256
            let packedHash := mload(0x40)
            // Max memory we'll need is:
            //  seed(0x20=32B) + round(0x01=1B) + truncatedPosition(0x04=4B)
            //  = 0x25=37B
            mstore(0x40, add(packedHash, 0x25))
            // Pre-load the seed into the first 32B, this is invariant through the loop
            mstore(packedHash, seed)

            // Loop for the desired number of rounds
            for {
                let r := 0
            } lt(r, rounds) {
                r := add(r, 1)
            } {
                // Load the round number uint8(r) into the scratch memory after the seed
                mstore8(add(packedHash, 0x20), r)
                // keccak256(uint256(seed), uint8(r)), then take only the 64 most significant bits
                let h64 := and(
                    shr(192, keccak256(packedHash, 0x21)),
                    0xffffffffffffffff
                )
                // pivot <- keccak256(seed, r)[0:8] % modulus
                let pivot := mod(h64, modulus)
                // flip <- (pivot - index) % modulus
                let flip := floormod(sub(pivot, x), modulus)
                // position <- max(x, flip)
                let position
                switch gt(x, flip)
                case 1 {
                    position := x
                }
                default {
                    position := flip
                }
                // Calculate (position / 256), then load the 32 least significant bits
                // into the scratch memory, after uint8(r):
                //  lsb32 <- ((position / 256) << (256 - 32))
                // This is big-endian, so we load 256 bits of lsb32 but ignore the last 224 bits
                mstore(add(packedHash, 0x21), shl(224, div(position, 256)))
                // source <- keccak256(uint256(seed), uint8(r), uint32(position))
                let source := keccak256(packedHash, 0x25)
                // b <- source[(position % 256) / 8]
                let b := byte(div(mod(position, 256), 8), source)
                // bit <- (b >> (position % 8)) % 2
                let bit := mod(shr(mod(position, 8), b), 2)
                if bit {
                    x := flip
                }
            }
        }
        return uint256(x);
    }
}
