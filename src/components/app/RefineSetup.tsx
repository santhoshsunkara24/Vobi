import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { openUrl } from "@tauri-apps/plugin-opener";
import { commands } from "@/bindings";
import { useSettings } from "@/hooks/useSettings";
import { useSettingsStore } from "@/stores/settingsStore";

const GROQ = "groq";
const GROQ_KEYS_URL = "https://console.groq.com/keys";
const APPLE = "apple_intelligence";

const filled = (v?: string | null) => !!v && v.trim().length > 0;

/**
 * Tells the user, before they press Refine, what it needs on this computer.
 * Mirrors `refine_settings` in fix_selection.rs: their own AI (key + model),
 * else a Groq key, else Apple Intelligence. When none is there, it walks them
 * through Groq's free key; with a Groq key it says Refine is ready.
 */
export const RefineSetup: React.FC = () => {
  const { t } = useTranslation();
  const { getSetting } = useSettings();
  const updateKey = useSettingsStore((s) => s.updatePostProcessApiKey);
  const [apple, setApple] = useState<boolean | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    commands
      .checkAppleIntelligenceAvailable()
      .then((ok) => alive && setApple(ok === true))
      .catch(() => alive && setApple(false));
    return () => {
      alive = false;
    };
  }, []);

  const keys = (getSetting("post_process_api_keys") ?? {}) as Record<
    string,
    string | undefined
  >;
  const models = getSetting("post_process_models") ?? {};
  const active = getSetting("post_process_provider_id") ?? "";
  const ownAi =
    active !== APPLE && filled(keys[active]) && filled(models[active]);
  const hasGroq = filled(keys[GROQ]);

  // Their own AI or Apple Intelligence already covers Refine: nothing to say.
  if (apple === null || (!hasGroq && (ownAi || apple))) return null;
  if (ownAi && active !== GROQ) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const key = draft.trim();
    if (!/^gsk_\S{20,}$/.test(key)) {
      setError(true);
      return;
    }
    setSaving(true);
    await updateKey(GROQ, key);
    setSaving(false);
    setDraft("");
  };

  if (hasGroq) {
    return (
      <section className="v-group">
        <div className="v-card flex items-center gap-[16px] px-[24px] py-[18px]">
          <div className="min-w-0 flex-1">
            <b className="block text-[15px] font-medium">
              {t("vobi.settings.refineAi.readyTitle")}
            </b>
            <span className="text-[13.5px] text-ink-3">
              {t("vobi.settings.refineAi.readyBody")}
            </span>
          </div>
          <button
            type="button"
            className="v-btn v-btn-soft v-btn-sm"
            onClick={() => updateKey(GROQ, "")}
          >
            {t("vobi.settings.refineAi.remove")}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="v-group">
      <div className="v-group-t">
        <h2 className="m-0 text-[13px] font-semibold text-ink-3">
          {t("vobi.settings.refineAi.group")}
        </h2>
      </div>
      <div className="v-card px-[24px] py-[20px]">
        <b className="block text-[16px] font-medium">
          {t("vobi.settings.refineAi.title")}
        </b>
        <p className="mt-[4px] mb-[14px] text-[14px] text-ink-3">
          {t("vobi.settings.refineAi.body")}
        </p>
        <ol className="m-0 mb-[16px] flex list-decimal flex-col gap-[6px] ps-[20px] text-[14px]">
          <li>
            {t("vobi.settings.refineAi.step1")}{" "}
            <button
              type="button"
              className="font-medium text-logo-primary underline underline-offset-2"
              onClick={() => openUrl(GROQ_KEYS_URL)}
            >
              {t("vobi.settings.refineAi.open")}
            </button>
          </li>
          <li>{t("vobi.settings.refineAi.step2")}</li>
          <li>{t("vobi.settings.refineAi.step3")}</li>
        </ol>
        <form onSubmit={save} className="flex gap-[10px]">
          <input
            className="v-field max-w-[420px] flex-1"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setError(false);
            }}
            placeholder={t("vobi.settings.refineAi.placeholder")}
            aria-label={t("vobi.settings.refineAi.placeholder")}
            aria-invalid={error}
          />
          <button
            type="submit"
            className="v-btn v-btn-ink v-btn-sm"
            disabled={!draft.trim() || saving}
          >
            {t("vobi.settings.refineAi.save")}
          </button>
        </form>
        {error && (
          <p className="mt-[8px] mb-0 text-[13px] text-error">
            {t("vobi.settings.refineAi.invalid")}
          </p>
        )}
        <p className="mt-[12px] mb-0 text-[12.5px] text-ink-3">
          {t("vobi.settings.refineAi.privacy")}
        </p>
      </div>
    </section>
  );
};
