// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8;

/// @title FeistelShuffleOptimised
/// @author kevincharm
/// @notice Feistel shuffle implemented in Yul.
library FeistelShuffleOptimised {
    function shuffle(
        uint256 x,
        uint256 domain,
        uint256 seed,
        uint256 rounds
    ) internal pure returns (uint256) {
        assembly {
            // Assert some preconditions
            // (x < domain): index to be permuted must lie within the domain of [0, domain)
            let xGtedomain := gt(x, sub(domain, 1))
            // (domain != 0): domain must be non-zero (value of 1 also doesn't really make sense)
            let domainZero := iszero(domain)
            // (rounds is even): we only handle even rounds to make the code simpler
            let oddRounds := iszero(iszero(and(rounds, 1)))
            if or(or(xGtedomain, domainZero), oddRounds) {
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
                    if and(not(iszero(s)), 1) {
                        // else if (s != 0)
                        z := 1
                    }
                }
            }

            // nps <- nextPerfectSquare(domain)
            let sqrtN := sqrt(domain)
            let nps
            switch eq(exp(sqrtN, 2), domain)
            case 1 {
                nps := domain
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
            // Allocate scratch memory for inputs to keccak256
            let packed := mload(0x40)
            mstore(0x40, add(packed, 0x80)) // 128B
            // Loop until x < domain
            for {

            } 1 {

            } {
                let L := mod(x, h)
                let R := div(x, h)
                // Loop for desired number of rounds
                for {
                    let i := 0
                } lt(i, rounds) {
                    i := add(i, 1)
                } {
                    // Load R and seed for next keccak256 round
                    mstore(packed, R)
                    mstore(add(packed, 0x20), i)
                    mstore(add(packed, 0x40), seed)
                    mstore(add(packed, 0x60), domain)
                    // roundHash <- keccak256([R, i, seed, domain])
                    let roundHash := keccak256(packed, 0x80)
                    // nextR <- (L + roundHash) % h
                    let nextR := mod(add(L, roundHash), h)
                    L := R
                    R := nextR
                }
                // x <- h * R + L
                x := add(mul(h, R), L)
                if lt(x, domain) {
                    break
                }
            }
        }
        return x;
    }

    function deshuffle(
        uint256 xPrime,
        uint256 domain,
        uint256 seed,
        uint256 rounds
    ) internal pure returns (uint256) {
        assembly {
            // Assert some preconditions
            // (xPrime < domain): index to be permuted must lie within the domain of [0, domain)
            let xGtedomain := gt(xPrime, sub(domain, 1))
            // (domain != 0): domain must be non-zero (value of 1 also doesn't really make sense)
            let domainZero := iszero(domain)
            // (rounds is even): we only handle even rounds to make the code simpler
            let oddRounds := iszero(iszero(and(rounds, 1)))
            if or(or(xGtedomain, domainZero), oddRounds) {
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
                    if and(not(iszero(s)), 1) {
                        // else if (s != 0)
                        z := 1
                    }
                }
            }

            // nps <- nextPerfectSquare(domain)
            let sqrtN := sqrt(domain)
            let nps
            switch eq(exp(sqrtN, 2), domain)
            case 1 {
                nps := domain
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
            // Allocate scratch memory for inputs to keccak256
            let packed := mload(0x40)
            mstore(0x40, add(packed, 0x80)) // 128B
            // Loop until x < domain
            for {

            } 1 {

            } {
                let L := mod(xPrime, h)
                let R := div(xPrime, h)
                // Loop for desired number of rounds
                for {
                    let i := 0
                } lt(i, rounds) {
                    i := add(i, 1)
                } {
                    // Load L and seed for next keccak256 round
                    mstore(packed, L)
                    mstore(add(packed, 0x20), sub(sub(rounds, i), 1))
                    mstore(add(packed, 0x40), seed)
                    mstore(add(packed, 0x60), domain)
                    // roundHash <- keccak256([R, i, seed, domain])
                    // NB: extra arithmetic to avoid underflow
                    let roundHash := mod(keccak256(packed, 0x80), h)
                    // nextL <- (R - roundHash) % h
                    // NB: extra arithmetic to avoid underflow
                    let nextL := mod(sub(add(R, h), roundHash), h)
                    R := L
                    L := nextL
                }
                // x <- h * R + L
                xPrime := add(mul(h, R), L)
                if lt(xPrime, domain) {
                    break
                }
            }
        }
        return xPrime;
    }
}