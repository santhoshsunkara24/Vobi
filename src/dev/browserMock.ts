/**
 * Dev only: fakes the Tauri backend so the main window renders in a plain
 * browser (`bun run dev`, then open http://localhost:1420). main.tsx loads
 * this only when `import.meta.env.DEV` and there's no `__TAURI_INTERNALS__`,
 * so production builds never include it.
 *
 * Query params: `?os=windows|macos|linux`, `?onboarding=1` (first run),
 * `?empty=1` (no history or words), `?debug=1` (debug tab).
 */
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import type { AppSettings, HistoryEntry, ModelInfo } from "@/bindings";
import { CURATED_ASR } from "@/lib/models/catalog";

const params = new URLSearchParams(location.search);
const os = params.get("os") ?? "macos";
const empty = params.get("empty") === "1";

// What @tauri-apps/plugin-os reads synchronously.
(window as unknown as Record<string, unknown>).__TAURI_OS_PLUGIN_INTERNALS__ = {
  platform: os,
  os_type: os,
  family: os === "windows" ? "windows" : "unix",
  version: "15.0",
  arch: "aarch64",
  eol: "\n",
  exe_extension: os === "windows" ? "exe" : "",
};

const models: ModelInfo[] = CURATED_ASR.map((m, i) => ({
  id: m.id,
  name: m.name ?? m.id,
  description: "",
  filename: "model.gguf",
  source: {
    HuggingFace: {
      repo_id: m.repository,
      filename: "model.gguf",
      sha256: null,
    },
  } as unknown as ModelInfo["source"],
  size_mb: 640,
  is_downloaded: i === 0,
  is_downloading: false,
  partial_size: 0,
  accuracy_score: 0.8,
  speed_score: 0.8,
  supports_translation: false,
  is_recommended: i === 0,
  supported_languages: ["en"],
  supports_language_selection: false,
  is_custom: false,
  supports_streaming: false,
  supports_language_detection: false,
}));

const hotkey = os === "windows" ? "ctrl_right" : "fn";
const settings = {
  onboarding_completed: params.get("onboarding") !== "1",
  bindings: {
    transcribe: {
      id: "transcribe",
      name: "Transcribe",
      description: "",
      default_binding: hotkey,
      current_binding: hotkey,
    },
    cancel: {
      id: "cancel",
      name: "Cancel",
      description: "",
      default_binding: "escape",
      current_binding: "escape",
    },
    fix_selection: {
      id: "fix_selection",
      name: "Fix Selection",
      description: "",
      default_binding: os === "macos" ? "option+shift+f" : "alt+shift+f",
      current_binding: os === "macos" ? "option+shift+f" : "alt+shift+f",
    },
    refine_selection: {
      id: "refine_selection",
      name: "Refine Selection",
      description: "",
      default_binding: os === "macos" ? "option+shift+r" : "alt+shift+r",
      current_binding: os === "macos" ? "option+shift+r" : "alt+shift+r",
    },
  },
  push_to_talk: true,
  shortcut_activation: "hold_or_toggle",
  audio_feedback: true,
  audio_feedback_volume: 0.6,
  sound_theme: "marimba",
  start_hidden: false,
  autostart_enabled: true,
  update_checks_enabled: false,
  selected_model: models[0]?.id ?? "",
  always_on_microphone: false,
  selected_microphone: null,
  translate_to_english: false,
  selected_language: "auto",
  spoken_languages: ["en", "hi"],
  overlay_style: "minimal",
  debug_mode: params.get("debug") === "1",
  log_level: "info",
  custom_words: empty ? [] : ["Kubernetes", "Vobi", "Priya", "Tauri", "Figma"],
  model_unload_timeout: "never",
  word_correction_threshold: 0.18,
  history_limit: 100,
  recording_retention_period: "preserve_limit",
  paste_method: "ctrl_v",
  clipboard_handling: "dont_modify",
  auto_submit: false,
  auto_submit_key: "enter",
  post_process_enabled: false,
  post_process_provider_id: "openai",
  post_process_providers: [],
  post_process_api_keys: {},
  post_process_models: {},
  post_process_prompts: [],
  mute_while_recording: false,
  append_trailing_space: false,
  app_language: "en",
  theme: "light",
  experimental_enabled: false,
  show_tray_icon: true,
  filler_word_removal_enabled: true,
  chinese_script: "as_transcribed",
  vad_enabled: true,
  long_form_chunking: true,
  vobi_on_screen: false,
  vobi_on_screen_position: null,
  snippets: empty
    ? []
    : [
        { id: "s1", trigger: "my address", text: "221B Baker Street, London" },
        {
          id: "s2",
          trigger: "sign off",
          text: "Thanks, and talk soon!\nSanthosh",
        },
      ],
} as unknown as AppSettings;

const TEXTS = [
  "Hey team, quick update on the onboarding redesign. I've finished the permission screens and I'm moving on to the try-it step this afternoon.",
  "Remind me to send the invoice to Priya before Friday and book the flight for the Kubernetes conference.",
  "The sidebar highlight should spring between items, not slide linearly. It needs to feel physical.",
  "Lunch at one?",
  "Let's ship the beta on Monday if the Windows build passes.",
  "Can you share the Figma link for the new icons? I want to check the stroke weights at sixteen pixels.",
  "Notes from the call: keep the free tier, add a cloud option later, and never upload audio by default.",
];
const now = Math.floor(Date.now() / 1000);
const history: HistoryEntry[] = empty
  ? []
  : Array.from({ length: 46 }, (_, i) => ({
      id: 1000 - i,
      file_name: `vobi-${i}.wav`,
      // Spread over the last few weeks, a few a day, with some quiet days.
      timestamp: now - i * 60 * 60 * 13 - (i % 3) * 1700,
      saved: i % 9 === 2,
      title: "",
      transcription_text: TEXTS[i % TEXTS.length],
      post_processed_text: null,
      post_process_prompt: null,
      post_process_requested: false,
      source_name: i % 11 === 4 ? "standup-notes.m4a" : null,
      language: "en",
      language_source: null,
    }));

const handlers: Record<string, (args: Record<string, unknown>) => unknown> = {
  get_app_settings: () => settings,
  get_default_settings: () => settings,
  get_history_entries: (a) => {
    const start =
      a.cursor == null ? 0 : history.findIndex((h) => h.id === a.cursor) + 1;
    const page = history.slice(start, start + ((a.limit as number) ?? 30));
    return { entries: page, has_more: start + page.length < history.length };
  },
  toggle_history_entry_saved: (a) => {
    const e = history.find((h) => h.id === a.id);
    if (e) e.saved = !e.saved;
    return null;
  },
  delete_history_entry: (a) => {
    const i = history.findIndex((h) => h.id === a.id);
    if (i >= 0) history.splice(i, 1);
    return null;
  },
  get_available_models: () => models,
  get_current_model: () => settings.selected_model,
  get_retired_models: () => [],
  rescan_local_models: () => [],
  get_active_notices: () => [],
  get_available_microphones: () => [
    { index: "default", name: "MacBook Pro Microphone", is_default: true },
  ],
  get_available_output_devices: () => [
    { index: "default", name: "MacBook Pro Speakers", is_default: true },
  ],
  get_available_accelerators: () => ({ gpu_devices: [{ name: "Apple M3" }] }),
  get_transcription_model_status: () => settings.selected_model,
  get_windows_microphone_permission_status: () => ({
    supported: true,
    overall_access: "allowed",
  }),
  is_recording: () => false,
  update_custom_words: (a) => {
    settings.custom_words = a.words as string[];
    return null;
  },
  update_snippets: (a) => {
    settings.snippets = a.snippets as AppSettings["snippets"];
    return null;
  },
  change_vobi_on_screen_setting: (a) => {
    settings.vobi_on_screen = a.enabled as boolean;
    return null;
  },
  change_filler_word_removal_enabled_setting: (a) => {
    settings.filler_word_removal_enabled = a.enabled as boolean;
    return null;
  },
  "plugin:macos-permissions|check_accessibility_permission": () => true,
  "plugin:macos-permissions|check_microphone_permission": () => true,
  "plugin:app|version": () => "0.1.0",
};

mockWindows("main");
let listenerId = 1;
mockIPC((cmd, args) => {
  if (cmd.startsWith("plugin:event|")) return listenerId++;
  const handler = handlers[cmd];
  // Anything else (setting writes, shortcuts, ...) succeeds quietly.
  return handler ? handler((args ?? {}) as Record<string, unknown>) : null;
});

console.info(
  "[vobi] Browser preview: Tauri is mocked (src/dev/browserMock.ts)",
);
