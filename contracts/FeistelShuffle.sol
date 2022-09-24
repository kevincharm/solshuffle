// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8;

/// @title FeistelShuffle
/// @author kevincharm
/// @notice Implementation of a Feistel shuffle, adapted from vbuterin's python implementation [1].
///     [1]: https://github.com/ethereum/research/blob/master/shuffling/feistel_shuffle.py
library FeistelShuffle {
    /// @notice Integer sqrt (rounding down), adapted from uniswap/v2-core
    /// @param s integer to sqrt
    /// @return z sqrt(s), rounding to zero
    function sqrt(uint256 s) private pure returns (uint256 z) {
        assembly {
            switch gt(s, 3)
            // if (s > 3)
            case 1 {
                z := s
                let r := add(div(s, 2), 1)
                for {

                } lt(r, z) {

                } {
                    z := r
                    r := div(add(div(s, r), r), 2)
                }
            }
            default {
                switch not(iszero(s))
                // else if (s != 0)
                case 1 {
                    z := 1
                }
            }
        }
    }

    /// @notice Feistel round function
    /// @param x index of element in the list
    /// @param i hash iteration index
    /// @param seed random seed
    /// @param modulus cardinality of list
    /// @return hashed hash of x (mod `modulus`)
    function numHash(
        uint256 x,
        uint256 i,
        uint256 seed,
        uint256 modulus
    ) private pure returns (uint256 hashed) {
        return
            (uint256(keccak256(abi.encodePacked(x, seed))) / (modulus**i)) %
            modulus;
    }

    /// @notice Feistel round function for multiple rounds
    /// @param x index of element in the list
    /// @param seed random seed
    /// @param modulus cardinality of list
    /// @param rounds number of hashing rounds
    function numHashRounds(
        uint256 x,
        uint256 seed,
        uint256 modulus,
        uint256 rounds
    ) private pure returns (uint256[] memory) {
        uint256 h = uint256(keccak256(abi.encodePacked(x, seed)));
        uint256[] memory hashes = new uint256[](rounds);
        for (uint256 i = 0; i < rounds; ++i) {
            hashes[i] = (h / (modulus**i)) % modulus;
        }
        return hashes;
    }

    /// @notice Next perfect square
    /// @param n Number to get next perfect square of
    function nextPerfectSquare(uint256 n) private pure returns (uint256) {
        uint256 sqrtN = sqrt(n);
        if (sqrtN**2 == n) {
            return n;
        }
        return (sqrtN + 1)**2;
    }

    /// @notice Compute a Feistel shuffle mapping for index `x`
    /// @dev This is the unoptimised/reference form intended for testing specs.
    ///     Use #getPermutedIndex in your contract instead.
    /// @param x index of element in the list
    /// @param modulus cardinality of list
    /// @param seed random seed
    /// @param rounds number of hashing rounds
    /// @return resulting shuffled index
    function getPermutedIndex_REF(
        uint256 x,
        uint256 modulus,
        uint256 seed,
        uint256 rounds
    ) external pure returns (uint256) {
        require(modulus != 0, "modulus must be > 0");
        require(x < modulus, "x too large");
        uint256 h = sqrt(nextPerfectSquare(modulus));
        do {
            uint256 L = x / h;
            uint256 R = x % h;
            for (uint256 j = 0; j < rounds; ++j) {
                uint256 newR = (L + numHash(R, j, seed, modulus)) % h;
                L = R;
                R = newR;
            }
            x = L * h + R;
        } while (x >= modulus);
        return x;
    }

    /// @notice Compute a Feistel shuffle mapping for index `x`
    /// @param x index of element in the list
    /// @param modulus cardinality of list
    /// @param seed random seed
    /// @param rounds number of hashing rounds
    /// @return resulting shuffled index
    function getPermutedIndex(
        uint256 x,
        uint256 modulus,
        uint256 seed,
        uint256 rounds
    ) external pure returns (uint256) {
        modulus**(rounds - 1); // checked exp
        assembly {
            // Assert some preconditions
            // (x < modulus): index to be permuted must lie within the domain of [0, modulus)
            let xGteModulus := gt(x, sub(modulus, 1))
            // (modulus != 0): domain must be non-zero (value of 1 also doesn't really make sense)
            let modulusZero := iszero(modulus)
            if or(xGteModulus, modulusZero) {
                revert(0, 0)
            }

            // Calculate sqrt(s) using Babylonian method
            function sqrt(s) -> z {
                switch gt(s, 3)
                // if (s > 3)
                case 1 {
                    z := s
                    let r := add(div(s, 2), 1)
                    for {

                    } lt(r, z) {

                    } {
                        z := r
                        r := div(add(div(s, r), r), 2)
                    }
                }
                default {
                    switch not(iszero(s))
                    // else if (s != 0)
                    case 1 {
                        z := 1
                    }
                }
            }

            // Allocate scratch memory for inputs to keccak256
            let packed := mload(0x40)
            mstore(0x40, add(packed, 0x40)) // 64B
            // nps <- nextPerfectSquare(modulus)
            let sqrtN := sqrt(modulus)
            let nps
            switch eq(exp(sqrtN, 2), modulus)
            case 1 {
                nps := modulus
            }
            default {
                let sqrtN1 := add(sqrtN, 1)
                // pre-check for square overflow
                if gt(sqrtN1, sub(exp(2, 128), 1)) {
                    // overflow
                    revert(0, 0)
                }
                nps := exp(sqrtN1, 2)
            }
            // h <- sqrt(nps)
            let h := sqrt(nps)
            // Loop until x < modulus
            for {

            } 1 {

            } {
                let L := div(x, h)
                let R := mod(x, h)
                // Loop for desired number of rounds
                for {
                    let r := 0
                } lt(r, rounds) {
                    r := add(r, 1)
                } {
                    // Load R and seed for next keccak256 round
                    mstore(packed, R)
                    mstore(add(packed, 0x20), seed)
                    // roundHash <- (keccak256(R,seed) / (modulus**r)) % modulus
                    let roundHash := mod(
                        div(keccak256(packed, 0x40), exp(modulus, r)),
                        modulus
                    )
                    let newR := mod(add(L, roundHash), h)
                    L := R
                    R := newR
                }
                x := add(mul(L, h), R)
                if lt(x, modulus) {
                    break
                }
            }
        }
        return x;
    }
}
