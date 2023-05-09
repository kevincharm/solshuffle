// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {FeistelShuffle} from "../FeistelShuffle.sol";

contract ERC721Shuffled is ERC721, ERC721Enumerable, Ownable {
    using Strings for uint256;

    /// @notice The first token ID. For most NFT collections, this is 1.
    uint256 public constant FIRST_TOKEN_ID = 1;
    /// @notice The max supply is used as the modulus parameter in the shuffle algos.
    uint256 public immutable maxSupply;
    /// @notice Random seed that determines the permutation of the shuffle,
    ///     should only be set once.
    bytes32 public randomSeed;

    constructor(
        string memory name,
        string memory symbol,
        uint256 maxSupply_
    ) ERC721(name, symbol) {
        maxSupply = maxSupply_;
    }

    /// @dev Replace this with a call from VRF or some other way to get a secure
    ///     random seed.
    /// @param randomSeed_ random seed
    function setRandomSeed(bytes32 randomSeed_) external onlyOwner {
        require(randomSeed == 0, "already set");
        randomSeed = randomSeed_;
    }

    /// @notice Example mint function, minting 1-indexed tokenIds (first tokenId = 1)
    function mint() external {
        _safeMint(msg.sender, totalSupply() + 1);
    }

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
            FeistelShuffle.shuffle(
                tokenId -
                    FIRST_TOKEN_ID /** shuffle is 0-indexed, so we add offsets */,
                maxSupply /** Must stay constant */,
                uint256(randomSeed) /** Must stay constant (once set) */,
                4 /** Must stay constant */
            );

        // use the shuffled tokenId as the metadata index
        return string(abi.encodePacked(_baseURI(), shuffledTokenId.toString()));
    }

    /// @dev Base URI to concatenate with tokenId
    function _baseURI() internal view virtual override returns (string memory) {
        return "ipfs://ipfs/QmbWqxBEKC3P8tqsKc98xmWNzrzDtRLMiMPL8wBuTGsMnR/";
    }

    /// @dev Required override
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(ERC721, ERC721Enumerable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    /// @dev Required override
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, tokenId);
    }
}
