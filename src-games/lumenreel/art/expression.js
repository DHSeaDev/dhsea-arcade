// The expression rig. Nine states, each specifying a FACE and a BODY POSE.
//
// Provenance, stated plainly: `/hyperframes` does NOT own this. That skill is an
// HTML-to-MP4 environment-facts layer and its own file marks `motion-doctrine` as
// an explicit [GAP], so there is nothing there to inherit and nothing nearby is
// being silently substituted for it. What IS transferable is the Emberkeep rig:
//   - expression lives in a STATE TABLE driving flame, posture and portrait,
//     not in per-sprite hand-tweaks;
//   - procedural motion at 60fps reads floaty, at ~12fps it reads handcrafted,
//     so the idle animation here is deliberately STEPPED (calcMode="discrete");
//   - at small sizes a face is a rumour, which is why the rig drives BODY
//     LANGUAGE too — tilt, lean, squash and limb posture carry the read at 40px
//     where two eyes and a mouth cannot.

export const EXPRESSIONS = [
  'calm', 'happy', 'curious', 'sleepy', 'alarmed', 'proud', 'shy', 'smug', 'awe',
];

/**
 * browTilt   degrees; positive = inner ends UP (worry), negative = outer up (glee)
 * browY      vertical offset in head-radius units, negative = raised
 * browAsym   extra tilt applied to the RIGHT brow only (quizzical / smug)
 * lidTop     0..1 fraction of the eye covered from above (negative = wide-eyed)
 * lidBot     0..1 fraction covered from below (a smiling eye)
 * pupilDX/DY pupil offset in eye-radius units — where it is LOOKING
 * pupilScale 1 = normal; <1 = pinprick (alarm); >1 = dilated (awe)
 * mouth      shape key, see mouthPath()
 * mouthW/H   scale of that shape
 * tilt       whole-body rotation, degrees
 * lean       whole-body x offset, viewBox units
 * squash     y-scale; <1 = compressed/braced, >1 = slumped
 * limbSplay  limb angle spread multiplier
 * limbDroop  extra downward bend on the limbs
 * bob        idle bob amplitude, viewBox units
 */
export const RIG = {
  calm:    { browTilt: 0,  browY: -0.02, browAsym: 0,   lidTop: 0.06, lidBot: 0.00, pupilDX: 0,    pupilDY: 0,    pupilScale: 1,    mouth: 'smile',   mouthW: 0.34, mouthH: 0.10, tilt: 0,  lean: 0,   squash: 1,    limbSplay: 1,   limbDroop: 0,   bob: 1.2 },
  happy:   { browTilt: -7, browY: -0.16, browAsym: 0,   lidTop: 0.00, lidBot: 0.30, pupilDX: 0,    pupilDY: -0.1, pupilScale: 1.05, mouth: 'grin',    mouthW: 0.52, mouthH: 0.26, tilt: 3,  lean: 0,   squash: 0.96, limbSplay: 1.2, limbDroop: -3,  bob: 2.4 },
  curious: { browTilt: -3, browY: -0.18, browAsym: -14, lidTop: 0.00, lidBot: 0.00, pupilDX: 0.28, pupilDY: -0.1, pupilScale: 1.1,  mouth: 'oh',      mouthW: 0.18, mouthH: 0.18, tilt: 10, lean: 2,   squash: 0.99, limbSplay: 1.1, limbDroop: -1,  bob: 1.6 },
  sleepy:  { browTilt: 5,  browY: 0.10,  browAsym: 0,   lidTop: 0.58, lidBot: 0.05, pupilDX: 0,    pupilDY: 0.15, pupilScale: 0.9,  mouth: 'wave',    mouthW: 0.30, mouthH: 0.08, tilt: 7,  lean: -1,  squash: 1.06, limbSplay: 0.8, limbDroop: 5,   bob: 0.7 },
  alarmed: { browTilt: 13, browY: -0.24, browAsym: 0,   lidTop: -0.16,lidBot: 0.00, pupilDX: 0,    pupilDY: 0,    pupilScale: 0.6,  mouth: 'gasp',    mouthW: 0.26, mouthH: 0.30, tilt: -5, lean: -2,  squash: 0.92, limbSplay: 1.5, limbDroop: -6,  bob: 3.2 },
  proud:   { browTilt: -5, browY: -0.10, browAsym: 0,   lidTop: 0.18, lidBot: 0.22, pupilDX: 0,    pupilDY: -0.1, pupilScale: 1,    mouth: 'smile',   mouthW: 0.42, mouthH: 0.16, tilt: 0,  lean: 0,   squash: 0.94, limbSplay: 1.25,limbDroop: -4,  bob: 1.0 },
  shy:     { browTilt: 8,  browY: 0.04,  browAsym: 0,   lidTop: 0.34, lidBot: 0.10, pupilDX: -0.3, pupilDY: 0.2,  pupilScale: 1,    mouth: 'tight',   mouthW: 0.20, mouthH: 0.05, tilt: -9, lean: -2,  squash: 1.03, limbSplay: 0.65,limbDroop: 3,   bob: 0.9 },
  smug:    { browTilt: -2, browY: -0.06, browAsym: 16,  lidTop: 0.38, lidBot: 0.12, pupilDX: 0.22, pupilDY: 0,    pupilScale: 1,    mouth: 'smirk',   mouthW: 0.36, mouthH: 0.14, tilt: 6,  lean: 1,   squash: 0.98, limbSplay: 1.05,limbDroop: 1,   bob: 1.3 },
  awe:     { browTilt: -9, browY: -0.26, browAsym: 0,   lidTop: -0.10,lidBot: 0.00, pupilDX: 0,    pupilDY: -0.15,pupilScale: 1.35, mouth: 'oh',      mouthW: 0.24, mouthH: 0.24, tilt: 0,  lean: 0,   squash: 0.97, limbSplay: 1.15,limbDroop: -2,  bob: 1.8 },
};

export function rigFor(name) {
  return RIG[name] || RIG.calm;
}

/** Mouth geometry in head-local units, centred on (0,0). */
export function mouthPath(kind, w, h) {
  const x = w, y = h;
  switch (kind) {
    case 'grin':  return `M${-x},${-y * 0.3} Q0,${y * 1.9} ${x},${-y * 0.3} Q0,${y * 0.75} ${-x},${-y * 0.3}Z`;
    case 'smile': return `M${-x},0 Q0,${y * 2.1} ${x},0`;
    case 'smirk': return `M${-x},${y * 0.5} Q${x * 0.15},${y * 1.7} ${x},${-y * 0.6}`;
    case 'tight': return `M${-x},0 L${x},0`;
    case 'wave':  return `M${-x},0 Q${-x * 0.5},${y * 1.6} 0,0 Q${x * 0.5},${-y * 1.6} ${x},0`;
    case 'oh':    return `M0,${-y} Q${x * 1.4},0 0,${y} Q${-x * 1.4},0 0,${-y}Z`;
    case 'gasp':  return `M0,${-y} Q${x * 1.25},${-y * 0.1} 0,${y} Q${-x * 1.25},${-y * 0.1} 0,${-y}Z`;
    default:      return `M${-x},0 Q0,${y * 1.8} ${x},0`;
  }
}

export const FILLED_MOUTHS = new Set(['grin', 'oh', 'gasp']);
