# 36: A hoot when the popup opens

**What to build:** Play a short owl sound when the check-in popup opens. The user can turn it off.

**Blocked by:** none

**Status:** done

- [x] `playHoot` (`src/hootSound.ts`) makes "hoo, hoo, hooo" with the Web Audio API. It needs no sound file and has no licence to track. A missing audio device or a blocked webview gives no error.
- [x] The popup plays it each time it opens, when the setting is on.
- [x] Settings, "Appearance and startup", has the checkbox "Play a hoot when Hoot asks". It is on by default. Turning it on plays the hoot once.
- [x] The setting is stored as `play_sound` with the command `set_play_sound`. A Rust test covers the default and a change.
- [x] The README mentions the sound.

**Not checked:** the sound in the Tauri window on macOS. WebKit may block audio that does not follow a click. If it stays silent, play the sound from Rust.
