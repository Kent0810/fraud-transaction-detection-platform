import { useLive } from '../data/live';
import { Icon, type IconName } from './Icons';

/** How this browser notifies the analyst of live alerts. Saved per browser (see live.tsx). */
export function AlertPrefs() {
  const { prefs, setPrefs } = useLive();

  async function toggleDesktop(on: boolean) {
    if (on && 'Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    setPrefs({ ...prefs, desktop: on && 'Notification' in window && Notification.permission === 'granted' });
  }

  return (
    <div className="side-prefs">
      <Pref
        icon="ban"
        label="Declines"
        hint="Only notify me about declined payments"
        checked={prefs.declinesOnly}
        onChange={(v) => setPrefs({ ...prefs, declinesOnly: v })}
      />
      <Pref
        icon="volume"
        label="Sound"
        hint="Play a sound for each alert"
        checked={prefs.sound}
        onChange={(v) => setPrefs({ ...prefs, sound: v })}
      />
      <Pref
        icon="desktop"
        label="Desktop"
        hint="Show a desktop notice when this tab is hidden"
        checked={prefs.desktop}
        onChange={(v) => void toggleDesktop(v)}
      />
    </div>
  );
}

function Pref({
  icon,
  label,
  hint,
  checked,
  onChange,
}: {
  icon: IconName;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className={`pref${checked ? ' on' : ''}`} title={hint}>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <Icon name={icon} size={15} />
      {label}
    </label>
  );
}
