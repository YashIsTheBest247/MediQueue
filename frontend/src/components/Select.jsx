import { useEffect, useRef, useState } from "react";

export default function Select({
  value,
  onChange,
  options,
  className = "",
  ariaLabel,
  block = false,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const current =
    options.find((o) => o.value === value) || options[0] || { label: "" };

  return (
    <div
      className={"mq-select" + (block ? " block" : "") + (className ? " " + className : "")}
      ref={ref}
    >
      <button
        type="button"
        className="mq-select-btn"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className="mq-select-label">{current.label}</span>
        <span className={"mq-select-caret" + (open ? " up" : "")} />
      </button>

      {open && (
        <div className="mq-select-menu" role="listbox">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              className={"mq-select-item" + (o.value === value ? " on" : "")}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
