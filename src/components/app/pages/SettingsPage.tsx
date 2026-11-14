import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { type } from "@tauri-apps/plugin-os";
import { useSettings } from "@/hooks/useSettings";
import { isChinese } from "@/lib/utils/languageSuggestions";
import { SettingsGroup } from "@/components/ui/SettingsGroup";
import { SettingContainer } from "@/components/ui/SettingContainer";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import SecureInputWarning from "@/components/SecureInputWarning";
import type { OnboardingStep } from "@/components/onboarding/onboardingStore";
import {
  AboutSettings,
  AdvancedSettings,
  AutostartToggle,
  ChannelSelector,
  ChineseScriptSetting,
  DebugSettings,
  MicrophoneSelector,
  ModelsSettings,
  OutputDeviceSelector,
  PostProcessingSettings,
  PreferredLanguages,
  ShortcutActivationSetting,
  ShortcutInput,
  ShowOverlay,
  StartHidden,
  AudioFeedback,
} from "@/components/settings";
import { ModelSettingsCard } from "@/components/settings/general/ModelSettingsCard";
import { MuteWhileRecording } from "@/components/settings/MuteWhileRecording";
import { VolumeSlider } from "@/components/settings/VolumeSlider";
import { FillerWordRemoval } from "@/components/settings/FillerWordRemoval";
import { AppendTrailingSpace } from "@/components/settings/AppendTrailingSpace";
import { AutoSubmit } from "@/components/settings/AutoSubmit";
import { ShowTrayIcon } from "@/components/settings/ShowTrayIcon";
import { AppLanguageSelector } from "@/components/settings/AppLanguageSelector";
import { Segmented } from "../Segmented";
import type { Page } from "../AppSidebar";

export type SettingsTab =
  | "general"
  | "model"
  | "advanced"
  | "postprocessing"
  | "about"
  | "debug";

interface SettingsPageProps {
  tab: SettingsTab;
  onTab: (tab: SettingsTab) => void;
  onNavigate: (page: Page) => void;
  onPreviewOnboarding: (step: OnboardingStep) => void;
  onRunOnboarding: () => void;
  onRunModelMigration: () => void;
}

/** Talking / Writing / Vobi, with Handy's other options a tab away. */
export const SettingsPage: React.FC<SettingsPageProps> = ({
  tab,
  onTab,
  onNavigate,
  onPreviewOnboarding,
  onRunOnboarding,
  onRunModelMigration,
}) => {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const debug = settings?.debug_mode ?? false;
  const postProcessing = settings?.post_process_enabled ?? false;

  const tabs = [
    { value: "general" as const, label: t("vobi.settings.tabs.general") },
    { value: "model" as const, label: t("vobi.settings.tabs.model") },
    ...(postProcessing
      ? [
          {
            value: "postprocessing" as const,
            label: t("vobi.settings.tabs.postProcessing"),
          },
        ]
      : []),
    { value: "advanced" as const, label: t("vobi.settings.tabs.advanced") },
    { value: "about" as const, label: t("vobi.settings.tabs.about") },
    ...(debug
      ? [{ value: "debug" as const, label: t("vobi.settings.tabs.debug") }]
      : []),
  ];

  // A tab that went away (debug or post-processing switched off).
  const current = tabs.some((x) => x.value === tab) ? tab : "general";
  useEffect(() => {
    if (current !== tab) onTab(current);
  }, [current, tab, onTab]);

  return (
    <section
      className={`v-page ${current === "model" ? "flex h-full flex-col pb-[20px]" : ""}`}
    >
      <div className="v-top flex-wrap">
        <h1 className="flex-1">{t("vobi.settings.title")}</h1>
        <Segmented
          label={t("vobi.settings.tabs.label")}
          value={current}
          options={tabs}
          onChange={onTab}
        />
      </div>
      <SecureInputWarning />

      {current === "general" && <GeneralTab onNavigate={onNavigate} />}
      {current === "model" && (
        <div className="flex min-h-0 flex-1 flex-col">
          <ModelsSettings onChangeLanguages={() => onTab("general")} />
        </div>
      )}
      {current === "postprocessing" && <PostProcessingSettings />}
      {current === "advanced" && <AdvancedSettings />}
      {current === "about" && <AboutSettings />}
      {current === "debug" && (
        <DebugSettings
          onPreviewOnboarding={onPreviewOnboarding}
          onRunOnboarding={onRunOnboarding}
          onRunModelMigration={onRunModelMigration}
        />
      )}
    </section>
  );
};

const GeneralTab: React.FC<{ onNavigate: (page: Page) => void }> = ({
  onNavigate,
}) => {
  const { t } = useTranslation();
  const { getSetting, updateSetting, isUpdating, audioFeedbackEnabled } =
    useSettings();
  const [isLinux] = useState(() => type() === "linux");
  // Only for Chinese speakers, or anyone who already picked a script.
  const speaksChinese =
    (getSetting("spoken_languages") ?? []).some(isChinese) ||
    (getSetting("chinese_script") ?? "as_transcribed") !== "as_transcribed";
  const words = getSetting("custom_words") ?? [];

  return (
    <div>
      <SettingsGroup title={t("vobi.settings.groups.talking")}>
        <ShortcutInput shortcutId="transcribe" grouped />
        <ShortcutInput shortcutId="fix_selection" grouped />
        <ShortcutInput shortcutId="refine_selection" grouped />
        <ShortcutActivationSetting grouped />
        {/* Cancel shortcut stays hidden on Linux: dynamic shortcuts are unstable there. */}
        {!isLinux && <ShortcutInput shortcutId="cancel" grouped />}
        <MicrophoneSelector grouped />
        <ChannelSelector grouped />
        <PreferredLanguages grouped />
        {speaksChinese && <ChineseScriptSetting grouped />}
      </SettingsGroup>

      <ModelSettingsCard />

      <SettingsGroup title={t("vobi.settings.groups.writing")}>
        <FillerWordRemoval grouped />
        <AppendTrailingSpace grouped />
        <AutoSubmit grouped />
        <SettingContainer
          title={t("vobi.settings.dictionary.title")}
          description={
            words.length === 1
              ? t("vobi.settings.dictionary.one")
              : t("vobi.settings.dictionary.many", { count: words.length })
          }
          grouped
        >
          <button
            type="button"
            className="v-btn v-btn-soft v-btn-sm"
            onClick={() => onNavigate("dictionary")}
          >
            {t("vobi.settings.dictionary.open")}
          </button>
        </SettingContainer>
      </SettingsGroup>

      <SettingsGroup title={t("vobi.settings.groups.vobi")}>
        <ToggleSwitch
          checked={getSetting("show_idle_vobi") ?? true}
          onChange={(on) => updateSetting("show_idle_vobi", on)}
          isUpdating={isUpdating("show_idle_vobi")}
          label={t("vobi.settings.idle.label")}
          description={t("vobi.settings.idle.description")}
          grouped
        />
        <ShowOverlay grouped />
        <AudioFeedback grouped />
        <OutputDeviceSelector grouped disabled={!audioFeedbackEnabled} />
        <VolumeSlider disabled={!audioFeedbackEnabled} />
        <MuteWhileRecording grouped />
        <AutostartToggle grouped />
        <StartHidden grouped />
        <ShowTrayIcon grouped />
        <AppLanguageSelector grouped />
      </SettingsGroup>
    </div>
  );
};
