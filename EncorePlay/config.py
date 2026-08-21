"""App-wide configuration flags. Simple constants for now — may move to a proper
config file (JSON/TOML) or environment variables later.
"""

# When False, uploading new Fountain files is disabled — the "Open existing file"
# picker (Plays/fountain/) still works either way.
FILE_UPLOAD_ALLOWED: bool = True

# Maximum accepted size (in bytes) for an uploaded Fountain file. Plain-text play
# scripts are rarely more than a few hundred KB even for a full-length play; this is
# a generous ceiling to guard against accidental huge/garbage uploads, not a realistic
# expected size.
MAX_UPLOAD_SIZE_BYTES: int = 2 * 1024 * 1024  # 2 MB

