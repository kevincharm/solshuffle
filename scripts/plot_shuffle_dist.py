from typing import Callable
from matplotlib import pyplot, cm
import numpy as np
from Crypto.Random import get_random_bytes, random

# Plot shuffle distribution
def plot(get_permuted_index: Callable[[int, int, bytes, int], int], modulus: int, pick_first_n: int, rounds: int, n_runs: int):
    colours = cm.rainbow(np.linspace(0, 1, n_runs))
    random.shuffle(colours)
    X = range(modulus)

    pyplot.rcParams.update({ 'figure.figsize': (16, 10), 'figure.dpi': 100 })
    for i in range(n_runs):
        Y = []
        for x in X:
            seed = get_random_bytes(32)
            px = get_permuted_index(x, modulus, seed, rounds)
            Y.append(px if px < pick_first_n else np.nan)
        randcolour = "#%s" % (get_random_bytes(3).hex())
        pyplot.scatter(X, Y, s=1, color=randcolour, label=seed.hex())

    pyplot.title("Swap-or-not (%d runs, pick first %d out of %d)" % (n_runs, pick_first_n, modulus))
    pyplot.xlabel("x")
    pyplot.ylabel("y = SwapOrNot(x, mod=%d, rounds=%d)" % (modulus, rounds))
    pyplot.legend(fontsize="xx-small", loc="center left", bbox_to_anchor=(1, 0.5))
    pyplot.show()
