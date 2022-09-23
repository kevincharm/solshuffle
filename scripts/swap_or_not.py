import sys
from Crypto.Hash import keccak

def hash(x):
    k = keccak.new(digest_bits=256)
    k.update(x)
    return bytearray.fromhex(k.hexdigest())

def int_to_bytes1(x): return x.to_bytes(1, 'big')
def int_to_bytes4(x): return x.to_bytes(4, 'big')
def bytes_to_int(data: bytes) -> int:
    return int.from_bytes(data, 'big')

# Adapted from ethereum/consensus-specs:
#   https://github.com/ethereum/consensus-specs/blob/1c6ccac8fc1f02079f49bf9fd715b64764c304e0/specs/core/0_beacon-chain.md#get_permuted_index
# or more recently:
#   https://github.com/ethereum/consensus-specs/blob/master/specs/phase0/beacon-chain.md#compute_shuffled_index
# Consensus specs uses rounds=90
def get_permuted_index(index: int, list_size: int, seed: bytes, rounds: int) -> int:
    """
    Return `p(index)` in a pseudorandom permutation `p` of `0...list_size-1` with ``seed`` as entropy.

    Utilizes 'swap or not' shuffling found in
    https://link.springer.com/content/pdf/10.1007%2F978-3-642-32009-5_1.pdf
    See the 'generalized domain' algorithm on page 3.
    """
    for round in range(rounds):
        pivot = bytes_to_int(hash(seed + int_to_bytes1(round))[0:8]) % list_size
        flip = (pivot - index) % list_size
        position = max(index, flip)
        source = hash(seed + int_to_bytes1(round) + int_to_bytes4(position // 256))
        byte = source[(position % 256) // 8]
        bit = (byte >> (position % 8)) % 2
        index = flip if bit else index

    return index

if __name__ == "__main__":
    modulus = int(sys.argv[1])
    seed = int(sys.argv[2]).to_bytes(32, 'big')
    rounds = int(sys.argv[3])
    shuffled = []
    if len(sys.argv) < 5:
        for x in range(modulus):
            sx = get_permuted_index(x, modulus, seed, rounds)
            shuffled.append(sx)
        print(shuffled)
    else:
        print(get_permuted_index(int(sys.argv[4]), modulus, seed, rounds))
