import plot_shuffle_dist
import feistel

plot_shuffle_dist.plot(feistel.get_permuted_index, modulus=10_000, pick_first_n=1000, rounds=4, n_runs=100)
