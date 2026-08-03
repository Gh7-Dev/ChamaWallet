import { useEffect, useState } from "react";
import { sanitizeSymbol } from "../stellar";
import { t } from "../translations";

function GroupSwitcher({ groupName, onChange, lang }) {
  const [editing, setEditing] = useState(!groupName);
  const [value, setValue] = useState(groupName || "");
  const tr = t[lang || "en"];

  useEffect(() => {
    if (!groupName) setEditing(true);
  }, [groupName]);

  const handleSave = (e) => {
    e.preventDefault();
    const sanitized = sanitizeSymbol(value);
    if (!sanitized) return;
    onChange(sanitized);
    setEditing(false);
  };

  if (editing) {
    return (
      <form className="group-switcher group-switcher--edit" onSubmit={handleSave}>
        <label htmlFor="group-switcher-input">{tr.groupName}</label>
        <div className="group-switcher__row">
          <input
            id="group-switcher-input"
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. Nguruwe_Savings"
          />
          <button className="btn btn--primary" type="submit" disabled={!value.trim()}>
            {tr.save}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="group-switcher">
      <span className="group-switcher__label">
        {tr.groupLabel}: <strong>{groupName}</strong>
      </span>
      <button
        type="button"
        className="group-switcher__link"
        onClick={() => { setValue(groupName); setEditing(true); }}
      >
        {tr.switchGroupLink}
      </button>
    </div>
  );
}

export default GroupSwitcher;
