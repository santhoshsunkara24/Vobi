import React from "react";

interface SettingsGroupProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
}

/** A titled white card of setting rows, as in the prototype's Settings page. */
export const SettingsGroup: React.FC<SettingsGroupProps> = ({
  title,
  description,
  children,
}) => {
  return (
    <section className="v-group">
      {title && (
        <div className="v-group-t">
          <h2 className="m-0 text-[13px] font-semibold text-ink-3">{title}</h2>
          {description && (
            <p className="mt-1 mb-0 text-[12.5px] font-medium text-ink-3">
              {description}
            </p>
          )}
        </div>
      )}
      <div className="v-card overflow-visible px-[24px] py-[6px]">
        <div className="divide-y divide-[var(--hairline)]">{children}</div>
      </div>
    </section>
  );
};
