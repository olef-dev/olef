# Sourced by bin/shadowdroid-mcp and hooks/check-cli: find a usable
# `shadowdroid` binary and the Android SDK's platform-tools.
#
# Desktop apps don't inherit the login shell's PATH, so besides PATH this also
# looks in the usual install locations. SHADOWDROID_BIN overrides the search.
# SHADOWDROID_PLUGIN_TEST_ISOLATE=1 (tests only) skips the fixed locations and
# the cache below, unless SHADOWDROID_PLUGIN_CACHE names a cache file.

# Every release from this version on has `shadowdroid mcp` (the first public
# one with it is 2.0.3), so the version check alone covers it.
SHADOWDROID_MIN_VERSION="2.0.4"

# 0 when $1 >= $2 (dotted numeric versions).
sd_version_at_least() {
  local IFS=.
  local -a have want
  read -r -a have <<<"${1%%[-+]*}"
  read -r -a want <<<"$2"
  for i in 0 1 2; do
    local h=${have[$i]:-0} w=${want[$i]:-0}
    ((10#$h > 10#$w)) && return 0
    ((10#$h < 10#$w)) && return 1
  done
  return 0
}

# Binaries that passed the check below, so later launches skip running
# `--version` (Codex starts the server about 20 times when it opens; on
# Windows each process start is slow). One line per binary:
# "<mtime> <size> <version> <path>"; a rebuild or upgrade changes the stamp.
sd_cache_file() {
  if [ -n "${SHADOWDROID_PLUGIN_CACHE:-}" ]; then
    printf '%s' "$SHADOWDROID_PLUGIN_CACHE"
  elif [ "${SHADOWDROID_PLUGIN_TEST_ISOLATE:-}" != 1 ]; then
    printf '%s' "${SHADOWDROID_HOME:-$HOME/.shadowdroid}/cache/plugin-cli-check"
  fi
}

# "<mtime> <size>" of the file $1 points at (GNU stat, then BSD stat).
sd_stamp() {
  stat -L -c '%Y %s' -- "$1" 2>/dev/null || stat -L -f '%m %z' -- "$1" 2>/dev/null
}

# Prints the cached version of $1 if the file hasn't changed since.
sd_cache_get() {
  local file stamp mt sz ver path
  file="$(sd_cache_file)"
  [ -n "$file" ] && [ -f "$file" ] || return 1
  stamp="$(sd_stamp "$1")" || return 1
  while read -r mt sz ver path; do
    if [ "$path" = "$1" ] && [ "$mt $sz" = "$stamp" ]; then
      printf '%s' "$ver"
      return 0
    fi
  done <"$file"
  return 1
}

# Remembers that $1 (version $2) passed. Best effort: never fails the caller.
sd_cache_put() {
  local file stamp tmp mt sz ver path
  file="$(sd_cache_file)"
  [ -n "$file" ] || return 0
  stamp="$(sd_stamp "$1")" || return 0
  mkdir -p "$(dirname "$file")" 2>/dev/null || return 0
  tmp="$file.$$"
  {
    if [ -f "$file" ]; then
      while read -r mt sz ver path; do
        [ "$path" = "$1" ] || printf '%s %s %s %s\n' "$mt" "$sz" "$ver" "$path"
      done <"$file" | tail -n 15
    fi
    printf '%s %s %s\n' "$stamp" "$2" "$1"
  } >"$tmp" 2>/dev/null && mv -f "$tmp" "$file" 2>/dev/null
  rm -f "$tmp" 2>/dev/null
  return 0
}

# Sets SD_BIN to a shadowdroid that is new enough (return 0),
# or SD_TOO_OLD to "path version" of the newest unusable one found (return 1).
sd_find() {
  SD_BIN=""
  SD_TOO_OLD=""
  local candidates=(
    "${SHADOWDROID_BIN:-}"
    "$(command -v shadowdroid 2>/dev/null || true)"
  )
  [ "${SHADOWDROID_PLUGIN_TEST_ISOLATE:-}" = 1 ] || candidates+=(
    /opt/homebrew/bin/shadowdroid
    /usr/local/bin/shadowdroid
    /home/linuxbrew/.linuxbrew/bin/shadowdroid
    "$HOME/.local/bin/shadowdroid"
    "$HOME/.cargo/bin/shadowdroid"
  )
  if [ -n "${LOCALAPPDATA:-}" ]; then
    candidates+=("$LOCALAPPDATA/Programs/shadowdroid/shadowdroid.exe" "$HOME/scoop/shims/shadowdroid.exe")
  fi
  local candidate version
  for candidate in "${candidates[@]}"; do
    [ -n "$candidate" ] && [ -x "$candidate" ] || continue
    if version="$(sd_cache_get "$candidate")" && sd_version_at_least "$version" "$SHADOWDROID_MIN_VERSION"; then
      SD_BIN="$candidate"
      return 0
    fi
    version="$("$candidate" --version 2>/dev/null | awk '{print $2}')"
    if [ -z "$version" ] || ! sd_version_at_least "$version" "$SHADOWDROID_MIN_VERSION"; then
      SD_TOO_OLD="$candidate ${version:-?}"
      continue
    fi
    SD_BIN="$candidate"
    sd_cache_put "$candidate" "$version"
    return 0
  done
  return 1
}

# Sets SD_PLATFORM_TOOLS to the first Android SDK platform-tools directory.
sd_find_platform_tools() {
  SD_PLATFORM_TOOLS=""
  local sdk
  local sdks=("${ANDROID_HOME:-}" "${ANDROID_SDK_ROOT:-}")
  [ "${SHADOWDROID_PLUGIN_TEST_ISOLATE:-}" = 1 ] ||
    sdks+=("$HOME/Library/Android/sdk" "$HOME/Android/Sdk" "${LOCALAPPDATA:-/nonexistent}/Android/Sdk")
  for sdk in "${sdks[@]}"; do
    if [ -n "$sdk" ] && [ -d "$sdk/platform-tools" ]; then
      SD_PLATFORM_TOOLS="$sdk/platform-tools"
      return 0
    fi
  done
  return 1
}

# macos, linux or windows (Git Bash, MSYS2 or Cygwin).
sd_os() {
  case "$(uname -s 2>/dev/null)" in
    Darwin) echo macos ;;
    MINGW* | MSYS* | CYGWIN*) echo windows ;;
    *) [ "${OS:-}" = "Windows_NT" ] && echo windows || echo linux ;;
  esac
}
