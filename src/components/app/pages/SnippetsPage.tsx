import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Snippet } from "@/bindings";
import { useSettings } from "@/hooks/useSettings";
import { BoltIcon, CloseIcon, PlusIcon } from "../icons";

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * Say a short phrase, get the full text. Snippets are saved in settings
 * (`snippets`), but nothing expands them yet.
 * TODO(snippets): expand triggers in the transcription pipeline.
 */
export const SnippetsPage: React.FC<{ autoFocus?: boolean }> = ({
  autoFocus = false,
}) => {
  const { t } = useTranslation();
  const { getSetting, updateSetting, isUpdating } = useSettings();
  const snippets: Snippet[] = getSetting("snippets") ?? [];
  const [adding, setAdding] = useState(autoFocus);
  const [trigger, setTrigger] = useState("");
  const [text, setText] = useState("");
  const triggerRef = useRef<HTMLInputElement>(null);
  const busy = isUpdating("snippets");

  useEffect(() => {
    if (adding) triggerRef.current?.focus();
  }, [adding]);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trigger.trim() || !text.trim()) return;
    updateSetting("snippets", [
      ...snippets,
      { id: newId(), trigger: trigger.trim(), text: text.trim() },
    ]);
    setTrigger("");
    setText("");
    setAdding(false);
  };

  const remove = (id: string) =>
    updateSetting(
      "snippets",
      snippets.filter((s) => s.id !== id),
    );

  return (
    <section className="v-page">
      <div className="v-top">
        <div className="flex-1">
          <h1>{t("vobi.snippets.title")}</h1>
          <div className="v-sub">{t("vobi.snippets.sub")}</div>
        </div>
        {!adding && (
          <button
            type="button"
            className="v-btn v-btn-ink"
            onClick={() => setAdding(true)}
          >
            <PlusIcon />
            {t("vobi.snippets.new")}
          </button>
        )}
      </div>

      {adding && (
        <form
          onSubmit={save}
          className="v-card mb-[16px] flex animate-rise flex-col gap-[10px] p-[16px]"
        >
          <input
            ref={triggerRef}
            className="v-field bg-surface-2 shadow-none"
            value={trigger}
            maxLength={60}
            onChange={(e) => setTrigger(e.target.value)}
            placeholder={t("vobi.snippets.triggerPlaceholder")}
            aria-label={t("vobi.snippets.trigger")}
          />
          <textarea
            className="v-field bg-surface-2 shadow-none"
            rows={3}
            value={text}
            maxLength={2000}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("vobi.snippets.textPlaceholder")}
            aria-label={t("vobi.snippets.text")}
          />
          <div className="flex justify-end gap-[8px]">
            <button
              type="button"
              className="v-btn v-btn-soft v-btn-sm"
              onClick={() => {
                setAdding(false);
                setTrigger("");
                setText("");
              }}
            >
              {t("vobi.snippets.cancel")}
            </button>
            <button
              type="submit"
              className="v-btn v-btn-ink v-btn-sm"
              disabled={!trigger.trim() || !text.trim() || busy}
            >
              {t("vobi.snippets.save")}
            </button>
          </div>
        </form>
      )}

      {snippets.length > 0 ? (
        <div className="v-card v-list-card">
          {snippets.map((s) => (
            <div key={s.id} className="v-lrow">
              <span className="v-plus" aria-hidden="true">
                <BoltIcon size={16} />
              </span>
              <div className="v-t">
                <b>{s.trigger}</b>
                <span title={s.text}>{s.text}</span>
              </div>
              <button
                type="button"
                className="v-icon-btn"
                onClick={() => remove(s.id)}
                disabled={busy}
                aria-label={t("vobi.snippets.remove", { trigger: s.trigger })}
                title={t("vobi.snippets.remove", { trigger: s.trigger })}
              >
                <CloseIcon size={11} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        !adding && <div className="v-empty">{t("vobi.snippets.empty")}</div>
      )}

      <p className="mt-[16px] ms-[4px] text-[12.5px] font-medium text-ink-3">
        {t("vobi.snippets.soon")}
      </p>
    </section>
  );
};
