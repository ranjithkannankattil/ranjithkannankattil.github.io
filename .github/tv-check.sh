#!/bin/bash
# Drives Radio Velvet Dev on an Android TV emulator with the remote's keys and saves screenshots + a video.
set -x
OUT=/tmp/tv; mkdir -p $OUT
PKG=com.ranjithkb.radio.dev
APK=$(ls app/build/outputs/apk/play/debug/*.apk | head -1)
adb install -r "$APK"
adb shell cmd package query-activities -c android.intent.category.LEANBACK_LAUNCHER > $OUT/tv-launcher.txt
shot() { adb exec-out screencap -p > $OUT/$1.png; }
key() { adb shell input keyevent "$1"; sleep "${2:-2}"; }
adb shell screenrecord --bit-rate 4000000 --time-limit 170 /sdcard/tv.mp4 &
REC=$!
sleep 2
# open it the way the TV's home screen does
adb shell monkey -p $PKG -c android.intent.category.LEANBACK_LAUNCHER 1
sleep 15; shot 01-home
key DPAD_RIGHT; key DPAD_RIGHT; shot 02-right
key DPAD_DOWN 3; shot 03-down
key DPAD_DOWN 3; shot 04-down-again
key DPAD_UP; key DPAD_UP; key DPAD_LEFT; key DPAD_LEFT; shot 05-back-to-first
key DPAD_CENTER 20; shot 06-player
adb shell dumpsys media_session > $OUT/media-session.txt
key DPAD_RIGHT; key DPAD_CENTER 15; shot 07-next-station
key DPAD_LEFT; key DPAD_CENTER 5; shot 08-paused
key DPAD_CENTER 10; shot 09-playing-again
key BACK 3; shot 10-back-to-rows
key HOME 6; shot 11-tv-home-screen
kill $REC; sleep 5
adb pull /sdcard/tv.mp4 $OUT/tv.mp4
adb logcat -d -s VELVET-PLAY:I AndroidRuntime:E ExoPlayerImpl:E > $OUT/log.txt || true
exit 0
