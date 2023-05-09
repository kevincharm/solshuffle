// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8;

import {FeistelShuffle} from "../FeistelShuffle.sol";
import {FeistelShuffleOptimised} from "../FeistelShuffleOptimised.sol";

contract FeistelShuffleConsumer {
    function shuffle(
        uint256 x,
        uint256 domain,
        uint256 seed,
        uint256 rounds
    ) public pure returns (uint256) {
        return FeistelShuffle.shuffle(x, domain, seed, rounds);
    }

    function deshuffle(
        uint256 xPrime,
        uint256 domain,
        uint256 seed,
        uint256 rounds
    ) public pure returns (uint256) {
        return FeistelShuffle.deshuffle(xPrime, domain, seed, rounds);
    }

    function shuffle__OPT(
        uint256 x,
        uint256 domain,
        uint256 seed,
        uint256 rounds
    ) public pure returns (uint256) {
        return FeistelShuffleOptimised.shuffle(x, domain, seed, rounds);
    }

    function deshuffle__OPT(
        uint256 xPrime,
        uint256 domain,
        uint256 seed,
        uint256 rounds
    ) public pure returns (uint256) {
        return FeistelShuffleOptimised.deshuffle(xPrime, domain, seed, rounds);
    }
}
