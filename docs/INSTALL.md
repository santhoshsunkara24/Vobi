# Installing Vobi

Vobi turns your voice into text in any app. Hold the shortcut, talk, let go.

## Which file do I download?

| Your computer | File |
|---|---|
| Mac with Apple chip (M1, M2, M3, M4…) | `Vobi_x.y.z_aarch64.dmg` |
| Mac with Intel chip | `Vobi_x.y.z_x64.dmg` |
| Windows 10 or 11 | `Vobi_x.y.z_x64-setup.exe` |

Not sure which Mac you have? Apple menu → About This Mac → look at "Chip".

## Mac

1. Open the `.dmg` and drag **Vobi** into **Applications**.
2. Open Vobi from Applications. macOS will say it can't verify the developer
   (Vobi isn't signed with a paid Apple certificate yet). Click **Done**.
3. Go to **System Settings → Privacy & Security**, scroll down and click
   **Open Anyway** next to Vobi, then **Open**. You only do this once.
4. Vobi walks you through two permissions:
   - **Microphone**, so it can hear you.
   - **Accessibility**, so it can type where your cursor is.
5. Pick a speech model when asked (it downloads once).

Default shortcuts: **Option + Space** to talk · **Option + Shift + F** to fix spelling of
selected text · **Option + Shift + R** to refine selected text with AI.

**After an update**, if a shortcut stops working: System Settings → Privacy &
Security → Accessibility → turn Vobi off and on again.

## Windows

1. Run `Vobi_x.y.z_x64-setup.exe`.
2. Windows may show **"Windows protected your PC"** (Vobi isn't signed with a
   paid certificate yet). Click **More info → Run anyway**. Only once.
3. Allow the microphone if asked. If Vobi can't hear you later: Settings →
   Privacy & security → Microphone → turn on "Let desktop apps access your
   microphone".
4. Pick a speech model when asked (it downloads once). On laptops without a
   graphics card, choose a smaller model.

Default shortcuts: **Ctrl + Space** to talk · **Alt + Shift + F** to fix
spelling · **Alt + Shift + R** to refine with AI.

Vobi lives in the **system tray** (bottom right, by the clock). If you don't
see it, click the **^** arrow and drag Vobi out so it stays visible.

## Refine (AI rewriting)

- **Newer Macs:** works for free with Apple Intelligence (System Settings →
  Apple Intelligence & Siri → turn it on).
- **Windows and older Macs:** add a free Groq key in Vobi → Settings →
  Post-processing → Groq. Get one at console.groq.com → API Keys.

Everything else (dictation, spelling fixes) works offline, with no key.
