import { useEffect, useState } from "react";
import { sanitizeSymbol } from "../stellar";

/**
 * Shows the persisted group name as a read-only label with a
 * "Switch Group" link, or — when no group is set yet — an inline
 * one-time name entry. Used everywhere a form would otherwise need a
 * manually-typed group name field.
 */
function GroupSwitcher({ groupName, onChange }) {
  const [editing, setEditing] = useState(!groupName);
  const [value, setValue] = useState(groupName || "");

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
        <label htmlFor="group-switcher-input">Jina la Kikundi / Group Name</label>
        <div className="group-switcher__row">
          <input
            id="group-switcher-input"
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. Nguruwe Savings"
          />
          <button className="btn btn--primary" type="submit" disabled={!value.trim()}>
            Hifadhi / Save
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="group-switcher">
      <span className="group-switcher__label">
        Kikundi / Group: <strong>{groupName}</strong>
      </span>
      <button
        type="button"
        className="group-switcher__link"
        onClick={() => {
          setValue(groupName);
          setEditing(true);
        }}
      >
        Badilisha Kikundi / Switch Group
      </button>
    </div>
  );
}

export default GroupSwitcher;
