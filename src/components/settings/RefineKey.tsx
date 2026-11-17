import React from "react";
import { useTranslation } from "react-i18next";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useSettings } from "@/hooks/useSettings";
import { currentOsType } from "@/hooks/useOsType";
import { SettingContainer } from "../ui/SettingContainer";
import { ApiKeyField } from "./PostProcessingSettingsApi/ApiKeyField";

const GROQ_KEYS_URL = "https://console.groq.com/keys";

/**
 * The Groq key that turns on Refine. Refine needs nothing else (it picks its
 * own model, fix_selection.rs), so the key lives here in plain sight rather
 * than behind the post-processing settings.
 */
export const RefineKey: React.FC<{ grouped?: boolean }> = ({ grouped }) => {
  const { t } = useTranslation();
  const { getSetting, updatePostProcessApiKey, isUpdating } = useSettings();
  const key = getSetting("post_process_api_keys")?.groq ?? "";
  const isMac = currentOsType() === "macos";

  return (
    <SettingContainer
      title={t("vobi.settings.refineKey.title")}
      description={
        isMac
          ? t("vobi.settings.refineKey.descriptionMac")
          : t("vobi.settings.refineKey.description")
      }
      grouped={grouped}
    >
      <div className="flex items-center gap-[8px]">
        <ApiKeyField
          value={key}
          onBlur={(value) => {
            if (value.trim() !== key)
              updatePostProcessApiKey("groq", value.trim());
          }}
          disabled={isUpdating("post_process_api_key:groq")}
          placeholder={t("vobi.settings.refineKey.placeholder")}
        />
        <button
          type="button"
          className="v-btn v-btn-soft v-btn-sm"
          onClick={() => openUrl(GROQ_KEYS_URL)}
        >
          {t("vobi.settings.refineKey.getKey")}
        </button>
      </div>
    </SettingContainer>
  );
};
