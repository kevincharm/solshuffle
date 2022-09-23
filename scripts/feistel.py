import sys
from Crypto.Hash import keccak

def hash(x):
    k = keccak.new(digest_bits=256)
    k.update(x)
    return bytearray.fromhex(k.hexdigest())

def numhash(x, i, seed, modulus):
    h = hash(x.to_bytes(32, 'big') + seed)
    return (int.from_bytes(h, 'big') // modulus**i) % modulus

def next_perfect_square(n):
    if int(n ** 0.5) ** 2 == n:
        return n
    return (int(n ** 0.5) + 1) ** 2

# Adapted from ethereum/research:
#   https://github.com/ethereum/research/blob/master/shuffling/feistel_shuffle.py
def get_permuted_index(x: int, modulus: int, seed: bytes, rounds: int):
    h = int(next_perfect_square(modulus) ** 0.5)
    while 1:
        L, R = x//h, x%h
        for i in range(rounds):
            new_R = (L + numhash(R, i, seed, modulus)) % h
            L = R
            R = new_R
        x = L * h + R
        if x < modulus:
            return x

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
