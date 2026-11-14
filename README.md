# Vobi

Vobi is a free voice-to-text app for **macOS and Windows**. Hold a shortcut, speak, and your words are typed into whatever app you're using. A small blue blob, also called Vobi, keeps you company while it listens.

Speech recognition runs **on your computer**, so your voice never leaves it. Optional online AI cleanup is planned.

> Status: early development (v0.1.0).

## Develop

You need Rust (stable), Bun, CMake, and on macOS the Xcode command line tools.

```bash
bun install
CMAKE_POLICY_VERSION_MINIMUM=3.5 bun run tauri dev
```

## Credits

Vobi is built on [Handy](https://github.com/cjpais/Handy) by CJ Pais (MIT License). Speech recognition comes from transcribe.cpp / ggml / whisper.cpp. Handy's original license is kept in [LICENSE](LICENSE). Vobi's name, design and blob character are its own and are not affiliated with Handy.
