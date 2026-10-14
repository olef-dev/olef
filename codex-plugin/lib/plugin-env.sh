# Sourced by bin/shadowdroid-mcp and hooks/check-cli: settings and helpers
# that run no program from a computed path, so plugin directories can follow
# the hook that sources this. Binary search lives in find-shadowdroid.sh.
# SHADOWDROID_PLUGIN_TEST_ISOLATE=1 (tests only) skips the fixed locations.

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
