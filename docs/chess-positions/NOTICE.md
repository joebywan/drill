# Chess positions

The positions in `src/data/mate.json` come from the [Lichess puzzle database](https://database.lichess.org/#puzzles)
(`lichess_db_puzzle.csv.zst`), released under [CC0](https://creativecommons.org/publicdomain/zero/1.0/) (public domain
dedication), by way of Daybook's `ChessPositions.kt` (dump served on 2026-10-02, SHA-256
76335bfa7d7c4a7f93c1366d81549e53951ebb79dd43d34904cab8f22d962f8d).

Only the starting positions are used. Daybook's `tools/chess/build.py` proved each one (shortest forced mate exactly N, one
key move), and `test/mate.test.js` replays a sample here. Nothing else from the database is shipped.
