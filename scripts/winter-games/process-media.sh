#!/usr/bin/env bash
# Produces web-ready Winter Games media in temp/wg-media/ from the sources in temp/.
# Reads every timecode and target from media-spec.json. Idempotent: overwrites outputs.
set -euo pipefail
export PATH="/opt/homebrew/bin:$PATH"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
SPEC="$HERE/media-spec.json"
OUT="$ROOT/temp/wg-media"
mkdir -p "$OUT"

for tool in ffmpeg ffprobe jq; do
  command -v "$tool" >/dev/null || { echo "missing tool: $tool" >&2; exit 1; }
done

QV=3 # JPEG quality, roughly 82
FF=(ffmpeg -y -hide_banner -loglevel error -nostdin)
FAILED=0
fail() { echo "FAIL: $*" >&2; FAILED=1; }
field() { jq -r --arg n "$1" --arg f "$2" '.outputs[] | select(.name==$n) | .[$f] // empty' "$SPEC"; }

while IFS= read -r name; do
  kind=$(field "$name" kind)
  src="$ROOT/$(jq -r --arg k "$(field "$name" source)" '.sources[$k]' "$SPEC")"
  out="$OUT/$name"
  [ -f "$src" ] || { echo "missing source: $src" >&2; exit 1; }
  echo "==> $name"
  case "$kind" in
    video)
      "${FF[@]}" -i "$src" -ss "$(field "$name" start)" -t "$(field "$name" duration)" \
        -vf "scale=$(field "$name" width):$(field "$name" height)" \
        -c:v libx264 -profile:v high -preset slow -b:v "$(field "$name" bitrate)" \
        -maxrate "$(field "$name" maxrate)" -bufsize "$(field "$name" bufsize)" \
        -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart -map_metadata -1 "$out"
      ;;
    loop)
      "${FF[@]}" -i "$src" -ss "$(field "$name" start)" -t "$(field "$name" duration)" \
        -vf "scale=$(field "$name" width):$(field "$name" height)" \
        -c:v libx264 -profile:v high -preset slow -crf 26 -maxrate "$(field "$name" bitrate)" \
        -bufsize 2400k -pix_fmt yuv420p -an -movflags +faststart -map_metadata -1 "$out"
      ;;
    still)
      "${FF[@]}" -ss "$(field "$name" at)" -i "$src" -frames:v 1 \
        -vf "scale=$(field "$name" width):-2" -q:v "$QV" -map_metadata -1 "$out"
      ;;
    image)
      "${FF[@]}" -i "$src" -vf "scale=$(field "$name" width):-2" -q:v "$QV" -map_metadata -1 "$out"
      ;;
    *) echo "unknown kind: $kind" >&2; exit 1 ;;
  esac
done < <(jq -r '.outputs[].name' "$SPEC")

echo
echo "==== ffprobe summary ===="
while IFS= read -r name; do
  out="$OUT/$name"
  kind=$(field "$name" kind)
  size=$(stat -f%z "$out")
  vinfo=$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height -of csv=p=0 "$out")
  fmt=$(ffprobe -v error -show_entries format=duration,bit_rate -of csv=p=0 "$out")
  nstreams_a=$(ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$out" | wc -l | tr -d ' ')
  width=${vinfo#*,}; width=${width%%,*}
  printf '%-24s %s dur,bitrate=%s size=%s audio_streams=%s\n' "$name" "$vinfo" "$fmt" "$size" "$nstreams_a"

  want_w=$(field "$name" width)
  [ "$width" = "$want_w" ] || fail "$name width $width != $want_w"
  max=$(field "$name" maxBytes); min=$(field "$name" minBytes)
  [ -z "$max" ] || [ "$size" -le "$max" ] || fail "$name size $size > $max"
  [ -z "$min" ] || [ "$size" -ge "$min" ] || fail "$name size $size < $min"
  if [ "$kind" = video ] || [ "$kind" = loop ]; then
    dur=${fmt%%,*}
    want=$(field "$name" duration); tol=$(field "$name" durationTolerance)
    awk -v d="$dur" -v w="$want" -v t="$tol" 'BEGIN{x=d-w; if(x<0)x=-x; exit !(x<=t)}' \
      || fail "$name duration $dur not within $tol of $want"
  fi
  if [ "$(field "$name" audio)" = none ] && [ "$nstreams_a" != 0 ]; then fail "$name has audio"; fi
  if [ "$kind" = video ] && [ "$nstreams_a" = 0 ]; then fail "$name lacks audio"; fi
done < <(jq -r '.outputs[].name' "$SPEC")

[ "$FAILED" = 0 ] && echo "ALL CHECKS PASSED" || { echo "CHECKS FAILED" >&2; exit 1; }
