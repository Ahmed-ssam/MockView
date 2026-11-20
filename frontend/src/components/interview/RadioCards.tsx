"use client";

import { useId } from "react";

type Option<T extends string | number> = { value: T; label: string; hint?: string; disabled?: boolean; disabledReason?: string };

/** Accessible single-choice group: real radio inputs (keyboard + screen reader), card styling. */
export function RadioCards<T extends string | number>({
  legend, value, onChange, options, columns = "sm:grid-cols-2",
}: {
  legend: string; value: T | undefined; onChange: (v: T) => void; options: Option<T>[]; columns?: string;
}) {
  const name = useId();
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className={`grid gap-2.5 ${columns}`}>
        {options.map((o) => {
          const id = `${name}-${o.value}`;
          return (
            <div key={String(o.value)}>
              <input
                id={id} type="radio" name={name} className="peer sr-only"
                checked={value === o.value} disabled={o.disabled}
                onChange={() => onChange(o.value)}
              />
              <label
                htmlFor={id}
                className={`flex h-full cursor-pointer flex-col rounded-control border bg-white px-3.5 py-3 text-sm transition
                  peer-checked:border-navy peer-checked:ring-2 peer-checked:ring-navy
                  peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-slate-blue
                  peer-disabled:cursor-not-allowed peer-disabled:opacity-55 border-border hover:border-slate-blue`}
              >
                <span className="font-medium">{o.label}</span>
                {(o.hint || (o.disabled && o.disabledReason)) && (
                  <span className="mt-0.5 text-xs text-navy/75">{o.disabled && o.disabledReason ? o.disabledReason : o.hint}</span>
                )}
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
