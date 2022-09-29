import plot_shuffle_dist
import swap_or_not

plot_shuffle_dist.plot(swap_or_not.get_permuted_index, modulus=10_000, pick_first_n=1000, rounds=90, n_runs=100)
