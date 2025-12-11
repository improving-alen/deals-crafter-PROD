import "./visual-switch.css";

export default function VisualSwitch({ checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      className={`PolarisSwitch ${checked ? "PolarisSwitch--checked" : ""} ${
        disabled ? "PolarisSwitch--disabled" : ""
      }`}
      onClick={() => !disabled && onChange(!checked)}
      aria-checked={checked}
      role="switch"
    >
      <span className="PolarisSwitch__Track" />
      <span className="PolarisSwitch__Thumb" />
    </button>
  );
}
