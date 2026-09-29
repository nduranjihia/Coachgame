import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setRole } from '@/lib/device';

/** How long the confirmation stays armed before it disarms itself. */
const ARM_MS = 4000;

/**
 * The escape hatch out of TV mode, and the single most dangerous button in the
 * app: one accidental press with a TV remote rewrites `cc.role`, which used to
 * strand that television on the phone's code entry screen forever. So it takes
 * two deliberate presses.
 */
export default function TvControllerLink() {
  const navigate = useNavigate();
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), ARM_MS);
    return () => clearTimeout(timer);
  }, [armed]);

  const activate = (): void => {
    if (!armed) {
      setArmed(true);
      return;
    }
    setRole('phone');
    navigate('/play', { replace: true });
  };

  return (
    <div className="flex shrink-0 justify-center" style={{ paddingTop: '1vh' }}>
      <button
        type="button"
        onClick={activate}
        onBlur={() => setArmed(false)}
        className="font-body underline"
        style={{ fontSize: '2.4vh', color: armed ? 'var(--sun)' : 'var(--ink-dim)', background: 'none', border: 0 }}
      >
        {armed ? 'Tap again to switch this screen to controller mode' : 'Not a TV? Use as a controller'}
      </button>
    </div>
  );
}
