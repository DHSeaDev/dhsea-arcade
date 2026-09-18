// Species palettes. Roles, not literal-per-shape colours: every drawer indexes
// these by role. Ramps are hue-shifted (shadow toward blue-violet, light toward
// amber) — mixing toward black and white is what makes art look plastic.
//
// Required roles: line, shadow, base, light, hi, lid. Everything else is a named accent.

export const PAL = {
  ember:   { line: '#4a2126', shadow: '#8e3a33', base: '#d2642f', light: '#f1955a', hi: '#ffc58e', lid: '#c85a2c', cream: '#f8e8d2', creamShade: '#d9bfae', sock: '#3a2833', tip: '#ffd27a', blush: '#ff8f7a', nose: '#2a1b22', earIn: '#f6c9b0' },
  pip:     { line: '#3b2226', shadow: '#6c4239', base: '#a96b3d', light: '#cc935c', hi: '#ecc38e', lid: '#9e6238', belly: '#f2ddc2', stripeD: '#4a2c2d', stripeL: '#f4e7d4', blush: '#f0947e', nose: '#3a2228', seed: '#8a5a2e', seedCap: '#5e3b22', bellyShade: '#d9bfa0' },
  wicket:  { line: '#1e2622', shadow: '#1f2b2a', base: '#34473a', light: '#557059', hi: '#8fae84', lid: '#34473a', collar: '#e2833b', glowA: '#fff3a6', glowB: '#ffd44f', glowC: '#e0a23a', wing: '#d9eeff', vein: '#9dbad6', eye: '#1a1418' },
  clover:  { line: '#584348', shadow: '#ad96a0', base: '#e4d0b3', light: '#f4e7d2', hi: '#fff8ea', lid: '#dcc6aa', earIn: '#f3a9ad', blush: '#f5a0a6', nose: '#e0787f', leaf: '#5aa845', leafD: '#357a3a', tail: '#fffaf2' },
  fen:     { line: '#1c4636', shadow: '#2d7456', base: '#5eb04b', light: '#8fd46b', hi: '#d8f59e', lid: '#56a646', belly: '#ece4a8', bellyShade: '#c9c07e', pad: '#f2c46c', spot: '#3f8a45', sac: '#f4e8b8', eye: '#20161c', iris: '#c9a93a', mouth: '#3e2230', bellyHi: '#fbf6cf' },
  thistle: { line: '#3c2926', shadow: '#5d4441', base: '#7c5b45', light: '#a07a5c', hi: '#ead8bf', lid: '#e3c3a0', face: '#e8caa6', faceShade: '#c09a86', quillTip: '#f1e3cc', nose: '#261a1e', blush: '#f09a86', leaf: '#d4863a', faceHi: '#fff2de' },
  sage:    { line: '#33251e', shadow: '#4f3a35', base: '#7c5a3d', light: '#a47c55', hi: '#cfa877', lid: '#6f5036', ring: '#dcbd8e', ringD: '#b08a5c', moss: '#6e9b4a', mossL: '#9cc56a', eye: '#2a1c14', eyeGlow: '#ffd98a', leaf: '#76b04e', shroom: '#e2d1b4', shroomCap: '#c7704a', ringHi: '#f1dcb4', stem: '#5f8a3c' },
  bramble: { line: '#2b2c39', shadow: '#5b5d72', base: '#8a8e9a', light: '#b5b9c4', hi: '#dde0e8', lid: '#8a8e9a', mask: '#34353f', white: '#f0f0f3', ring: '#3c3d48', nose: '#1f2028', sack: '#b99a6e', sackD: '#8a6d4a', spoon: '#d7dde6', blush: '#e8a0a8' },
  tuck:    { line: '#3a2a1f', shadow: '#6a5638', base: '#9ba46a', light: '#bcc48a', hi: '#dde3ae', lid: '#8f9860', shell: '#c9993e', shellL: '#e6c06a', shellD: '#7b5230', plate: '#6a4528', moss: '#7fae52', mossL: '#a8d072', eye: '#2a1a14', sproutLine: '#4f7a36', gloss: '#fff4d0' },
  wren:    { line: '#3a2620', shadow: '#654335', base: '#9b6c46', light: '#c29067', hi: '#e8c49a', lid: '#946541', belly: '#ead3ab', bar: '#5b3b2c', brow: '#f2e3c6', beak: '#5a4232', leg: '#6b5245', note: '#e6a54a', blush: '#f1a58a' },
  nib:     { line: '#2d3218', shadow: '#566027', base: '#7c8c3a', light: '#a3b35a', hi: '#d1dc8e', lid: '#768636', belly: '#f08a3c', bellyL: '#f9b46a', spot: '#e85c33', eye: '#1b1414', blush: '#f38c6a' },
  breeze:  { line: '#4f7f94', shadow: '#9cc7da', base: '#cfe9f5', light: '#eef8fc', hi: '#ffffff', lid: '#cfe9f5', ribA: '#9dd3ea', ribB: '#e6f6fb', ribC: '#b9c9f2', leafA: '#7fbf5a', leafB: '#e9973f', eye: '#35546a', blush: '#f7b7c6' },
  burr:    { line: '#2e1d1c', shadow: '#5b3a34', base: '#8b5a37', light: '#b27d52', hi: '#d7a67a', lid: '#835334', tail: '#4f3a38', tailL: '#6d5450', teeth: '#fff4e0', muzzle: '#d9b38e', nose: '#221416', stick: '#8a6a3e', stickD: '#5e4526', leaf: '#6fae4c', blush: '#e9967c' },
  lichen:  { line: '#473d57', shadow: '#756a8d', base: '#a79bb9', light: '#cfc6dd', hi: '#f1ecf7', lid: '#c4bba4', foot: '#cbc2aa', footShade: '#9e9480', lich: '#9fc07a', lichD: '#6f9955', dew: '#e8f7ff', eye: '#2b2230', footHi: '#f4eedd', cheek: '#e8a7a0' },
  morrow:  { line: '#1f3d44', shadow: '#2e5f66', base: '#3f8087', light: '#7fb9b8', hi: '#c6e6df', lid: '#e8dfca', body: '#ece3cf', bodyShade: '#c1b39d', spot: '#ece6c6', spotD: '#2a3b53', fuzz: '#f7f1e2', eye: '#1d1a24', fuzzHi: '#fffdf6' },
  hollow:  { line: '#2b1d36', shadow: '#43305a', base: '#6b4a79', light: '#9170a1', hi: '#bea0c9', lid: '#6b4a79', membrane: '#8a5a8b', rim: '#ffbf6e', earIn: '#d69ab8', branch: '#5c4531', branchD: '#3d2d22', blush: '#e89ab8', eye: '#140e1a', leaf: '#6f9a4a' },
  ripple:  { line: '#2d1f1a', shadow: '#533a2c', base: '#7b5337', light: '#a47654', hi: '#e4c09a', lid: '#72492f', belly: '#ecd6b8', water: '#8fc6d9', waterD: '#4f94ad', pebble: '#8d97a3', pebbleL: '#c3cbd4', nose: '#1d1412', blush: '#e39a82' },
  juniper: { line: '#3b2518', shadow: '#7a4a33', base: '#c68a55', light: '#e0ad7a', hi: '#f6d7ae', lid: '#bd8150', belly: '#f3e1c6', dapple: '#fbeedb', hoof: '#3a2a26', earIn: '#f0b7a6', eye: '#1c1f3a', iris: '#4a6cb8', nose: '#2a1a1a', blush: '#ef9e8a' },
  dapple:  { line: '#4a1f25', shadow: '#962f3b', base: '#d8483c', light: '#f27a5b', hi: '#ffb18e', lid: '#e6d6ba', spot: '#fcf3e5', stalk: '#efe2c8', stalkShade: '#c9b69c', gill: '#e5c9a6', blush: '#f58f8f', spore: '#fff1c9', gloss: '#fff3e8' },
  hush:    { line: '#3b3466', shadow: '#3f3a6d', base: '#7b70ab', light: '#b1a8d8', hi: '#e2ddf5', lid: '#7b70ab', mist: '#9d93c9', needle: '#4d6b5a', eye: '#fff4cf', eyeGlow: '#ffe7a0', mote: '#fff1c2' },
  moss:    { line: '#25272b', shadow: '#4a4d52', base: '#707472', light: '#9a9e9a', hi: '#c9ccc6', lid: '#707472', stripe: '#f3efe6', dark: '#2e3035', strap: '#8a5a36', pouch: '#b98452', pouchD: '#86592f', button: '#e2c46a', blush: '#e9a1a6', nose: '#1b1b1f', bristle: '#d6c28a' },
  luna:    { line: '#2f2533', shadow: '#5d4d66', base: '#8d7b98', light: '#b7a6c0', hi: '#e2d6e6', lid: '#d9ccc0', disc: '#efe4d6', discShade: '#cbbba9', eye: '#1f1618', iris: '#f2b544', beak: '#d69a3e', tuft: '#6d5a78', feet: '#d69a3e', note: '#f5ecd8' },
  cove:    { line: '#27323f', shadow: '#556b82', base: '#7f95aa', light: '#abbdcd', hi: '#dce6ee', lid: '#7f95aa', belly: '#cfd9e1', spot: '#5d7288', bubble: '#dff3ff', nose: '#1b2129', blush: '#e6a2ae', whisker: '#e8eef3' },
  astra:   { line: '#9fb0ff', shadow: '#141a3e', base: '#243063', light: '#3c4b8c', hi: '#6f7fc4', lid: '#243063', star: '#fff6c9', starGlow: '#ffe89a', link: '#c7d2ff', eye: '#fff6c9', eyeGlow: '#ffe89a' },
  root:    { line: '#2a1f18', shadow: '#3f3029', base: '#5d4837', light: '#826550', hi: '#a88a6c', lid: '#5d4837', antler: '#6b4e33', antlerL: '#8f6d4a', stone: '#9aa0a3', stoneL: '#c3c8ca', moss: '#6a9447', snout: '#e3b3a6', eye: '#1c1410', mossL: '#9cc56a', claw: '#e8dccb', snoutD: '#c98a7e' },
};

// Neutrals any creature may use: pure highlight whites, eye/sclera/mouth darks and
// the shared contact-shadow ink. Anything else must come from the species palette.
export const NEUTRALS = ['#ffffff', '#fff', '#fffaf2', '#fffaf0', '#fbf6ee', '#241a24', '#5b2733', '#1d1a2e'];
