// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8;

/// @title FeistelShuffle
/// @author kevincharm
/// @notice Lazy shuffling using generalised Feistel ciphers.
library FeistelShuffle {
    /// @notice Integer sqrt (rounding down), adapted from uniswap/v2-core
    /// @param s integer to sqrt
    /// @return z sqrt(s), rounding to zero
    function sqrt(uint256 s) private pure returns (uint256 z) {
        if (s > 3) {
            z = s;
            uint256 x = s / 2 + 1;
            while (x < z) {
                z = x;
                x = (s / x + x) / 2;
            }
        } else if (s != 0) {
            z = 1;
        }
    }

    /// @notice Feistel round function
    /// @param x index of element in the list
    /// @param i hash iteration index
    /// @param seed random seed
    /// @param modulus cardinality of list
    /// @return hashed hash of x (mod `modulus`)
    function f(
        uint256 x,
        uint256 i,
        uint256 seed,
        uint256 modulus
    ) private pure returns (uint256 hashed) {
        return uint256(keccak256(abi.encodePacked(x, i, seed, modulus)));
    }

    /// @notice Next perfect square
    /// @param n Number to get next perfect square of, unless it's already a
    ///     perfect square.
    function nextPerfectSquare(uint256 n) private pure returns (uint256) {
        uint256 sqrtN = sqrt(n);
        if (sqrtN ** 2 == n) {
            return n;
        }
        return (sqrtN + 1) ** 2;
    }

    /// @notice Compute a Feistel shuffle mapping for index `x`
    /// @param x index of element in the list
    /// @param domain Number of elements in the list
    /// @param seed Random seed; determines the permutation
    /// @param rounds Number of Feistel rounds to perform
    /// @return resulting shuffled index
    function shuffle(
        uint256 x,
        uint256 domain,
        uint256 seed,
        uint256 rounds
    ) internal pure returns (uint256) {
        require(domain != 0, "modulus must be > 0");
        require(x < domain, "x too large");
        require((rounds & 1) == 0, "rounds must be even");

        uint256 h = sqrt(nextPerfectSquare(domain));
        do {
            uint256 L = x % h;
            uint256 R = x / h;
            for (uint256 i = 0; i < rounds; ++i) {
                uint256 nextR = (L + f(R, i, seed, domain)) % h;
                L = R;
                R = nextR;
            }
            x = h * R + L;
        } while (x >= domain);
        return x;
    }

    /// @notice Compute the inverse Feistel shuffle mapping for the shuffled
    ///     index `xPrime`
    /// @param xPrime shuffled index of element in the list
    /// @param domain Number of elements in the list
    /// @param seed Random seed; determines the permutation
    /// @param rounds Number of Feistel rounds that was performed in the
    ///     original shuffle.
    /// @return resulting shuffled index
    function deshuffle(
        uint256 xPrime,
        uint256 domain,
        uint256 seed,
        uint256 rounds
    ) internal pure returns (uint256) {
        require(domain != 0, "modulus must be > 0");
        require(xPrime < domain, "x too large");
        require((rounds & 1) == 0, "rounds must be even");

        uint256 h = sqrt(nextPerfectSquare(domain));
        do {
            uint256 L = xPrime % h;
            uint256 R = xPrime / h;
            for (uint256 i = 0; i < rounds; ++i) {
                uint256 nextL = (R +
                    h -
                    (f(L, rounds - i - 1, seed, domain) % h)) % h;
                R = L;
                L = nextL;
            }
            xPrime = h * R + L;
        } while (xPrime >= domain);
        return xPrime;
    }
}
