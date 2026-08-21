/* Underglory engine. Shared by the popup (garden) and the full page (course).
   The host page sets window.UNDERGLORY_MODE before loading this file.
   No remote code, no network, no eval — Chrome Web Store MV3 requires all
   executable code to ship inside the package, and this file is all of it. */

/* ============================================================================
   UNDERGLORY — morning glory. Two modes on one engine.
     garden — no walls, no goal. The popup surface.
     course — walls and an arch to reach. The full-page surface.
   The vine is the same in both; only the world differs.
   Not an L-system. Explicit node tree, conserved normalized vigor share.
   No text in UI. No numbers. No win/fail state. Dev panel is stripped before v1.
   ========================================================================= */

/* ---------- §rng — seeded, deterministic ---------------------------------- */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

/* ---------- §palette — register ------------------------------------------- */
const PAPER='#efe9dc', INK_H=32, INK_S=0.06, INK_L=0.13;
const K={
  TOTAL_VIGOR : 1,          // conserved; every node holds a share of exactly this
  SEG         : 13,        // internode. A vine's are long; a shrub's are short.          // px before a segment fixes and spawns the next node
  TOTAL_EXT   : 7.5,        // px of NEW growth per tick, for the whole plant.
                            // A fixed budget, not a per-apex rate: otherwise
                            // every new branch adds capacity and growth runs
                            // away. It is also what makes a cut legible —
                            // fewer tips means each surviving tip visibly
                            // speeds up.
  MAX_STEP    : 5.0,        // px/tick ceiling on any one tip — nothing lunges
  MIN_STEP    : 0.85,       // px/tick a tip needs to be worth supporting. With
                            // TOTAL_EXT this caps how many tips the plant can
                            // carry at once. Release from dominance alone is not
                            // enough to break a bud: without a capacity gate
                            // every bud eventually breaks, the budget splits a
                            // thousand ways, and nothing visibly moves again.
  AGE_ESCAPE  : 600,        // ticks over which a bud escapes apical dominance on
                            // its own. Distance does most of the work; this is
                            // the slow secondary release.
  DORMANT_FLOOR: 0.08,      // share weight of a fully suppressed bud
  SUPPRESS    : 0.96,       // apical dominance strength
  SUPPRESS_LAM: 260,        // px decay length of apical dominance
  WAKE_SUPP   : 0.34,       // a bud breaks when the dominance over it falls below
                            // this. LOCAL, not a share threshold: waking on share
                            // is self-defeating — every bud that becomes eligible
                            // enlarges the denominator, so none ever crosses, and
                            // the plant stays a single whip forever.
  CUT_BOOST   : 5.2,
  COURSE_BOOST: 9.0,        // course has ~4 tips, so a cut must move the needle        // release multiplier at the cut site
  CUT_LAM     : 190,        // px decay of the release around the frontier         // px decay length of the release
  CUT_DECAY   : 0.965,      // per-tick decay of the release pulse
  AXIS_LEN    : 940,        // px a first-order axis extends before it is spent.
                            // Determinate axes are what make this read as a
                            // specimen: without them the first laterals consume
                            // the tip budget forever and no second-order branch
                            // ever appears — the plant grows as a flat fan.
  GIRTH       : 0.52,       // trunk thickness coefficient (pipe model)
  GIRTH_EXP   : 0.30,       // sublinear: 1 tip -> a hair, 1500 tips -> ~11px
  SET_RISE    : 0.0020,     // rad/tick a branch's preferred heading rises toward
                            // vertical. A fixed setpoint locks each axis dead
                            // straight; drifting it is what produces an arc.
  ORDER_DECAY : 0.55,       // each branch order is this fraction of its parent's
                            // reach, dominance range and divergence
  LATERAL_A   : 0.78,       // radians of lateral divergence at the junction
  CURVE_BRANCH: 0.048,      // persistent curvature a new lateral inherits
  CURVE_JITTER: 0.010,      // drift of that curvature along an axis
  CURVE_DAMP  : 0.972,      // curvature must actually relax. At 0.992 it
                            // random-walked forever, and a small constant
                            // curvature is exactly a circle: the vine wound
                            // into a tight ball and never left the start.
  CURVE_MAX   : 0.030,      // hard clamp on accumulated curvature
  W_OPEN      : 3.4,        // steer toward open paper. A vine grows into space
                            // it has not already filled; without this nothing
                            // stops a tip from growing back over its own coil.
  OCC_NEAR    : 1.6,        // occupancy sampling radius, in grid cells      // curvature relaxes as wood ages
  WANDER      : 0.045,      // radians of per-segment noise
  // Direction is a weighted blend of three drives, then rate-limited. Paint
  // LEANS the plant; it must never be able to hairpin it into the stroke.
  W_UP        : 0.62,       // negative gravitropism — the plant wants up
  W_KEEP      : 1.30,       // heading persistence — what makes a branch a branch
  MAX_TURN    : 0.055,      // radians per tick, hard cap
  FIELD_N     : 44,         // occupancy grid resolution over the world
  // --- colour --------------------------------------------------------------
  HUE_DRIFT   : 0.00042,    // radians/tick the season hue wanders. Colour is a
                            // record of WHEN a piece of vine grew, so an old
                            // plant carries its whole history in its flowers.
  HUE_WANDER  : 0.06,       // per-node scatter around the season hue
  SAT_BASE    : 0.34,
  SAT_SWING   : 0.26,       // saturation breathes over a much longer period
  SAT_PERIOD  : 5200,
  MAX_NODES   : 5200,       // a course run can outgrow 3400 before the arch;
                            // hitting the cap froze the vine mid-course
  // The world is fixed and independent of the viewport, so the plant does not
  // grow off-screen forever and the same state can be framed by a small popup
  // and a full page alike. The view fits itself to the specimen, plate-style.
  WORLD_W     : 1100,       // a course is taller than it is wide
  WORLD_H     : 1600,
  EDGE        : 130,        // px of soft boundary inside the world edge
  W_EDGE      : 2.4,        // inward steering weight at the boundary
  VIEW_PAD    : 70,         // px of paper left around the specimen
  VIEW_MAXS   : 2.60,       // never magnify past this
  VIEW_MINS   : 0.72,       // garden floor
  VIEW_MINS_C : 0.62,       // course floor — the whole course has to fit, and
                            // clamping it to the garden floor crops the arch
                            // straight off the top of the frame       // never shrink past this. Fit-to-bbox alone pushes
                            // the specimen away as it grows until the whole
                            // thing reads as a distant twig.
  VIEW_BIAS   : 0.45,
  VIEW_LEAD   : 260,        // px of paper kept ahead of the leading tip
  VIEW_GOAL_W : 0.18,       // how much the arch tugs the frame once it is close       // 0 = frame the whole plant, 1 = frame only the
                            // living tips. In between keeps the camera near
                            // where something is actually happening.
  VIEW_EASE   : 0.020,      // per frame — the frame drifts, it never snaps
  ZOOM_STEP   : 1.12,       // per wheel notch
  ZOOM_MIN    : 0.55,       // manual zoom multiplier floor
  ZOOM_MAX    : 4.00,       // manual zoom multiplier ceiling
  HOLD_MS     : 330,        // press-and-hold before a cut commits
  HOLD_SLIP   : 34,         // screen px of drift tolerated during a hold. At 14
                            // a normal hand twitch cancelled the cut silently
                            // and the gesture read as broken.
  VOL         : 1.25,       // master. Measured at -40 dBFS before any of this:
                            // the graph was perfect and the result was
                            // inaudible. 0.90 measured -30.2, still on the
                            // quiet edge; 1.25 lands near -27 with the limiter
                            // holding peaks under 0.2. Gated in gate.js §1 —
                            // "connected" and "audible" are different claims.
  AIR_GAIN    : 0.50,       // every NOISE source (wind, rain, drips, grass,
                            // the snip) goes through one bus at this gain and
                            // through AIR_CUT. Broadband noise is what "fuzzy
                            // or static" means: at -27 dBFS the three brown
                            // beds, the 900Hz-highpassed rain and the 2.6-5.8k
                            // drips were most of the measured energy above 1kHz.
  AIR_CUT     : 2200,       // Hz. Nothing noisy gets above this. The pad and
                            // the bells are 110-880Hz fundamentals, so the
                            // music is untouched and only the hiss is gone.
  PAD_GAIN    : 0.185,      // the harmonic bed under everything. Raised as the
                            // noise came down: the mix has to be CARRIED by
                            // something tonal or lowering the hiss just makes
                            // it quiet instead of peaceful.
  CHORD_SEC   : 13,         // seconds per chord, cross-faded
  MELODY_MIN  : 5200,       // ms between melodic phrases
  MELODY_VAR  : 7000,

  // --- morning glory -------------------------------------------------------
  NUTATE_AMP  : 0.030,      // circumnutation: the searching sweep of a twining
  NUTATE_RATE : 0.115,      // tip. This is the gesture that reads as "vine".
  LEAF_EVERY  : 3,          // internodes between leaves
  LEAF_LEN    : 34,         // px at order 0
  LEAF_GROW   : 34,         // ticks a leaf takes to reach full size
  FLOWER_P    : 0.020,       // chance a mature node sets a flower bud
  FLOWER_MIN_AGE: 120,      // ticks of wood before a node can flower
  FLOWER_R    : 30,
  FLOWER_MAX  : 14,         // open at once. Uncapped, every node blooms and the
                            // vine reads as a bunch of grapes.         // px corolla radius
  DAY_TICKS   : 1300,       // one full day+night
  DAWN        : 0.06,       // phase boundaries: dawn / day / dusk / night
  DUSK        : 0.52,
  SUN_R       : 17,         // px on screen
  STARS       : 46,        // one day. Morning glories open in the morning and
                            // close by afternoon — the day cycle IS the
                            // conditions layer, and it needs no permissions.
  BLOOM_OPEN  : 0.30,       // fraction of the day a corolla is open
  BLOOM_DAYS  : 3,          // days a flower lasts before it is spent

  // --- course --------------------------------------------------------------
  WALL_PUSH   : 3.4,        // repulsion weight at a wall face
  WALL_NEAR   : 62,         // px at which a wall is felt
  WALL_FOLLOW : 2.2,        // tangential weight — a twiner runs ALONG a wall
                            // rather than bouncing off it
  COURSE_UP   : 0.30,       // A course vine barely climbs on its own. It must
                            // not: an unsteered runner that finds the gaps by
                            // itself makes the paint decorative and the course
                            // a cutscene. Measured at 1905 ticks unaided vs 856
                            // steered before this dropped — a 2x edge is not a
                            // game. Swept: at 0.30, 5/5 seeds solve when a path
                            // is painted (1032-1331 ticks) and 0/5 solve blind.
  COURSE_TICK : 130,        // ms — a course plays faster than a garden idles
  COURSE_EXT  : 11.0,       // a course runner travels; it does not fill out
  COURSE_MIN_STEP: 2.6,     // -> 4 tips, not 15. A thicket cannot be steered
                            // through a gap: every extra tip is budget spent
                            // crawling sideways.
  COURSE_AXIS : 4200,       // runners are indeterminate in a course
  STUCK_TICKS : 90,
  DEADEND_TICKS: 620,       // ticks of no height gained before a runner is spent         // a tip that cannot advance this long is spent
  GOAL_R      : 54,         // px radius of the arch
  // --- the pot -------------------------------------------------------------
  POT_W       : 132,        // rim width in world px
  POT_H       : 96,
  POT_FOOT    : 0.62,       // base width as a fraction of the rim
  POT_RIM     : 15,         // rim band height
  MAX_VINES   : 8,          // hard ceiling on growing tips, all levels
  FOCUS_VINES : 3,          // course ceiling. Eight runners read as a thicket:
                            // the budget is fixed, so each extra tip is a
                            // slower leader. Three is the most you can watch.
  STALL_TICKS : 300,        // no gain toward the arch for this long -> rescue
  STALL_NUDGE : 0.9,        // share of a cut pulse the rescue pours in
  GHOST_STEPS : 6,          // segments of projected path drawn ahead of a tip
  TURN_MAX    : 3.0,        // radians of net same-direction turning before a
                            // tip breaks out. A closed circle is 2*PI; this
                            // trips at about half of one, which is early enough
                            // to stop the loop rather than tidy it up after.
  ESCAPE_TICKS: 90,         // ticks a broken-out tip ignores crowding and
                            // drives for open sky. The loops were never a
                            // curvature problem — measured curve was 0.002 of
                            // a 0.03 ceiling — they were the occupancy push
                            // (W_OPEN 3.4) walking the tip around its own mass.
  SENESCE_AT  : 0.94,       // fraction of MAX_NODES at which old wood starts to
                            // drop. Below this nothing is ever shed.
  SENESCE_RATE: 14,         // segments shed per tick while at the limit
  LEVELS      : 100,
  PRUNE_FLOWER: 50,         // points per corolla returned to the compost
  CLEAR_BASE  : 500,        // points for reaching the arch at all
  TIME_RATE   : 25,         // points per second under twice par
  BAND_T      : 34,         // px band thickness
  // --- tools ---------------------------------------------------------------
  TRELLIS_SEEK: 620,        // px at which a runner can SEE a support. A vine
                            // that only feels a rail it is already touching
                            // never finds one — circumnutation is a search, so
                            // the search has to have range.
  TRELLIS_FIND: 2.4,        // long-range weight, strongest when close
  TRELLIS_NEAR: 96,         // px at which a runner feels a support
  TRELLIS_PULL: 5.0,        // attraction onto the rail
  TRELLIS_RUN : 4.2,        // alignment ALONG the rail — a twiner climbs a
                            // support, it does not just lean on it
  TRELLIS_LIFT: 4.2,        // vigor multiplier for a tip on a support
  RAIL_RELEASE: 70,         // px past a rail's end at which it stops pulling.
                            // Without this the nearest point on a finished rail
                            // is its endpoint from every direction, so a tip
                            // that climbs off the top is steered back onto it
                            // and orbits — measured as a ~100px-radius circle
                            // turning at MAX_TURN every step, which is the
                            // signature of a constant perpendicular force, and
                            // the loops in every store capture.
  TRELLIS_STOCK: 900,       // px of rail you hold
  TRELLIS_REGEN: 0.22,      // px/tick returned
  FOOD_R      : 105,        // px radius of a feeding
  FOOD_LIFE   : 520,        // ticks it lasts
  FOOD_LIFT   : 3.4,        // vigor multiplier at the centre
  FOOD_COST   : 1.0,
  FOOD_STOCK  : 4,
  FOOD_REGEN  : 0.0016,     // per tick
};

/* ---------- §state -------------------------------------------------------- */
let W=0,H=0,DPR=1;
const view={x:K.WORLD_W/2, y:K.WORLD_H*0.62, s:1, ready:false, zoom:1, panX:0, panY:0};
const cv=document.getElementById('c'), ctx=cv.getContext('2d');

let rnd, seed=7, tickMs=200, acc=0, last=0, running=true;
let plant=null, field=null;
let hover=null, hoverRail=-1, pointer={x:0,y:0};
let holdId=null, holdT0=0, holdProg=0, panning=false, panFrom=null;
let holdRailIdx=null;                 // a rail being held down to remove

/* ---------- §field — occupancy only --------------------------------------- */
/* The field is now only an occupancy grid. It used to carry a pigment layer for
   the paint tool; painting is gone — colour arrives with time, not from a can. */
function makeField(n){ return {n, occ:new Float32Array(n*n)}; }
/* Occupancy: one cell per bit of wood. Sampled as a gradient so a tip can tell
   which way is emptier. This is what keeps the vine from coiling. */
function occAdd(x,y,v){
  const f=field, [cx,cy]=toCell(f,x,y);
  if(cx<0||cy<0||cx>=f.n||cy>=f.n) return;
  f.occ[cy*f.n+cx]+=v;
}
function occAt(x,y){
  const f=field, [cx,cy]=toCell(f,x,y);
  if(cx<0||cy<0||cx>=f.n||cy>=f.n) return 0;
  return f.occ[cy*f.n+cx];
}
/* unit vector pointing AWAY from crowding, plus how crowded it is here */
function openDir(x,y){
  const e=K.WORLD_W/field.n*K.OCC_NEAR;
  const l=occAt(x-e,y), r=occAt(x+e,y), u=occAt(x,y-e), d=occAt(x,y+e), c=occAt(x,y);
  let gx=l-r, gy=u-d;
  const m=Math.hypot(gx,gy);
  if(m<1e-6) return [0,0,0];
  return [gx/m, gy/m, Math.min(1, c/4)];
}
function fieldIdx(f,cx,cy){return cy*f.n+cx}
function toCell(f,x,y){return [Math.floor(x/K.WORLD_W*f.n), Math.floor(y/K.WORLD_H*f.n)]}

/* Coarse mass map — gives the field GLOBAL reach.
   Without it a stroke only steers growth it already overlaps, so painting
   ahead of the plant does nothing and the layer reads as inert. */
/* Does the straight line a->b cross any wall? Paint on the far side of a wall
   must not pull a tip into the wall; without this the runner presses its face
   against the barrier for as long as you keep painting past it. */
function blocked(ax,ay,bx,by){
  for(const r of walls){
    let t0=0, t1=1;
    const dx=bx-ax, dy=by-ay;
    for(const [p,q] of [[-dx, ax-r.x],[dx, r.x+r.w-ax],[-dy, ay-r.y],[dy, r.y+r.h-ay]]){
      if(Math.abs(p)<1e-9){ if(q<0) { t0=1; t1=0; break; } continue; }
      const t=q/p;
      if(p<0){ if(t>t1) {t0=1;t1=0;break;} if(t>t0) t0=t; }
      else   { if(t<t0) {t0=1;t1=0;break;} if(t<t1) t1=t; }
    }
    if(t0<=t1) return true;
  }
  return false;
}
/* unit direction of pull + a saturating strength in [0,1).
   Weighted FORWARD relative to the tip's heading: a painted path is a line, and
   an unweighted 1/d^2 sum over a line pulls toward its centroid, so the vine
   parks in the middle of the path you drew instead of running along it. */
/* ---------- §levels — one dial, a hundred settings ------------------------
   Everything the earlier builds tuned by hand is now a function of the level
   number. Level 100 is the course this was tested on all session; level 1 is a
   single band with a gap you could steer a bus through. */
function levelConfig(lv){
  lv = Math.max(1, Math.min(K.LEVELS, lv|0));
  const t = (lv-1)/(K.LEVELS-1);
  // A near-flat start is not a ramp: at t^1.22 the first ten levels moved the
  // gap by 13px, which nobody would feel. Ease OUT early so the first stretch
  // changes fast, then let the top end stretch.
  const e = 0.55*Math.pow(t, 0.62) + 0.45*Math.pow(t, 2.1);
  return {
    lv,
    bands : Math.min(7, 1 + Math.floor(e*6.4)),
    gap   : Math.round(340 - e*245),           // 340px -> 95px
    // early levels put the arch low: less ground to cover, not just fewer walls
    topFrac: 0.62 - e*0.46,                    // 0.62 -> 0.16 of world height
    tips  : Math.min(K.MAX_VINES, 3 + Math.round(e*5)),
    wander: 0.34 - e*0.18,                     // gap x-scatter, as a fraction
    par   : Math.round(24 + e*168)             // seconds
  };
}

/* ---------- §world — mode, walls, goal, day cycle ------------------------- */
let mode=(typeof window!=='undefined' && window.UNDERGLORY_MODE) || 'course';
let walls=[], goal=null, dayT=0, reached=0;
/* Two tools, both on-brand and both fed by pruning:
   a TRELLIS gives a runner something to climb (direction), plant FOOD makes it
   climb faster (rate). Paint biases; a trellis commits. */
let level=1, runT=0, runStart=0, score=0, flowersPruned=0, cleared=false;
let bestScore={}, unlocked={}, totalCleared=0;
let motion='full', reducedOK=true;
let trellises=[], foods=[];
/* One slowly wandering hue. Every node born now takes it, with a little
   scatter, so a mature vine reads as bands of colour laid down over time. */
let seasonHue=0.6, seasonT=0;
function seasonColour(){
  const sat = K.SAT_BASE + K.SAT_SWING*0.5*(1+Math.sin(seasonT/K.SAT_PERIOD*6.2832));
  return { h: seasonHue + (rnd()-0.5)*K.HUE_WANDER, s: sat };
}
let trellisStock=K.TRELLIS_STOCK, foodStock=K.FOOD_STOCK;
let activeTool='trellis', dragTrellis=null;

function segNearest(t,x,y){
  const dx=t.x1-t.x0, dy=t.y1-t.y0, L=dx*dx+dy*dy;
  let u = L>0 ? ((x-t.x0)*dx+(y-t.y0)*dy)/L : 0;
  u=Math.max(0,Math.min(1,u));
  const px=t.x0+u*dx, py=t.y0+u*dy;
  return [px, py, Math.hypot(x-px,y-py), u];
}
/* Long-range: which way is the nearest reachable support, and how much does it
   pull from here. Occluded rails do not call. */
function trellisSeek(x,y){
  let bx=0, by=0, bd=K.TRELLIS_SEEK, found=false;
  for(const t of trellises){
    // A rail you have already climbed off the top of is not a support any more.
    // Long-range seek used to keep calling a tip back DOWN to a finished rail,
    // which is the same orbit as the short-range pull, at 620px instead of 96.
    const climbTop = t.y1 < t.y0 ? 1 : 0;
    const ex = climbTop ? t.x1 : t.x0, ey = climbTop ? t.y1 : t.y0;
    if(y < ey - K.RAIL_RELEASE) continue;          // above its top: behind you
    const [px,py,d]=segNearest(t,x,y);
    if(d>=bd) continue;
    if(walls.length && blocked(x,y,px,py)) continue;
    bd=d; bx=px; by=py; found=true;
  }
  if(!found) return [0,0,0];
  const L=Math.hypot(bx-x,by-y)||1;
  return [(bx-x)/L, (by-y)/L, 1-bd/K.TRELLIS_SEEK];
}
/* pull onto the nearest rail, and run along it toward its far end */
/* A rail may not pass through a wall. Drawn across one, it used to drag the
   runner face-first into the barrier and pin it there until the stuck counter
   spent the tip — the support became a trap. The rail is clipped instead, which
   is also honest feedback: you cannot build through a wall. */
function clipTrellis(t){
  if(!walls.length) return t;
  const dx=t.x1-t.x0, dy=t.y1-t.y0, L=Math.hypot(dx,dy);
  if(L<1) return t;
  const steps=Math.ceil(L/6);
  for(let i=1;i<=steps;i++){
    const u=i/steps, px=t.x0+dx*u, py=t.y0+dy*u;
    if(insideAny(px,py,10)){
      const v=Math.max(0,(i-1)/steps);
      return {x0:t.x0, y0:t.y0, x1:t.x0+dx*v, y1:t.y0+dy*v};
    }
  }
  return t;
}
/* How far past the end of this rail the point sits, in px. 0 while it is
   alongside the rail. A support you have climbed off the top of is behind you. */
function railOvershoot(t,x,y){
  const dx=t.x1-t.x0, dy=t.y1-t.y0, L2=dx*dx+dy*dy;
  if(L2<=0) return 0;
  const u=((x-t.x0)*dx+(y-t.y0)*dy)/L2;        // UNclamped
  const len=Math.sqrt(L2);
  if(u>1) return (u-1)*len;
  if(u<0) return (-u)*len;
  return 0;
}
function trellisSteer(x,y){
  let best=null, bd=K.TRELLIS_NEAR;
  for(const t of trellises){
    const [px,py,d]=segNearest(t,x,y);
    if(d<bd){ bd=d; best={t,px,py,d}; }
  }
  if(!best) return [0,0,0,0,0];
  const {t,px,py,d}=best;
  let f=1-d/K.TRELLIS_NEAR;
  // release at the ends, or the rail becomes a post to circle
  const over=railOvershoot(t,x,y);
  if(over>0) f *= Math.max(0, 1 - over/K.RAIL_RELEASE);
  if(f<=0) return [0,0,0,0,0];
  const L=Math.hypot(px-x,py-y)||1;
  // rails always run toward their higher end: a support is something you climb
  let ax=t.x1-t.x0, ay=t.y1-t.y0;
  if(ay>0){ ax=-ax; ay=-ay; }
  const al=Math.hypot(ax,ay)||1;
  return [(px-x)/L, (py-y)/L, ax/al, ay/al, f];
}
function foodLift(x,y){
  let lift=0;
  for(const f of foods){
    const age=(dayT-f.born)/K.FOOD_LIFE; if(age>1) continue;
    const d=Math.hypot(x-f.x, y-f.y); if(d>K.FOOD_R) continue;
    lift = Math.max(lift, (1-d/K.FOOD_R)*(1-age));
  }
  return lift;
}

/* A course is bands with one gap each, so it is solvable by construction and
   never needs a solver to validate. Indirect steering makes a true maze
   miserable — you cannot ask someone to thread a corridor with a paintbrush. */
function buildCourse(){
  walls=[]; goal=null;
  if(mode!=='course') return;   // sandbox has neither walls nor an arch
  const c=levelConfig(level);
  const top=K.WORLD_H*c.topFrac, bot=K.WORLD_H*0.86;
  for(let i=0;i<c.bands;i++){
    const y = bot - (bot-top)*(i+1)/(c.bands+1);
    // Gaps alternate sides. Consecutive gaps on the same side let an unguided
    // runner stumble straight up through all of them.
    const margin=c.gap*0.75;
    const half=(K.WORLD_W-2*margin)/2;
    const gx = (i%2===0)
      ? margin + rnd()*half*c.wander*2.5
      : K.WORLD_W - margin - rnd()*half*c.wander*2.5;
    const g0 = Math.max(0, gx-c.gap/2), g1 = Math.min(K.WORLD_W, gx+c.gap/2);
    if(g0>4)            walls.push({x:0,  y:y-K.BAND_T/2, w:g0,             h:K.BAND_T});
    if(g1<K.WORLD_W-4)  walls.push({x:g1, y:y-K.BAND_T/2, w:K.WORLD_W-g1,   h:K.BAND_T});
  }
  goal={x:K.WORLD_W*0.5 + (rnd()-0.5)*K.WORLD_W*0.30, y:top-K.WORLD_H*0.035};
}
function rectDist(r,x,y){
  const cx=Math.max(r.x, Math.min(x, r.x+r.w));
  const cy=Math.max(r.y, Math.min(y, r.y+r.h));
  return [x-cx, y-cy, Math.hypot(x-cx,y-cy)];
}
function insideAny(x,y,pad){
  for(const r of walls)
    if(x>r.x-pad && x<r.x+r.w+pad && y>r.y-pad && y<r.y+r.h+pad) return true;
  return false;
}
/* Repulsion plus a tangential term. A twining vine that meets a wall runs ALONG
   it looking for the gap; one that only bounces reads as a pinball.
   The tangent is aligned to the tip's OWN heading — an unaligned tangent picks
   a side arbitrarily and the runner slides flat to the world edge and dies
   there, which is exactly what the first build did. */
function wallSteer(x,y,hx,hy){
  let rx=0, ry=0, tx=0, ty=0, near=0;
  for(const r of walls){
    const [dx,dy,d]=rectDist(r,x,y);
    if(d>K.WALL_NEAR) continue;
    const f=(1 - d/K.WALL_NEAR); near=Math.max(near,f);
    const L=d||1e-6, ux=dx/L, uy=dy/L;
    rx += ux*f; ry += uy*f;
    let px=-uy, py=ux;                       // perpendicular to the face
    if(px*hx + py*hy < 0){ px=-px; py=-py; } // ...on the side we were already going
    tx += px*f; ty += py*f;
  }
  return [rx,ry,tx,ty,near];
}

/* ---------- §model -------------------------------------------------------- */
let NEXT_ID=1;
function makeNode(parent,x,y,angle,dormant){
  return {id:NEXT_ID++, parent:parent?parent.id:null, children:[],
    x,y, px:x, py:y, angle, len:0, tips:1, girth:0.55,
    vigor:0, dormant:!!dormant, hue:0, sat:0, age:0, boost:0, cutTip:false,
    curve:0, set:angle,    // `set` = this axis's preferred heading
    order:0, axisLen:0, axisMax:(mode==='course'?K.COURSE_AXIS:K.AXIS_LEN), spent:false,
    leaf:null, flower:null, stuck:0, bestY:y, idleY:0};
}
function makePlant(){
  NEXT_ID=1;
  const nodes=new Map();
  const sx = mode==='course' ? K.WORLD_W*0.5 : K.WORLD_W*0.5;
  const root=makeNode(null, sx, K.WORLD_H*0.96, -Math.PI/2, false);
  root.hue=seasonHue; root.sat=K.SAT_BASE;
  nodes.set(root.id, root);
  return {nodes, rootId:root.id};
}
const N = id => plant.nodes.get(id);
/* A stump left by a cut is NOT a new apex. This is the whole mechanic: the
   apical meristem is what suppresses the buds below it, so removing it must
   remove the suppression. Letting the stump inherit apex status preserves
   dominance across the cut and the plant simply resumes — nothing wakes. */
const isApex = n => n.children.length===0 && !n.dormant && !n.cutTip && !n.spent;

/* ---------- §growth ------------------------------------------------------- */
/* Weight -> normalized share. Conservation is structural: vigor is always a
   share of exactly K.TOTAL_VIGOR, so removing nodes redistributes by
   construction, and the cut pulse decides WHERE the freed share lands. */
/* 0 = free to break, 1 = fully held closed by the apex above it. */
function suppressionOf(n){
  if(!n.dormant) return 0;
  const dist = distToLiveApexAbove(n);
  if(dist===null) return 0;                       // the apex above it is gone
  const lam = K.SUPPRESS_LAM*Math.pow(K.ORDER_DECAY, Math.max(0,n.order-1));
  const s = K.SUPPRESS * Math.exp(-dist/lam) * Math.exp(-n.age/K.AGE_ESCAPE);
  return s/(1 + n.boost);
}
function nodeWeight(n){
  let w = 1;
  if(n.dormant){
    const supp = suppressionOf(n);
    w = K.DORMANT_FLOOR + (1-K.DORMANT_FLOOR)*(1-supp);
  }
  // a runner on a support, or one that has been fed, draws harder
  if(trellises.length){ const ts=trellisSteer(n.x,n.y); if(ts[4]>0) w *= 1 + (K.TRELLIS_LIFT-1)*ts[4]; }
  if(foods.length){ const fl=foodLift(n.x,n.y); if(fl>0) w *= 1 + (K.FOOD_LIFT-1)*fl; }

  // release pulse from a recent cut
  w *= (1 + n.boost);

  // terminal segments carry the growth; interior wood holds little
  if(!isApex(n) && !n.dormant) w *= 0.16;

  return Math.max(w, 1e-6);
}
/* walk up the continuing axis from this bud's parent to its axis terminal */
function distToLiveApexAbove(bud){
  let p = bud.parent!==null ? N(bud.parent) : null;
  if(!p) return null;
  let cur = p, d=0, guard=0;
  while(cur && guard++<4000){
    const nxt = cur.children.length ? N(cur.children[0]) : null;
    if(!nxt) break;
    d += Math.hypot(nxt.x-cur.x, nxt.y-cur.y);
    cur = nxt;
  }
  return isApex(cur) ? d : null;
}
function allocate(){
  let sum=0;
  for(const n of plant.nodes.values()){ n._w = nodeWeight(n); sum += n._w; }
  for(const n of plant.nodes.values()){ n.vigor = K.TOTAL_VIGOR * n._w / sum; }
}
/* There is no failure state. If every apex and every bud has been cut away,
   the oldest surviving wood puts out an adventitious shoot rather than the
   plant reading as dead. */
function resproutIfSpent(){
  let live=false;
  for(const n of plant.nodes.values()){ if(n.dormant || isApex(n)){ live=true; break; } }
  if(live) return;
  let best=null;
  for(const n of plant.nodes.values()) if(!best || n.girth>best.girth) best=n;
  if(best) best.cutTip=false;
}
/* Which held buds break this tick. Least-suppressed first, and only while the
   plant can still support another growing tip. */
/* Sandbox runs the garden numbers: more tips, a stronger climb, no hurry. */
function extBudget(){ return mode==='course' ? K.COURSE_EXT : K.TOTAL_EXT; }
function minStep(){ return mode==='course' ? K.COURSE_MIN_STEP : K.MIN_STEP; }
function vineCap(){
  const byBudget = Math.max(1, Math.floor(extBudget()/minStep()));
  const byLevel  = mode==='course' ? Math.min(K.FOCUS_VINES, levelConfig(level).tips)
                                   : K.MAX_VINES;
  return Math.min(K.MAX_VINES, byBudget, byLevel);   // three in a course, eight in the sandbox
}
function liveApexCount(){
  let n=0; for(const m of plant.nodes.values()) if(isApex(m)) n++; return n;
}
/* Above the ceiling a freed slot does NOT become a ninth vine. It is poured
   into whichever vine is closest to the arch instead, so pruning at full
   capacity buys speed rather than more mouths to feed. */
function pourIntoLeader(amount){
  let best=null, bd=Infinity;
  for(const n of plant.nodes.values()){
    if(!isApex(n)) continue;
    const d = goal ? Math.hypot(n.x-goal.x, n.y-goal.y) : n.y;
    if(d<bd){ bd=d; best=n; }
  }
  if(best){ best.boost += amount; return best.id; }
  return null;
}
/* ---- senescence ---------------------------------------------------------
   The node ceiling is a hard wall: at MAX_NODES every tip stops extending, and
   on the late courses a solve can hit it while still short of the arch — the
   vine simply freezes with no explanation. A plant does not do that. It sheds.
   So when the plant approaches its limit, the oldest finished wood furthest
   from the arch drops, a few segments a tick, and the growing end carries on.
   Only terminal wood on a finished axis is eligible, never a flower, never the
   root, and the stump is capped so a shed tip does not read as a new runner. */
function senesce(){
  if(plant.nodes.size < K.MAX_NODES*K.SENESCE_AT) return;
  const cands=[];
  for(const n of plant.nodes.values()){
    if(n.parent===null || n.children.length) continue;
    if(isApex(n) || n.dormant) continue;              // anything still growing stays
    if(n.flower && !bloomSpent(n.flower)) continue;    // a live corolla is points
    const d = goal ? Math.hypot(n.x-goal.x, n.y-goal.y) : (K.WORLD_H-n.y);
    cands.push([d, n]);
  }
  if(!cands.length) return;
  cands.sort((a,b)=> b[0]-a[0]);                       // furthest from the arch first
  const k = Math.min(K.SENESCE_RATE, cands.length);
  for(let i=0;i<k;i++){
    const n = cands[i][1];
    const p = N(n.parent);
    occAdd(n.x, n.y, -1);
    plant.nodes.delete(n.id);
    if(p){
      p.children = p.children.filter(c=>c!==n.id);
      if(!p.children.length) p.cutTip = true;          // a shed tip is not a new apex
    }
  }
  allocate();
}

/* ---- anti-stuck ---------------------------------------------------------
   A runner can wedge itself: pinned in a pocket, curving into its own
   occupancy, or held on the wrong side of a band. There is no failure state
   here, so the answer is not to end the run — it is to notice that nothing has
   got closer to the arch for a while and intervene the way a gardener would:
   pour vigor into the leader, straighten its set toward the goal, and clear the
   arc it has wound itself into. */
let stallT=0, stallBest=Infinity, rescues=0, stallRuns=0;
function leaderApex(){
  let best=null, bd=Infinity;
  for(const n of plant.nodes.values()){
    if(!isApex(n)) continue;
    const d = goal ? Math.hypot(n.x-goal.x, n.y-goal.y) : n.y;
    if(d<bd){ bd=d; best=n; }
  }
  return best;
}
function goalDistance(){
  const n = leaderApex();
  if(!n) return Infinity;
  return goal ? Math.hypot(n.x-goal.x, n.y-goal.y) : n.y;
}
function rescueLeader(){
  const n = leaderApex();
  if(!n){ resproutIfSpent(); return false; }
  n.curve = 0;                                   // let go of the spiral
  // Aiming straight at the arch is only right when the arch is actually
  // reachable from here. Through a band it points the runner into the wall and
  // the rescue makes things worse — so when the line is blocked, head for open
  // paper instead and let wall-follow find the gap.
  if(goal){
    const clear = !walls.length || !blocked(n.x, n.y, goal.x, goal.y);
    if(clear) n.set = Math.atan2(goal.y-n.y, goal.x-n.x);
    else {
      const [ox,oy] = openDir(n.x, n.y);
      const ang = (ox||oy) ? Math.atan2(oy, ox) : -Math.PI/2;
      n.set = Math.max(-Math.PI+0.30, Math.min(-0.30, ang));
    }
  }
  n.boost += (mode==='course' ? K.COURSE_BOOST : K.CUT_BOOST) * K.STALL_NUDGE;
  // and wake one held bud regardless of the ceiling, so a wedged single runner
  // has a second option rather than only a harder push into the same wall
  let cand=null, cs=Infinity;
  for(const m of plant.nodes.values()){
    if(!m.dormant) continue;
    const s=suppressionOf(m);
    if(s<cs){ cs=s; cand=m; }
  }
  // the ceiling is not negotiable, not even by the rescue: a wedged runner gets
  // a harder push and a straighter set, never a vine the level does not allow
  if(cand && liveApexCount() < vineCap()){ cand.dormant=false; cand.boost += 0.4; }
  rescues++;
  allocate();
  return true;
}
function checkStall(){
  if(cleared || mode!=='course') { stallT=0; return; }
  const d = goalDistance();
  if(d < stallBest - 2){ stallBest = d; stallT = 0; stallRuns = 0; return; }
  if(++stallT >= K.STALL_TICKS){
    stallT = 0;
    stallBest = Math.min(stallBest, d);
    // Escalate. A push and a straighter set fixes a runner that has wound
    // itself up. It does not fix one that is in the wrong place — pushing
    // harder just holds it against the same wall for longer. After two
    // rescues with nothing gained, the plant gives that axis up: the tip is
    // spent, its slot returns, and a held bud somewhere else takes over. That
    // is what a gardener would do, and it is what "find another way" means.
    if(++stallRuns >= 2){
      const lead = leaderApex();
      if(lead){ lead.spent = true; stallRuns = 0; stallBest = Infinity; allocate(); }
      toast('The vine tries elsewhere');
      rescues++;
      return;
    }
    if(rescueLeader()) toast('The vine finds another way');
  }
}
function breakBuds(){
  const cap = vineCap();
  let live = 0, cands = [];
  for(const n of plant.nodes.values()){
    if(isApex(n)){ live++; continue; }
    if(!n.dormant) continue;
    const s = suppressionOf(n);
    if(s < K.WAKE_SUPP) cands.push([s, n]);
  }
  if(live >= cap){ if(cands.length) pourIntoLeader(K.CUT_BOOST*0.55); return; }
  if(!cands.length) return;
  cands.sort((a,b)=> a[0]-b[0] || b[1].id-a[1].id);  // distal first; deterministic
  for(const [,n] of cands){
    if(live >= cap) break;
    n.dormant = false; live++;                        // the wake — the visible payoff
  }
}
function tick(){
  dayT++; runT++;
  if((runT & 15)===0){
    let live=0, open=0;
    for(const n of plant.nodes.values()){
      if(isApex(n)) live++;
      if(n.flower && bloomOpenness(n.flower)>0) open++;
    }
    stats.maxVines=Math.max(stats.maxVines,live);
    stats.maxVinesRun=Math.max(stats.maxVinesRun,live);
    stats.maxOpen=Math.max(stats.maxOpen,open);
  }
  seasonT++;
  seasonHue += K.HUE_DRIFT*(1 + 0.5*Math.sin(seasonT*0.0007));
  trellisStock = Math.min(K.TRELLIS_STOCK, trellisStock + K.TRELLIS_REGEN);
  foodStock    = Math.min(K.FOOD_STOCK, foodStock + K.FOOD_REGEN);
  if(foods.length) foods = foods.filter(f => (dayT-f.born) < K.FOOD_LIFE);
  resproutIfSpent();
  senesce();
  checkStall();
  breakBuds();
  allocate();
  const spawn=[];
  let apexV=0;
  for(const n of plant.nodes.values()) if(isApex(n)) apexV += n.vigor;
  const atCap = plant.nodes.size >= K.MAX_NODES;
  for(const n of plant.nodes.values()){
    n.age++;
    n.boost *= K.CUT_DECAY;
    if(n.boost < 1e-4) n.boost = 0;

    if(n.dormant) continue;
    if(!isApex(n)) continue;

    // extend — this tip's slice of the plant's fixed extension budget
    if(atCap || apexV<=0) continue;
    const step = Math.min(K.MAX_STEP, extBudget() * (n.vigor/apexV));
    if(step < 1e-3) continue;

    let a = n.angle;

    // persistent curvature: each axis holds its own arc, so branches fan out
    // instead of bundling into parallel whips under a shared tropism
    n.set += (-Math.PI/2 - n.set)*K.SET_RISE;
    n.curve *= K.CURVE_DAMP;
    n.curve = Math.max(-K.CURVE_MAX, Math.min(K.CURVE_MAX, n.curve));
    const keep = a + n.curve;
    // W_UP pulls toward this AXIS's preferred heading, not toward vertical.
    // Toward vertical, every lateral straightens up within a few ticks and the
    // plant collapses into a bundle of parallel shoots.
    const wup = mode==='course' ? K.COURSE_UP : K.W_UP;
    const upw = wup*(n.escape>0 ? 3.2 : 1);
    let wx = K.W_KEEP*Math.cos(keep) + upw*Math.cos(n.set);
    let wy = K.W_KEEP*Math.sin(keep) + upw*Math.sin(n.set);
    // walls: push off the face, and run along it toward the gap
    if(walls.length){
      const [rx,ry,tx0,ty0,nearW]=wallSteer(n.x, n.y, Math.cos(keep), Math.sin(keep));
      if(nearW>0){ wx += K.WALL_PUSH*rx + K.WALL_FOLLOW*tx0;
                   wy += K.WALL_PUSH*ry + K.WALL_FOLLOW*ty0; }
    }
    const esc = n.escape>0 ? (n.escape--, true) : false;
    const [ox,oy,crowd]=openDir(n.x, n.y);
    if(crowd>0){ const ow=K.W_OPEN*(esc?0.22:1);
                 wx += ow*crowd*ox; wy += ow*crowd*oy; }
    if(trellises.length){
      const [sx2,sy2,sf]=trellisSeek(n.x, n.y);
      if(sf>0){ wx += K.TRELLIS_FIND*sf*sx2; wy += K.TRELLIS_FIND*sf*sy2; }
      const [tx,ty,ax,ay,tf]=trellisSteer(n.x, n.y);
      if(tf>0){
        // a wall outranks a rail: otherwise the vine is held against the barrier
        const wf = walls.length ? (1 - wallSteer(n.x,n.y,Math.cos(keep),Math.sin(keep))[4]) : 1;
        const g = tf*Math.max(0.25, wf);
        wx += K.TRELLIS_PULL*g*tx + K.TRELLIS_RUN*g*ax;
        wy += K.TRELLIS_PULL*g*ty + K.TRELLIS_RUN*g*ay;
      }
    }
    // soft world boundary — the specimen stays on the plate
    const eL=(K.EDGE-n.x)/K.EDGE, eR=(n.x-(K.WORLD_W-K.EDGE))/K.EDGE;
    const eT=(K.EDGE-n.y)/K.EDGE, eB=(n.y-(K.WORLD_H-K.EDGE))/K.EDGE;
    if(eL>0) wx += K.W_EDGE*eL;   if(eR>0) wx -= K.W_EDGE*eR;
    if(eT>0) wy += K.W_EDGE*eT;   if(eB>0) wy -= K.W_EDGE*eB;
    const target = Math.atan2(wy, wx);
    let dd = ((target - a + Math.PI*3) % (Math.PI*2)) - Math.PI;
    a += Math.max(-K.MAX_TURN, Math.min(K.MAX_TURN, dd));
    a += (rnd()-0.5)*K.WANDER;
    a += Math.sin(n.age*K.NUTATE_RATE + n.id*0.7)*K.NUTATE_AMP;  // circumnutation
    // Anti-loop. A twiner that keeps turning the same way closes a circle and
    // then keeps going round it, which is the coil the whole occupancy grid was
    // meant to stop — the grid answers "is it crowded here", not "have I been
    // going round for a while". Signed turning is accumulated instead, and once
    // the tip has come most of the way round, its arc is dropped and the run
    // straightens out. Turning back the other way cancels, so an S-curve is
    // untouched: only a spiral trips it.
    {
      const turned = ((a - n.angle + Math.PI*3) % (Math.PI*2)) - Math.PI;
      n.turn = (n.turn||0) + turned;
      if(Math.abs(n.turn) > K.TURN_MAX){
        n.curve *= 0.12;
        n.turn = 0;
        // Dropping the arc alone is not enough: an axis whose preferred heading
        // is sideways simply resumes the same circle. The set comes up with it,
        // and for a while the tip stops answering the crowd — otherwise the
        // push off its own mass steers it straight back onto the ring.
        n.set = -Math.PI/2 + (n.set > -Math.PI/2 ? 0.45 : -0.45);
        n.escape = K.ESCAPE_TICKS;
      }
    }
    n.angle = a;
    const nx = n.x + Math.cos(a)*step, ny = n.y + Math.sin(a)*step;
    if(insideAny(nx, ny, 1)){
      // blocked. Do not move into wood; a tip that never gets through is spent,
      // which returns its slot to the plant instead of grinding forever.
      if(++n.stuck > K.STUCK_TICKS) n.spent = true;
      continue;
    }
    n.stuck = 0;
    n.x = nx; n.y = ny;
    // A runner crawling sideways along a wall forever is a dead end. It is spent
    // after long enough so its slot returns to the vine — but slowly, because
    // recognising a dead end and cutting it is the player's job, not the sim's.
    if(n.y < n.bestY - 2){ n.bestY = n.y; n.idleY = 0; }
    else if(++n.idleY > K.DEADEND_TICKS) n.spent = true;
    n.len = Math.hypot(n.x-n.px, n.y-n.py);
    n.axisLen += step;
    if(n.axisLen >= n.axisMax) n.spent = true;   // the axis has finished
    if(goal && !reached && Math.hypot(n.x-goal.x, n.y-goal.y) < K.GOAL_R){
      reached = dayT; arrive(n); finishRun();
    }


    if(n.len > K.SEG) spawn.push(n);
  }
  for(const n of spawn) segment(n);
  maybeFlower();

  // girth accrues from what has flowed through
  accrueGirth();
}
function segment(n){
  const cont = makeNode(n, n.x, n.y, n.angle, false);
  { const c=seasonColour(); cont.hue=c.h; cont.sat=c.s; }
  cont.curve = n.curve + (rnd()-0.5)*K.CURVE_JITTER;
  cont.set = n.set; cont.order = n.order;
  cont.axisLen = n.axisLen; cont.axisMax = n.axisMax;
  cont.bestY = n.bestY; cont.idleY = n.idleY; cont.turn = n.turn||0;
  cont.escape = n.escape||0;
  plant.nodes.set(cont.id, cont);
  occAdd(cont.x, cont.y, 1);
  n.children.push(cont.id);                       // children[0] = continuing axis

  const order = countAxis(n);
  if(rnd() < 0.72){
    const side = (order % 4 < 2) ? 1 : -1;        // alternating phyllotaxis
    const bud = makeNode(n, n.x, n.y, n.angle + side*K.LATERAL_A*(0.75+rnd()*0.5), true);
    { const c=seasonColour(); bud.hue=c.h; bud.sat=c.s*0.7; }
    bud.curve = n.curve*0.4 + side*K.CURVE_BRANCH*(0.55+rnd()*0.9);
    // each new axis is held at its own angle, never allowed to point downward
    const dec = Math.pow(K.ORDER_DECAY, n.order);
    bud.set = Math.max(-Math.PI+0.30, Math.min(-0.30,
              n.set + side*K.LATERAL_A*(0.70+rnd()*0.6)));
    bud.order = n.order+1;
    bud.axisLen = 0;
    bud.axisMax = (mode==='course'?K.COURSE_AXIS:K.AXIS_LEN)*dec*K.ORDER_DECAY*(0.70+rnd()*0.65);
    plant.nodes.set(bud.id, bud);
    n.children.push(bud.id);
  }
  // leaves alternate along the axis; flowers set only on wood that has matured
  const ord=countAxis(n);
  if(ord % K.LEAF_EVERY === 0)
    n.leaf = {side:(ord%(2*K.LEAF_EVERY)<K.LEAF_EVERY)?1:-1, born:n.age,
              scale:Math.pow(K.ORDER_DECAY, n.order*0.5)};
  emitGrowthTone(cont);
}
/* A flower is a slow event: mature wood only, and it lasts a few days. */
function maybeFlower(){
  // Cap the number of UNSPENT corollas, not the number currently open. Every
  // flower now opens on the same morning, so counting open ones caps nothing:
  // at dawn they all bloom at once and the cap is exceeded by 2-3x.
  let live=0;
  for(const n of plant.nodes.values()) if(n.flower && !bloomSpent(n.flower)) live++;
  if(live >= K.FLOWER_MAX) return;
  for(const n of plant.nodes.values()){
    if(n.flower || n.dormant || n.parent===null) continue;
    if(n.age < K.FLOWER_MIN_AGE || n.age > K.FLOWER_MIN_AGE+3) continue;
    if(rnd() > K.FLOWER_P) continue;
    // The corolla takes the colour of the wood it opened on, so a flower dates
    // itself: you can read when that stretch of vine grew from what it blooms.
    // a little variation per corolla, so a stand of flowers reads as a stand
    // rather than as one colour stamped repeatedly
    const jitter=(rnd()-0.5)*0.22;
    n.flower = {born:dayT, phase:rnd()*0.25, hue:n.hue+jitter,
                sat: Math.min(0.68, n.sat*(1.05+rnd()*0.45)),
                tone: 0.82+rnd()*0.12,
                scale:0.85+rnd()*0.4, crown:false};
  }
}
/* 0 closed, 1 fully open. Opens in the morning, closes by afternoon, and the
   corolla is spent after a few days — a morning glory's actual habit. */
function bloomSpent(f){ return !f.crown && (dayT-f.born)/K.DAY_TICKS > K.BLOOM_DAYS; }
function bloomOpenness(f){
  if(f.crown) return 1;
  if(bloomSpent(f)) return 0;
  // Vary the WINDOW per flower, never the phase. A phase offset wraps past 1
  // and re-opens the corolla in the middle of the night.
  const d=dayPhase();
  const span=K.BLOOM_OPEN*(0.78+0.44*f.phase*4);
  if(d > span) return 0;             // open in the morning, shut by afternoon
  return Math.sin(d/span*Math.PI);
}
/* Arrival. No text, no score: a flower opens on the arch and the chimes answer. */
function arrive(n){
  n.flower = {born:dayT, phase:0, hue:n.hue, sat:Math.max(0.50, n.sat),
              tone:0.80, scale:2.6, crown:true};
  if(AC) for(let i=0;i<6;i++) setTimeout(()=>bell([261.63,329.63,392.00,523.25,659.25,783.99][i], 0.105, 5), i*220);
}
function countAxis(n){ let d=0,c=n,g=0; while(c.parent!==null&&g++<4000){c=N(c.parent);d++;} return d; }

/* Pipe model: a branch's thickness follows how many tips it feeds, strongly
   sublinear. Accumulating thickness per tick instead makes the oldest wood grow
   without bound and the trunk renders as a black blob at the cap. */
function accrueGirth(){
  const order=[], stack=[plant.rootId];
  while(stack.length){ const id=stack.pop(); order.push(id);
    const n=N(id); if(n) for(const c of n.children) stack.push(c); }
  const tips=new Map();
  for(let i=order.length-1;i>=0;i--){
    const n=N(order[i]); if(!n) continue;
    let t=0; for(const c of n.children) t += (tips.get(c)||0);
    if(!t) t=1;
    tips.set(n.id, t);
    n.tips = t;
    n.girth = 0.42 + K.GIRTH*Math.pow(t, K.GIRTH_EXP)*Math.min(1, n.age/90);
  }
}

/* ---------- §prune -------------------------------------------------------- */
function subtreeIds(id){
  const out=[], st=[id];
  while(st.length){ const i=st.pop(); const n=N(i); if(!n) continue;
    out.push(i); for(const c of n.children) st.push(c); }
  return out;
}
function cut(id){
  const n=N(id); if(!n || n.id===plant.rootId) return;
  const ids = subtreeIds(id);
  const cx=n.x, cy=n.y;

  // Score BEFORE the subtree is removed. Counting after the delete loop read
  // an empty map every time and silently awarded nothing.
  let cutFlowers=0;
  for(const i of ids){ const m=plant.nodes.get(i); if(m && m.flower && !bloomSpent(m.flower)) cutFlowers++; }
  flowersPruned += cutFlowers;
  stats.flowersTotal += cutFlowers;
  stats.cutsTotal++; stats.cutsRun++;
  score += cutFlowers*K.PRUNE_FLOWER;
  stats.scoreTotal += cutFlowers*K.PRUNE_FLOWER;
  checkAchievements();

  // detach — and terminate the axis at the stump
  const p = N(n.parent);
  if(p){ p.children = p.children.filter(c=>c!==id); p.cutTip = true; }
  for(const i of ids){ const m=plant.nodes.get(i); if(m) occAdd(m.x,m.y,-1); plant.nodes.delete(i); }

  // Release pulse. It lands on the FRONTIER — the surviving node furthest from
  // where you cut — not around the stump. Pruning is meant to push the plant
  // onward, and boosting the neighbourhood of the cut just regrew what you had
  // removed a moment earlier.
  let fx=cx, fy=cy, fd=-1;
  for(const m of plant.nodes.values()){
    const d = Math.hypot(m.x-cx, m.y-cy);
    if(d > fd){ fd=d; fx=m.x; fy=m.y; }
  }
  const bo = mode==='course' ? K.COURSE_BOOST : K.CUT_BOOST;
  for(const m of plant.nodes.values()){
    const d = Math.hypot(m.x-fx, m.y-fy);
    m.boost += bo * Math.exp(-d/K.CUT_LAM) * (m.dormant ? 1.6 : 1);
  }
  // At the ceiling the freed share must not try to become a fourth runner —
  // it goes to whichever tip is nearest the arch, so a prune buys speed.
  if(liveApexCount() >= vineCap()) pourIntoLeader(bo*0.8);
  stallT = 0;                     // a prune is an intervention: give it room
  trellisStock = Math.min(K.TRELLIS_STOCK, trellisStock + ids.length*2.2);
  foodStock    = Math.min(K.FOOD_STOCK, foodStock + ids.length*0.012);
  scheduleSave();
  emitCutTone(cy/K.WORLD_H*H);
  allocate();
}

/* ---------- §compost — pruning returns rail and food, never pigment ------- */
/* Five starter pigments, all earth and plant dyes — nothing that could not have
   come out of a botanist's paintbox. Every other hue on screen has to be mixed
   or composted into existence. */
const hueOf = deg => deg/180*Math.PI;

/* ---------- §paint -------------------------------------------------------- */

/* ---------- §audio — fully synthesized, nothing sampled, nothing licensed ---
   Four layers. The single wind bed read as flat noise; a wind that never
   varies stops being wind and becomes hiss.
     1. wind   — two brown-noise beds at different cutoffs, independently
                 breathing, plus slow gusts
     2. grass  — sparse bandpassed noise grains, the dry rustle
     3. chime  — F minor pentatonic, long decay, sparse; the melody line
     4. events — a chime on a bud breaking, a low thud + snip on a cut,
                 a rising tone while a cut is being held
   ------------------------------------------------------------------------ */
let AC=null, master=null, air=null, bed=null, rain=null, audioTimers=[], holdVoice=null, lastChime=0;
let pad=null, chordIx=0;
// A major pentatonic reads open and warm; the minor one this started on read
// like a funeral. Sprites, birds and crickets sit on the same set so nothing
// ever clashes.
const PENT=[261.63,293.66,329.63,392.00,440.00,523.25,587.33,659.25,783.99,880.00];
function noiseBuffer(sec, brown){
  const len=Math.floor(AC.sampleRate*sec), b=AC.createBuffer(1,len,AC.sampleRate);
  const d=b.getChannelData(0);
  if(brown){ let v=0; for(let i=0;i<len;i++){ const w=Math.random()*2-1; v=(v+0.019*w)/1.019; d[i]=v*3.4; } }
  else     { for(let i=0;i<len;i++) d[i]=Math.random()*2-1; }
  return b;
}
function windLayer(cut, q, lfoRate, lfoDepth, gain, pan){
  const src=AC.createBufferSource(); src.buffer=noiseBuffer(5,true); src.loop=true;
  const lp=AC.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=cut; lp.Q.value=q;
  const g=AC.createGain(); g.gain.value=gain;
  const pn=AC.createStereoPanner(); pn.pan.value=pan;
  const lfo=AC.createOscillator(); lfo.frequency.value=lfoRate;
  const lfoG=AC.createGain(); lfoG.gain.value=lfoDepth;
  lfo.connect(lfoG); lfoG.connect(lp.frequency);
  const gust=AC.createOscillator(); gust.frequency.value=lfoRate*0.21;
  const gustG=AC.createGain(); gustG.gain.value=gain*0.55;
  gust.connect(gustG); gustG.connect(g.gain);
  src.connect(lp); lp.connect(g); g.connect(pn); pn.connect(air);
  src.start(); lfo.start(); gust.start();
  return {src,lp,g};
}
function initAudio(){
  if(AC) return;
  const C = window.AudioContext || window.webkitAudioContext; if(!C) return;
  AC = new C();
  master = AC.createGain(); master.gain.value = 0;
  // Headroom: several bells can land together. A gentle limiter means the mix
  // can be loud enough to hear without the peaks turning to gravel.
  const lim = AC.createDynamicsCompressor();
  lim.threshold.value = -8; lim.knee.value = 12; lim.ratio.value = 6;
  lim.attack.value = 0.004; lim.release.value = 0.22;
  master.connect(lim); lim.connect(AC.destination);
  /* One bus for everything noisy, with a hard ceiling on it. Each noise source
     used to reach master on its own, so the only way to reduce hiss was to
     retune six gains and hope — and the fine-grass layer at a 1900Hz cutoff was
     hiss by construction, whatever its gain said. */
  air = AC.createGain(); air.gain.value = K.AIR_GAIN;
  const airLP = AC.createBiquadFilter();
  airLP.type='lowpass'; airLP.frequency.value=K.AIR_CUT; airLP.Q.value=0.4;
  const airLP2 = AC.createBiquadFilter();          // 2-pole -> 4-pole: 12dB/oct
  airLP2.type='lowpass'; airLP2.frequency.value=K.AIR_CUT; airLP2.Q.value=0.4;
  air.connect(airLP); airLP.connect(airLP2); airLP2.connect(master);
  bed = [
    windLayer(190, 0.5, 0.037, 110, 0.150, -0.40),  // low body, under the pad
    windLayer(430, 0.8, 0.061, 190, 0.045, 0.42)    // leaves in the canopy
    // the third bed (1900Hz, "fine grass hiss") is GONE. It was the fuzz.
  ];
  rain = makeRain();
  master.gain.setTargetAtTime((paused||muted)?0:K.VOL*vol, AC.currentTime, 3.5);   // fades in over seconds
  pad = makePad();
  scheduleChord();
  scheduleGrass(); scheduleChime(); scheduleSprite();
  scheduleCritters(); scheduleWeather(); scheduleMelody();
}
/* A harmonic bed. Wind alone is weather, not music — the thing that reads as
   joy is a chord underneath everything, moving slowly enough that you notice it
   only when it changes. C major: I - vi - IV - V, thirteen seconds each. */
const CHORDS = [
  [130.81, 196.00, 329.63, 493.88],   // Cmaj7
  [110.00, 164.81, 329.63, 440.00],   // Am7
  [174.61, 261.63, 349.23, 440.00],   // Fmaj7
  [196.00, 246.94, 392.00, 587.33]    // G
];
function makePad(){
  const out=AC.createGain(); out.gain.value=0;
  const lp=AC.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=1450; lp.Q.value=0.4;
  // a slow breath on the cutoff keeps it from sounding like an organ
  const lfo=AC.createOscillator(); lfo.frequency.value=0.033;
  const lfoG=AC.createGain(); lfoG.gain.value=420;
  lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start();
  lp.connect(out); out.connect(master);
  const voices=[];
  for(let i=0;i<4;i++){
    const g=AC.createGain(); g.gain.value=0.25;
    const pn=AC.createStereoPanner(); pn.pan.value=(i-1.5)*0.34;
    const os=[];
    for(const det of [-3.5, 3.5]){          // two slightly detuned per note
      const o=AC.createOscillator(); o.type='triangle'; o.detune.value=det;
      o.frequency.value=CHORDS[0][i];
      o.connect(g); o.start(); os.push(o);
    }
    g.connect(pn); pn.connect(lp);
    voices.push({g, os});
  }
  out.gain.setTargetAtTime(K.PAD_GAIN, AC.currentTime, 6);
  return {out, voices, lp};
}
function scheduleChord(){
  if(!AC || !pad) return;
  chordIx=(chordIx+1)%CHORDS.length;
  const t=AC.currentTime, ch=CHORDS[chordIx];
  pad.voices.forEach((v,i)=>{
    for(const o of v.os) o.frequency.setTargetAtTime(ch[i], t, 2.2);  // glide, never step
  });
  audioTimers.push(setTimeout(scheduleChord, K.CHORD_SEC*1000));
}
/* A music-box voice: fundamental plus two quiet partials, long tail. */
function bell(f, gain, dur){
  if(!AC) return;
  const t=AC.currentTime; dur=dur||4.5;
  const g=AC.createGain(); g.gain.value=0;
  const lp=AC.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=f*5; lp.Q.value=0.6;
  const pn=AC.createStereoPanner(); pn.pan.value=Math.random()*1.0-0.5;
  for(const [mul,amp] of [[1,1],[2.0,0.28],[3.01,0.10],[4.98,0.05]]){
    const o=AC.createOscillator(); o.type='sine'; o.frequency.value=f*mul;
    const og=AC.createGain(); og.gain.value=amp;
    o.connect(og); og.connect(lp); o.start(t); o.stop(t+dur+0.1);
  }
  g.gain.setValueAtTime(0,t);
  g.gain.linearRampToValueAtTime(gain, t+0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
  lp.connect(g); g.connect(pn); pn.connect(master);
  lastChime=t;
}
/* Two or three notes, sitting on whatever chord is currently under them. */
function melody(){
  if(!AC) return;
  const scale=[261.63,293.66,329.63,392.00,440.00,523.25,587.33,659.25];
  let i=Math.floor(Math.random()*(scale.length-3));
  const n=2+Math.floor(Math.random()*2);
  for(let k=0;k<n;k++){
    const step=(Math.random()<0.5?1:2);
    i=Math.max(0, Math.min(scale.length-1, i+(Math.random()<0.6?step:-step)));
    const f=scale[i];
    audioTimers.push(setTimeout(()=>bell(f, 0.105, 4.6+Math.random()*2), k*(320+Math.random()*280)));
  }
}
function scheduleMelody(){
  if(!AC) return;
  melody();
  audioTimers.push(setTimeout(scheduleMelody, K.MELODY_MIN + Math.random()*K.MELODY_VAR));
}
/* Rain lives permanently in the graph at zero gain and is faded in and out by
   the weather scheduler. Building and tearing down a noise source per shower
   clicks; a gain ramp does not. */
function makeRain(){
  const src=AC.createBufferSource(); src.buffer=noiseBuffer(4,false); src.loop=true;
  // 900Hz-highpassed white noise IS static. Rain here is the low hush of it
  // on leaves, not the spray.
  const hp=AC.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=240;
  const lp=AC.createBiquadFilter(); lp.type='lowpass';  lp.frequency.value=1400;
  const g=AC.createGain(); g.gain.value=0;
  src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(air);
  src.start();
  return {g, on:false};
}
function scheduleWeather(){
  if(!AC) return;
  const t=AC.currentTime;
  if(rain.on){ rain.g.gain.setTargetAtTime(0, t, 6); rain.on=false;
    audioTimers.push(setTimeout(scheduleWeather, 150000+Math.random()*210000)); }
  else       { rain.g.gain.setTargetAtTime(0.020+Math.random()*0.014, t, 9); rain.on=true;
    audioTimers.push(setTimeout(scheduleWeather, 40000+Math.random()*60000)); }
  // individual drips over the bed
  if(rain.on) dripLoop();
}
function dripLoop(){
  if(!AC || !rain.on) return;
  const t=AC.currentTime, dur=0.05+Math.random()*0.06;
  const s=AC.createBufferSource(); s.buffer=noiseBuffer(dur,false);
  const bp=AC.createBiquadFilter(); bp.type='bandpass';
  bp.frequency.value=620+Math.random()*520; bp.Q.value=3;   // a drop, not a tick
  const g=AC.createGain(); g.gain.setValueAtTime(0.020+Math.random()*0.012,t);
  g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  const pn=AC.createStereoPanner(); pn.pan.value=Math.random()*1.7-0.85;
  s.connect(bp); bp.connect(g); g.connect(pn); pn.connect(air);
  s.start(t); s.stop(t+dur+0.03);
  audioTimers.push(setTimeout(dripLoop, 320+Math.random()*900));
}
/* Sprite: two sines a fifth apart, very short, very quiet, bright. The
   "something small is happy nearby" sound. */
function sprite(){
  if(!AC) return;
  const t=AC.currentTime, f=PENT[4+Math.floor(Math.random()*5)]*2;
  const pn=AC.createStereoPanner(); pn.pan.value=Math.random()*1.6-0.8;
  const g=AC.createGain(); g.gain.value=0;
  g.gain.linearRampToValueAtTime(0.046, t+0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t+0.55);
  for(const m of [1,1.4983]){
    const o=AC.createOscillator(); o.type='sine'; o.frequency.setValueAtTime(f*m,t);
    o.frequency.linearRampToValueAtTime(f*m*1.06, t+0.30);
    o.connect(g); o.start(t); o.stop(t+0.6);
  }
  g.connect(pn); pn.connect(master);
}
function shimmer(){
  if(!AC) return;
  const scale=[523.25,587.33,659.25,783.99,880.00,1046.50];
  let i=Math.floor(Math.random()*(scale.length-3));
  for(let k=0;k<3;k++)
    audioTimers.push(setTimeout(()=>bell(scale[i+k], 0.048, 1.6), k*70));
}
function scheduleSprite(){
  if(!AC) return;
  const r=Math.random();
  if(r<0.45) sprite(); else if(r<0.80) shimmer();
  audioTimers.push(setTimeout(scheduleSprite, 2200+Math.random()*5200));
}
/* Birds by day, crickets by night. The soundscape should tell you what time it
   is without a clock, because there is no text anywhere to tell you. */
function birdCall(){
  if(!AC) return;
  const t=AC.currentTime, base=PENT[5+Math.floor(Math.random()*4)];
  const n=2+Math.floor(Math.random()*2);
  for(let i=0;i<n;i++){
    const st=t+i*0.11, f=base*(1+0.12*i);
    const o=AC.createOscillator(); o.type='sine';
    o.frequency.setValueAtTime(f*1.9, st);
    o.frequency.exponentialRampToValueAtTime(f*2.35, st+0.06);
    const g=AC.createGain(); g.gain.setValueAtTime(0,st);
    g.gain.linearRampToValueAtTime(0.036, st+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, st+0.10);
    const pn=AC.createStereoPanner(); pn.pan.value=Math.random()*1.4-0.7;
    o.connect(g); g.connect(pn); pn.connect(master); o.start(st); o.stop(st+0.14);
  }
}
function cricket(){
  if(!AC) return;
  const t=AC.currentTime;
  for(let i=0;i<3;i++){
    const st=t+i*0.075;
    const s=AC.createBufferSource(); s.buffer=noiseBuffer(0.03,false);
    // Narrowband, so it stays a chirp rather than hiss — but 4.3kHz put it in
    // the same band as the fuzz being removed, and loud enough to lead it.
    const bp=AC.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=2500; bp.Q.value=13;
    const g=AC.createGain(); g.gain.setValueAtTime(0.022,st);
    g.gain.exponentialRampToValueAtTime(0.0001,st+0.03);
    const pn=AC.createStereoPanner(); pn.pan.value=Math.random()*1.6-0.8;
    s.connect(bp); bp.connect(g); g.connect(pn); pn.connect(master);
    s.start(st); s.stop(st+0.05);
  }
}
function scheduleCritters(){
  if(!AC) return;
  if(typeof isNight==='function' && isNight()) cricket(); else birdCall();
  audioTimers.push(setTimeout(scheduleCritters, 2600+Math.random()*7000));
}
function scheduleGrass(){
  if(!AC) return;
  grassGrain();
  audioTimers.push(setTimeout(scheduleGrass, 1900 + Math.random()*4200));
}
function grassGrain(){
  if(!AC) return;
  const t=AC.currentTime, dur=0.09+Math.random()*0.20;
  const s=AC.createBufferSource(); s.buffer=noiseBuffer(dur,false);
  const bp=AC.createBiquadFilter(); bp.type='bandpass';
  bp.frequency.value=520+Math.random()*760; bp.Q.value=1.4+Math.random()*2.2;
  const g=AC.createGain(); g.gain.value=0;
  const pn=AC.createStereoPanner(); pn.pan.value=Math.random()*1.6-0.8;
  g.gain.setValueAtTime(0,t);
  g.gain.linearRampToValueAtTime(0.018+Math.random()*0.016, t+dur*0.35);
  g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
  s.connect(bp); bp.connect(g); g.connect(pn); pn.connect(air);
  s.start(t); s.stop(t+dur+0.05);
}
function scheduleChime(){
  if(!AC) return;
  chime(PENT[Math.floor(Math.random()*PENT.length)], 0.038);
  audioTimers.push(setTimeout(scheduleChime, 4200 + Math.random()*9000));
}
/* two detuned sines through a lowpass — a struck-metal shape without a sample */
function chime(f, gain){
  if(!AC) return;
  const t=AC.currentTime, dur=3.2+Math.random()*2.4;
  const g=AC.createGain(); g.gain.value=0;
  const lp=AC.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=f*4.2; lp.Q.value=0.7;
  const pn=AC.createStereoPanner(); pn.pan.value=Math.random()*1.2-0.6;
  for(const [mul,amp] of [[1,1],[2.01,0.34],[2.98,0.13]]){
    const o=AC.createOscillator(); o.type='sine'; o.frequency.value=f*mul;
    const og=AC.createGain(); og.gain.value=amp;
    o.connect(og); og.connect(lp); o.start(t); o.stop(t+dur+0.1);
  }
  g.gain.setValueAtTime(0,t);
  g.gain.linearRampToValueAtTime(gain, t+0.035);
  g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
  lp.connect(g); g.connect(pn); pn.connect(master);
  lastChime=t;
}
function emitGrowthTone(n){
  if(!AC) return;
  if(AC.currentTime-lastChime < 2.2) return;         // sparse by design
  if(Math.random()>0.16) return;
  const i=Math.min(PENT.length-1, Math.max(0, Math.floor((1-n.y/K.WORLD_H)*PENT.length)));
  bell(PENT[i], 0.055, 3.6);
}
function emitCutTone(y01){
  if(!AC) return;
  const t=AC.currentTime;
  // low body
  const o=AC.createOscillator(); o.type='triangle'; o.frequency.value=74+(1-y01)*26;
  const g=AC.createGain(); g.gain.value=0;
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.15,t+0.05);
  g.gain.exponentialRampToValueAtTime(0.0001,t+1.5);
  o.connect(g); g.connect(master); o.start(t); o.stop(t+1.6);
  // the snip
  const s=AC.createBufferSource(); s.buffer=noiseBuffer(0.30,false);
  const f=AC.createBiquadFilter(); f.type='bandpass'; f.frequency.value=2400; f.Q.value=1.1;
  const sg=AC.createGain(); sg.gain.value=0;
  sg.gain.setValueAtTime(0.16,t); sg.gain.exponentialRampToValueAtTime(0.0001,t+0.26);
  s.connect(f); f.connect(sg); sg.connect(air); s.start(t); s.stop(t+0.32);
}
function emitPaintTone(y01){
  if(!AC) return;
  if(AC.currentTime-lastChime < 0.5) return;
  chime(PENT[Math.floor(Math.random()*4)+4], 0.008);
}
/* a tone that rises while a cut is being held, and stops if you let go */
function holdStart(){
  if(!AC || holdVoice) return;
  const t=AC.currentTime;
  const o=AC.createOscillator(); o.type='sine'; o.frequency.setValueAtTime(150,t);
  o.frequency.linearRampToValueAtTime(260, t+K.HOLD_MS/1000);
  const g=AC.createGain(); g.gain.value=0;
  g.gain.linearRampToValueAtTime(0.055, t+K.HOLD_MS/1000*0.9);
  o.connect(g); g.connect(master); o.start(t);
  holdVoice={o,g};
}
function holdStop(){
  if(!AC || !holdVoice) return;
  const t=AC.currentTime;
  holdVoice.g.gain.cancelScheduledValues(t);
  holdVoice.g.gain.setValueAtTime(holdVoice.g.gain.value, t);
  holdVoice.g.gain.exponentialRampToValueAtTime(0.0001, t+0.18);
  holdVoice.o.stop(t+0.22);
  holdVoice=null;
}

/* ---------- §pot — the vine has to come from somewhere ------------------- */
/* Thrown terracotta in the same register as everything else: ink contour,
   paper interior, hatching for volume. No gradients, no gloss. */
function drawPot(){
  if(!plant) return;
  const root=N(plant.rootId); if(!root) return;
  const cx=root.x, soil=root.y;
  const rw=K.POT_W/2, fw=rw*K.POT_FOOT, h=K.POT_H, rim=K.POT_RIM;
  const top=soil-rim*0.35;

  ctx.save();
  ctx.lineJoin='round'; ctx.lineCap='round';
  const ink='rgba(31,28,24,';
  const lw=Math.max(0.9/view.s, 1.15);

  // body: a tapered vessel with a slight belly
  ctx.beginPath();
  ctx.moveTo(cx-rw, top);
  ctx.bezierCurveTo(cx-rw*1.02, top+h*0.42, cx-fw*1.06, top+h*0.78, cx-fw, top+h);
  ctx.lineTo(cx+fw, top+h);
  ctx.bezierCurveTo(cx+fw*1.06, top+h*0.78, cx+rw*1.02, top+h*0.42, cx+rw, top);
  ctx.closePath();
  ctx.fillStyle='rgba(196,150,116,0.30)';      // muted terracotta, paper-safe
  ctx.fill();
  ctx.lineWidth=lw; ctx.strokeStyle=ink+'0.62)'; ctx.stroke();

  // hatching down the shaded side, following the taper
  ctx.save();
  ctx.clip();
  ctx.lineWidth=Math.max(0.5/view.s,0.7);
  ctx.strokeStyle=ink+'0.16)';
  for(let x=cx-rw-h; x<cx+rw*0.15; x+=7){
    ctx.beginPath(); ctx.moveTo(x, top+h); ctx.lineTo(x+h*0.8, top); ctx.stroke();
  }
  ctx.restore();

  // rim band
  ctx.beginPath();
  ctx.moveTo(cx-rw*1.09, top-rim);
  ctx.lineTo(cx+rw*1.09, top-rim);
  ctx.lineTo(cx+rw, top);
  ctx.lineTo(cx-rw, top);
  ctx.closePath();
  ctx.fillStyle='rgba(196,150,116,0.42)';
  ctx.fill();
  ctx.lineWidth=lw; ctx.strokeStyle=ink+'0.66)'; ctx.stroke();

  // the lip, drawn as an ellipse so the pot reads as a vessel and not a bucket
  ctx.beginPath();
  ctx.ellipse(cx, top-rim, rw*1.09, rim*0.42, 0, 0, 6.2832);
  ctx.fillStyle='rgba(246,242,232,0.92)'; ctx.fill();
  ctx.lineWidth=lw; ctx.strokeStyle=ink+'0.66)'; ctx.stroke();

  // soil, and a couple of crumbs at the stem
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, top-rim, rw*0.96, rim*0.36, 0, 0, 6.2832);
  ctx.clip();
  ctx.fillStyle='rgba(74,60,42,0.42)';
  ctx.fillRect(cx-rw, top-rim-rim, rw*2, rim*2);
  const sr=mulberry32(11);
  ctx.fillStyle='rgba(31,28,24,0.30)';
  for(let i=0;i<26;i++){
    const a=sr()*6.2832, r=Math.sqrt(sr())*rw*0.9;
    ctx.beginPath();
    ctx.arc(cx+Math.cos(a)*r, top-rim+Math.sin(a)*rim*0.30, 0.8+sr()*1.1, 0, 6.2832);
    ctx.fill();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.ellipse(cx, top-rim, rw*0.96, rim*0.36, 0, 0, 6.2832);
  ctx.lineWidth=Math.max(0.6/view.s,0.8); ctx.strokeStyle=ink+'0.34)'; ctx.stroke();

  ctx.restore();
}

/* ---------- §sky — day, night, and the two bodies that mark them ---------- */
/* The day cycle is the conditions layer from the original brief, and it needs
   no permissions at all: it is local time, not browsing state. */
function dayPhase(){ return (dayT/K.DAY_TICKS) % 1; }
function lerp(a,b,t){ return a+(b-a)*t; }
function mixHex(a,b,t){
  return [0,1,2].map(i=>Math.round(lerp(a[i],b[i],t)));
}
const SKY_NIGHT=[221,222,228], SKY_DAWN=[243,228,214], SKY_DAY=[239,233,220], SKY_DUSK=[240,222,213];
function skyColour(){
  const p=dayPhase();
  let c;
  if(p < K.DAWN)            c = mixHex(SKY_NIGHT, SKY_DAWN, p/K.DAWN);
  else if(p < 0.22)         c = mixHex(SKY_DAWN,  SKY_DAY,  (p-K.DAWN)/(0.22-K.DAWN));
  else if(p < K.DUSK-0.10)  c = SKY_DAY;
  else if(p < K.DUSK)       c = mixHex(SKY_DAY,   SKY_DUSK, (p-(K.DUSK-0.10))/0.10);
  else if(p < K.DUSK+0.08)  c = mixHex(SKY_DUSK,  SKY_NIGHT,(p-K.DUSK)/0.08);
  else                      c = SKY_NIGHT;
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
function isNight(){ const p=dayPhase(); return p>=K.DUSK+0.04 || p<K.DAWN*0.5; }
/* Sun and moon share one arc: whichever is up rides it left to right. */
function drawSky(){
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.fillStyle=skyColour(); ctx.fillRect(0,0,W,H);
  const p = skyMoves() ? dayPhase() : 0.22;   // motion:none freezes the sky
  const night=isNight();
  const u = night ? ((p<K.DAWN? p+1 : p) - K.DUSK)/(1+K.DAWN-K.DUSK)
                  : (p - 0)/(K.DUSK);
  const t=Math.min(1,Math.max(0,u));
  const cx = lerp(W*0.10, W*0.90, t);
  const cy = H*0.30 - Math.sin(t*Math.PI)*H*0.20;

  if(night){
    // a few fixed stars — seeded off the day index so they do not crawl
    const sr=mulberry32(Math.floor(dayT/K.DAY_TICKS)+1);
    ctx.fillStyle='rgba(70,72,86,0.30)';
    for(let i=0;i<K.STARS;i++){
      const x=sr()*W, y=sr()*H*0.55, r=0.6+sr()*0.9;
      ctx.beginPath(); ctx.arc(x,y,r,0,6.2832); ctx.fill();
    }
    // moon: a disc with a bite taken out, drawn in ink weight
    ctx.save();
    ctx.beginPath(); ctx.arc(cx,cy,K.SUN_R,0,6.2832);
    ctx.fillStyle='rgba(250,248,240,0.92)'; ctx.fill();
    ctx.lineWidth=1.1; ctx.strokeStyle='rgba(31,28,24,0.34)'; ctx.stroke();
    // the bite is painted in sky, not erased — destination-out would punch a
    // hole through the sky as well as the moon
    ctx.beginPath(); ctx.arc(cx+K.SUN_R*0.46, cy-K.SUN_R*0.20, K.SUN_R*0.88, 0, 6.2832);
    ctx.fillStyle=skyColour(); ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.arc(cx,cy,K.SUN_R,0,6.2832);
    ctx.lineWidth=1.0; ctx.strokeStyle='rgba(31,28,24,0.22)'; ctx.stroke();
  } else {
    // sun: engraved disc with rays, never a glowing blob
    ctx.save();
    ctx.strokeStyle='rgba(31,28,24,0.20)'; ctx.lineWidth=1.0;
    for(let i=0;i<16;i++){
      const a=i/16*6.2832 + p*2.0;
      ctx.beginPath();
      ctx.moveTo(cx+Math.cos(a)*K.SUN_R*1.35, cy+Math.sin(a)*K.SUN_R*1.35);
      ctx.lineTo(cx+Math.cos(a)*K.SUN_R*(1.7+0.25*Math.sin(i*2.1)), cy+Math.sin(a)*K.SUN_R*(1.7+0.25*Math.sin(i*2.1)));
      ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(cx,cy,K.SUN_R,0,6.2832);
    ctx.fillStyle='rgba(252,246,228,0.95)'; ctx.fill();
    ctx.lineWidth=1.2; ctx.strokeStyle='rgba(31,28,24,0.30)'; ctx.stroke();
    ctx.restore();
  }
  // night sits a touch heavier on the page
  if(night){ ctx.fillStyle='rgba(46,48,60,0.055)'; ctx.fillRect(0,0,W,H); }
}

/* ---------- §render ------------------------------------------------------- */
function hsl(h,s,l,a){
  const deg = ((h/Math.PI*180)%360+360)%360;
  return `hsla(${deg.toFixed(1)},${(s*100).toFixed(0)}%,${(l*100).toFixed(0)}%,${a})`;
}
function nodeColor(n, alpha){
  if(n.sat < 0.04) return `hsla(${INK_H},${INK_S*100}%,${INK_L*100}%,${alpha})`;
  const l = 0.36 - n.sat*0.06;
  return hsl(n.hue, Math.min(0.55,n.sat), l, alpha);
}
/* The plate frames the specimen. Without this the plant grows out of the
   viewport and the session ends up watching empty paper. */
/* Active assist: the frame follows the PLANT, not the world. Framing the whole
   course put the specimen at 0.4 scale in the middle of empty paper and made
   the player zoom in by hand before they could do anything. */
function updateView(){
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  let ax=0, ay=0, an=0, leadY=1e9, leadX=0;
  for(const n of plant.nodes.values()){
    if(n.x<x0)x0=n.x; if(n.x>x1)x1=n.x; if(n.y<y0)y0=n.y; if(n.y>y1)y1=n.y;
    if(isApex(n)){ ax+=n.x; ay+=n.y; an++; if(n.y<leadY){ leadY=n.y; leadX=n.x; } }
  }
  if(x0>x1) return;
  // keep some paper ahead of the leading tip so you can see where it is going
  if(an){ y0=Math.min(y0, leadY-K.VIEW_LEAD); x0=Math.min(x0,leadX-K.VIEW_LEAD*0.5);
          x1=Math.max(x1,leadX+K.VIEW_LEAD*0.5); }
  // the arch only tugs the frame once the vine is genuinely near it
  if(goal && an){
    const d=Math.hypot(leadX-goal.x, leadY-goal.y);
    const pull=Math.max(0, 1 - d/(K.WORLD_H*0.45))*K.VIEW_GOAL_W;
    if(pull>0){
      x0=Math.min(x0, goal.x-(goal.x-x0)*(1-pull));
      y0=Math.min(y0, goal.y-(goal.y-y0)*(1-pull));
      x1=Math.max(x1, goal.x+(x1-goal.x)*(1-pull));
    }
  }
  const bw=Math.max(x1-x0,170), bh=Math.max(y1-y0,170);
  const b=an ? K.VIEW_BIAS : 0;
  const tx=(x0+x1)/2*(1-b) + (an?ax/an:0)*b;
  const ty=(y0+y1)/2*(1-b) + (an?ay/an:0)*b;
  const fit=Math.min((W-2*K.VIEW_PAD)/bw, (H-2*K.VIEW_PAD)/bh);
  const floor = mode==='course' ? K.VIEW_MINS_C : K.VIEW_MINS;
  const ts=Math.min(K.VIEW_MAXS, Math.max(floor, fit*(1+b*0.30))) * view.zoom;
  if(!view.ready){ view.x=tx+view.panX; view.y=ty+view.panY; view.s=ts; view.ready=true; return; }
  const e=viewEase();
  view.x += (tx+view.panX-view.x)*e;
  view.y += (ty+view.panY-view.y)*e;
  view.s += (ts-view.s)*e;
}
function applyView(){
  const s=view.s*DPR;
  ctx.setTransform(s,0,0,s, DPR*W/2 - view.x*s, DPR*H/2 - view.y*s);
}
function screenToWorld(px,py){
  return [(px-W/2)/view.s + view.x, (py-H/2)/view.s + view.y];
}
function draw(){
  advanceHold();
  if((hudFrame=(hudFrame+1)%12)===0) updateHUD();
  updateView();
  drawSky();
  applyView();

  drawWalls();
  drawFood();
  drawPot();
  if(goal) drawGoal();

  ctx.lineCap='round'; ctx.lineJoin='round';
  // thick wood first, fine tips last — avoids a heavy segment overprinting a
  // fine one and reading as a banded stripe down the trunk
  const segs=[], buds=[];
  for(const n of plant.nodes.values()){
    if(n.parent===null) continue;
    const p=N(n.parent); if(!p) continue;
    if(n.dormant){ buds.push([n,p]); continue; }
    segs.push([n,p,(p.girth+n.girth)*0.5]);
  }
  segs.sort((a,b)=>b[2]-a[2]);
  for(const [n,p,g] of segs){
    ctx.beginPath();
    ctx.moveTo(p.x,p.y); ctx.lineTo(n.x,n.y);
    ctx.lineWidth = Math.max(0.65/view.s, Math.min(g, 13));
    ctx.strokeStyle = nodeColor(n, 0.92);
    ctx.stroke();
  }
  drawTrellis();
  drawLeaves();
  drawFlowers();
  for(const [n,p] of buds){
    // a dormant bud is a small mark, not a stub — visible, neutral, no promise
    ctx.beginPath();
    ctx.arc(n.x, n.y, Math.max(1.1/view.s, Math.min(p.girth*0.30, 2.6)), 0, 6.2832);
    ctx.fillStyle = nodeColor(n, 0.38);
    ctx.fill();
  }
  drawGhost();
  if(holdRailIdx!==null) drawRailHold(holdRailIdx, holdProg);
  else if(holdId!==null) drawHold(holdId, holdProg);
  else if(hover) drawHover(hover);
  else if(hoverRail>=0) drawRailHover(hoverRail);
  drawWells();
  requestAnimationFrame(loop);
}
/* The field must read as a stain IN the paper, never as a grid or as brush
   strokes. Rasterise it at grid resolution offscreen, then blur it up. */
let fcv=null, fctx=null;
function hslToRgb(h,s,l){
  const a=s*Math.min(l,1-l);
  const f=k=>{const t=(k+h*12/Math.PI)%12; return l-a*Math.max(-1,Math.min(t-3,9-t,1));};
  return [Math.round(f(0)*255), Math.round(f(8)*255), Math.round(f(4)*255)];
}
function drawHover(id){
  const n=N(id); if(!n) return;
  const ids=subtreeIds(id);
  ctx.save();
  for(const i of ids){
    const m=N(i); if(!m||m.parent===null) continue;
    const p=N(m.parent); if(!p) continue;
    ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(m.x,m.y);
    ctx.lineWidth=Math.max(0.6, Math.min(p.girth,11))+2.4/view.s;
    ctx.strokeStyle='rgba(31,28,24,0.16)'; ctx.stroke();
  }
  ctx.restore();
}
/* Walls read as a garden wall in an engraving: paper interior, ink edge,
   diagonal hatching. Never a filled black block — that is game art, and the
   register is the one thing the brief kept. */
function drawWalls(){
  if(!walls.length) return;
  for(const r of walls){
    ctx.save();                                  // one save per rect, one restore
    ctx.beginPath(); ctx.rect(r.x,r.y,r.w,r.h); ctx.clip();
    ctx.fillStyle='rgba(31,28,24,0.10)';
    ctx.fillRect(r.x,r.y,r.w,r.h);
    ctx.strokeStyle='rgba(31,28,24,0.34)';
    ctx.lineWidth=Math.max(0.6/view.s, 0.9);
    for(let x=r.x-r.h; x<r.x+r.w+r.h; x+=8){
      ctx.beginPath(); ctx.moveTo(x, r.y+r.h); ctx.lineTo(x+r.h, r.y); ctx.stroke();
    }
    ctx.restore();
  }
  ctx.save();
  ctx.strokeStyle='rgba(31,28,24,0.70)';
  ctx.lineWidth=Math.max(0.9/view.s, 1.3);
  for(const r of walls) ctx.strokeRect(r.x,r.y,r.w,r.h);
  ctx.restore();
}
/* The arch. A fine ink ring, drawn as a broken circle so it reads as a target
   rather than a UI element. It fills in once the vine arrives. */
function drawGoal(){
  ctx.save();
  ctx.lineWidth=Math.max(0.7/view.s, 1.1);
  ctx.strokeStyle= reached ? 'rgba(31,28,24,0.55)' : 'rgba(31,28,24,0.30)';
  for(let i=0;i<12;i++){
    const a0=i/12*6.2832+0.06, a1=a0+6.2832/12-0.12;
    ctx.beginPath(); ctx.arc(goal.x,goal.y,K.GOAL_R,a0,a1); ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(goal.x,goal.y,K.GOAL_R*0.30,0,6.2832);
  ctx.strokeStyle='rgba(31,28,24,0.22)'; ctx.stroke();
  ctx.restore();
}
/* Cordate leaf — the morning glory silhouette. Ink outline, midrib, a wash of
   whatever pigment that tissue grew through. */
function leafPath(len){
  ctx.beginPath();
  ctx.moveTo(len,0);
  ctx.bezierCurveTo(len*0.62,-len*0.56, len*0.06,-len*0.62, -len*0.13,-len*0.23);
  ctx.bezierCurveTo(-len*0.03,-len*0.07, len*0.02,-len*0.03, 0,0);
  ctx.bezierCurveTo(len*0.02,len*0.03, -len*0.03,len*0.07, -len*0.13,len*0.23);
  ctx.bezierCurveTo(len*0.06,len*0.62, len*0.62,len*0.56, len,0);
  ctx.closePath();
}
function drawLeaves(){
  ctx.save();
  for(const n of plant.nodes.values()){
    const lf=n.leaf; if(!lf) continue;
    const p=N(n.parent); if(!p) continue;
    const grow=Math.min(1,(n.age-lf.born)/K.LEAF_GROW); if(grow<=0.02) continue;
    const len=K.LEAF_LEN*lf.scale*grow;
    if(len*view.s < 2.2) continue;                    // below this it is noise
    const stem=Math.atan2(n.y-p.y, n.x-p.x);
    const a=stem + lf.side*1.05;
    ctx.save();
    ctx.translate(n.x,n.y); ctx.rotate(a);
    leafPath(len);
    ctx.fillStyle = n.sat>0.05 ? hsl(n.hue, Math.min(0.34,n.sat*0.7), 0.55, 0.30)
                               : 'rgba(31,28,24,0.055)';
    ctx.fill();
    ctx.lineWidth=Math.max(0.7/view.s, 0.8);
    ctx.strokeStyle='rgba(31,28,24,0.66)'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(len*0.88,0);
    ctx.strokeStyle='rgba(31,28,24,0.28)'; ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}
/* Trumpet corolla seen face-on: a five-lobed disc, a pale throat, and the five
   radial rays a morning glory actually has. Closed, it is a furled spiral. */
function drawFlowers(){
  ctx.save();
  for(const n of plant.nodes.values()){
    const f=n.flower; if(!f || bloomSpent(f)) continue;
    const open=bloomOpenness(f);
    const R=K.FLOWER_R*f.scale*(0.30+0.70*open);
    if(R*view.s < 1.6) continue;
    ctx.save(); ctx.translate(n.x,n.y);
    if(open < 0.06){
      // furled: a tight spiral bud
      ctx.beginPath();
      for(let t=0;t<=1;t+=0.06){
        const a=t*7.5, r=R*0.55*(1-t*0.75);
        const x=Math.cos(a)*r, y=Math.sin(a)*r*1.5;
        t?ctx.lineTo(x,y):ctx.moveTo(x,y);
      }
      ctx.strokeStyle='rgba(31,28,24,0.45)';
      ctx.lineWidth=Math.max(0.45/view.s,0.55); ctx.stroke();
      ctx.restore(); continue;
    }
    ctx.beginPath();
    for(let i=0;i<=48;i++){
      const th=i/48*6.2832, r=R*(1+0.075*Math.cos(5*th));
      const x=Math.cos(th)*r, y=Math.sin(th)*r;
      i?ctx.lineTo(x,y):ctx.moveTo(x,y);
    }
    ctx.closePath();
    ctx.fillStyle=hsl(f.hue, Math.min(0.62,f.sat), (f.tone||0.88)-f.sat*0.30, 0.62+0.28*open);
    ctx.fill();
    ctx.lineWidth=Math.max(0.45/view.s,0.6);
    ctx.strokeStyle='rgba(31,28,24,0.42)'; ctx.stroke();
    // the five rays and the pale throat
    ctx.strokeStyle=hsl(f.hue, Math.min(0.62,f.sat*1.1), 0.62-f.sat*0.22, 0.60);
    for(let i=0;i<5;i++){
      const th=i/5*6.2832 - Math.PI/2;
      ctx.beginPath(); ctx.moveTo(0,0);
      ctx.lineTo(Math.cos(th)*R*0.94, Math.sin(th)*R*0.94); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(0,0,R*0.30,0,6.2832);
    ctx.fillStyle=`rgba(250,247,238,${(0.55+0.35*open).toFixed(2)})`; ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
/* While a cut is held, the doomed wood lightens and a gap opens at the cut.
   No progress bar, no number — the branch itself shows how far along you are. */
/* A rail under the pointer, and the same closing ring the cut uses — one
   gesture for "remove the thing under your finger", wood or rail. */
function drawRailHover(i){
  const t=trellises[i]; if(!t) return;
  ctx.save();
  ctx.beginPath(); ctx.moveTo(t.x0,t.y0); ctx.lineTo(t.x1,t.y1);
  ctx.lineWidth=Math.max(6/view.s, 5);
  ctx.strokeStyle='rgba(31,28,24,0.16)';
  ctx.stroke();
  ctx.restore();
}
function drawRailHold(i, p){
  const t=trellises[i]; if(!t) return;
  ctx.save();
  ctx.beginPath(); ctx.moveTo(t.x0,t.y0); ctx.lineTo(t.x1,t.y1);
  ctx.lineWidth=Math.max(7/view.s, 6);
  ctx.strokeStyle=`rgba(239,233,220,${(p*0.85).toFixed(3)})`;   // paper, painted over
  ctx.stroke();
  const cx=(t.x0+t.x1)/2, cy=(t.y0+t.y1)/2, R=11/view.s;
  ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI/2, -Math.PI/2 + p*6.2832);
  ctx.lineWidth=1.6/view.s; ctx.strokeStyle='rgba(31,28,24,0.62)'; ctx.stroke();
  ctx.restore();
}
/* Where each runner is headed, three or four segments out, as a dotted line.
   This is the tip's own heading and its own arc extrapolated — not a solve, and
   not a promise: walls, rails and food all still bend it. Pruning is a planning
   act, and planning needs something to plan against. */
function drawGhost(){
  if(!plant || motion==='none') return;
  let apexV=0, tips=[];
  for(const n of plant.nodes.values()) if(isApex(n)){ apexV+=n.vigor; tips.push(n); }
  if(!tips.length || apexV<=0) return;
  ctx.save();
  ctx.setLineDash([3/view.s, 4/view.s]);
  ctx.lineWidth=Math.max(0.7/view.s, 1/view.s);
  ctx.strokeStyle='rgba(31,28,24,0.26)';
  for(const n of tips){
    const step=Math.min(K.MAX_STEP, extBudget()*(n.vigor/apexV));
    if(step<0.4) continue;
    let x=n.x, y=n.y, a=n.angle, c=n.curve;
    ctx.beginPath(); ctx.moveTo(x,y);
    for(let i=0;i<K.GHOST_STEPS;i++){
      a += c; c *= K.CURVE_DAMP;
      const px=x, py=y;
      x += Math.cos(a)*step; y += Math.sin(a)*step;
      if(walls.length && blocked(px,py,x,y)) break;   // stop at the barrier, do not draw through it
      ctx.lineTo(x,y);
    }
    ctx.stroke();
  }
  ctx.restore();
}
function drawHold(id, p){
  const n=N(id); if(!n) return;
  const ids=subtreeIds(id);
  ctx.save();
  for(const i of ids){
    const m=N(i); if(!m||m.parent===null) continue;
    const q=N(m.parent); if(!q) continue;
    ctx.beginPath(); ctx.moveTo(q.x,q.y); ctx.lineTo(m.x,m.y);
    ctx.lineWidth=Math.max(0.65/view.s, Math.min((q.girth+m.girth)*0.5,13));
    ctx.strokeStyle=`rgba(239,233,220,${(p*0.72).toFixed(3)})`;   // paper, painted over
    ctx.stroke();
  }
  const q=N(n.parent);
  if(q){
    const ux=(n.x-q.x), uy=(n.y-q.y), L=Math.hypot(ux,uy)||1;
    const cx=q.x+ux/L*2, cy=q.y+uy/L*2;
    const R=11/view.s;
    // the gap opening at the cut
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(1.2/view.s, p*6/view.s), 0, 6.2832);
    ctx.fillStyle=PAPER; ctx.fill();
    // a ring that closes as the cut commits — the one place a progress
    // indicator is worth the pixels, because a silent gesture reads as broken
    ctx.beginPath();
    ctx.arc(cx, cy, R, -Math.PI/2, -Math.PI/2 + 6.2832*p);
    ctx.lineWidth=Math.max(1.1/view.s, 1.4);
    ctx.strokeStyle='rgba(31,28,24,0.62)';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, 6.2832);
    ctx.lineWidth=Math.max(0.5/view.s, 0.6);
    ctx.strokeStyle='rgba(31,28,24,0.16)';
    ctx.stroke();
  }
  ctx.restore();
}
/* A trellis is drawn as what it is: two rails and rungs, in ink. */
function drawTrellis(){
  const list = dragTrellis ? trellises.concat([dragTrellis]) : trellises;
  if(!list.length) return;
  ctx.save();
  for(const t of list){
    const dx=t.x1-t.x0, dy=t.y1-t.y0, L=Math.hypot(dx,dy)||1;
    const nx=-dy/L, ny=dx/L, halfW=7;
    const prov = (t===dragTrellis) ? 0.34 : 0.72;
    ctx.lineWidth=Math.max(0.8/view.s, 1.0);
    ctx.strokeStyle=`rgba(31,28,24,${prov})`;
    for(const s2 of [-1,1]){
      ctx.beginPath();
      ctx.moveTo(t.x0+nx*halfW*s2, t.y0+ny*halfW*s2);
      ctx.lineTo(t.x1+nx*halfW*s2, t.y1+ny*halfW*s2);
      ctx.stroke();
    }
    ctx.lineWidth=Math.max(0.6/view.s, 0.8);
    ctx.strokeStyle=`rgba(31,28,24,${prov*0.6})`;
    const rungs=Math.max(2, Math.floor(L/22));
    for(let i=0;i<=rungs;i++){
      const u=i/rungs, px=t.x0+dx*u, py=t.y0+dy*u;
      ctx.beginPath();
      ctx.moveTo(px+nx*halfW, py+ny*halfW);
      ctx.lineTo(px-nx*halfW, py-ny*halfW);
      ctx.stroke();
    }
  }
  ctx.restore();
}
/* Food reads as scattered grain worked into the ground, not a glowing aura. */
function drawFood(){
  if(!foods.length) return;
  ctx.save();
  for(const f of foods){
    const age=(dayT-f.born)/K.FOOD_LIFE; if(age>1) continue;
    const a=(1-age)*0.5;
    const sr=mulberry32(Math.round(f.x*7+f.y*13)+1);
    ctx.fillStyle=`rgba(74,60,42,${a*0.55})`;
    for(let i=0;i<38;i++){
      const th=sr()*6.2832, rr=Math.sqrt(sr())*K.FOOD_R*0.92;
      ctx.beginPath();
      ctx.arc(f.x+Math.cos(th)*rr, f.y+Math.sin(th)*rr, (0.7+sr()*1.1)/Math.max(view.s,0.4), 0, 6.2832);
      ctx.fill();
    }
  }
  ctx.restore();
}
/* Two tools, drawn as the thing they are. Their fill is their stock — the same
   language throughout: no bar, no number, no label on the canvas. */
function drawWells(){
  ctx.setTransform(DPR,0,0,DPR,0,0);            // furniture, not world
  const r=11, gap=34, y=H-26, x0=26;
  const box=(cx,on)=>{
    ctx.beginPath(); ctx.arc(cx,y,r+1,0,6.2832);
    ctx.fillStyle='rgba(239,233,220,0.72)'; ctx.fill();
    ctx.strokeStyle= on ? 'rgba(31,28,24,0.66)' : 'rgba(31,28,24,0.24)';
    ctx.lineWidth = on ? 1.7 : 1; ctx.stroke();
  };
  const tx=x0;
  box(tx, activeTool==='trellis');
  ctx.save();
  ctx.beginPath(); ctx.arc(tx,y,r,0,6.2832); ctx.clip();
  const tFill=trellisStock/K.TRELLIS_STOCK;
  ctx.fillStyle='rgba(31,28,24,0.11)';
  ctx.fillRect(tx-r, y+r-2*r*tFill, 2*r, 2*r*tFill);
  ctx.strokeStyle='rgba(31,28,24,0.66)'; ctx.lineWidth=1.2;
  for(const dx2 of [-4,4]){ ctx.beginPath(); ctx.moveTo(tx+dx2,y-7); ctx.lineTo(tx+dx2,y+7); ctx.stroke(); }
  for(const dy2 of [-4,0,4]){ ctx.beginPath(); ctx.moveTo(tx-4,y+dy2); ctx.lineTo(tx+4,y+dy2); ctx.stroke(); }
  ctx.restore();

  const fx=tx+gap;
  box(fx, activeTool==='food');
  ctx.save();
  ctx.beginPath(); ctx.arc(fx,y,r,0,6.2832); ctx.clip();
  const fFill=foodStock/K.FOOD_STOCK;
  ctx.fillStyle='rgba(74,60,42,0.17)';
  ctx.fillRect(fx-r, y+r-2*r*fFill, 2*r, 2*r*fFill);
  ctx.fillStyle='rgba(74,60,42,0.82)';
  for(const [gx2,gy2] of [[-4,-2.6],[0.5,-4.2],[4,-0.5],[-2,2.4],[2.8,3.8],[-4.4,4]]){
    ctx.beginPath(); ctx.arc(fx+gx2, y+gy2, 1.5, 0, 6.2832); ctx.fill();
  }
  ctx.restore();
}
/* -1 = nothing, otherwise the tool name */
function pickTool(x,y){
  const r=11, gap=34, yy=H-26, x0=26;
  if(Math.hypot(x-x0, y-yy) < r+6) return 'trellis';
  if(Math.hypot(x-(x0+gap), y-yy) < r+6) return 'food';
  return -1;
}

/* ---------- §hit test ----------------------------------------------------- */
function segDist(px,py,ax,ay,bx,by){
  const dx=bx-ax, dy=by-ay, L=dx*dx+dy*dy;
  let t = L>0 ? ((px-ax)*dx+(py-ay)*dy)/L : 0;
  t=Math.max(0,Math.min(1,t));
  return Math.hypot(px-(ax+t*dx), py-(ay+t*dy));
}
function pick(x,y){
  let best=null, bd=1e9;
  // a leaf belongs to its node. Aiming at a leaf and hitting nothing (and so
  // starting a paint stroke instead) is the other half of "cutting fails".
  for(const n of plant.nodes.values()){
    const lf=n.leaf; if(!lf || n.parent===null) continue;
    const q=N(n.parent); if(!q) continue;
    const grow=Math.min(1,(n.age-lf.born)/K.LEAF_GROW); if(grow<0.3) continue;
    const len=K.LEAF_LEN*lf.scale*grow;
    const stem=Math.atan2(n.y-q.y,n.x-q.x), a=stem+lf.side*1.05;
    const lx=n.x+Math.cos(a)*len*0.5, ly=n.y+Math.sin(a)*len*0.5;
    const d=Math.hypot(x-lx,y-ly);
    if(d < len*0.45 && d < bd){ bd=d; best=n.id; }
  }
  bd = best!==null ? bd*0.85 : 1e9;   // stems still win a genuine tie
  for(const n of plant.nodes.values()){
    if(n.parent===null) continue;
    const p=N(n.parent); if(!p) continue;
    const d=segDist(x,y,p.x,p.y,n.x,n.y);
    const tol = Math.max(7/view.s, Math.min(p.girth,11)*0.9);
    if(d<tol && d<bd){ bd=d; best=n.id; }
  }
  return best;
}
/* A rail is pickable the same way wood is, and removed by the same gesture:
   press and hold. Building one was reversible in every way except this. */
function pickRail(x,y){
  let best=-1, bd=1e9;
  const tol = Math.max(11/view.s, 9);
  for(let i=0;i<trellises.length;i++){
    const t=trellises[i];
    const d=segDist(x,y,t.x0,t.y0,t.x1,t.y1);
    if(d<tol && d<bd){ bd=d; best=i; }
  }
  return best;
}
function removeRail(i){
  const t=trellises[i]; if(!t) return;
  const L=Math.hypot(t.x1-t.x0, t.y1-t.y0);
  trellises.splice(i,1);
  trellisStock = Math.min(K.TRELLIS_STOCK, trellisStock + L);   // full refund
  if(AC) chime(PENT[0], 0.020);
  scheduleSave();
  allocate();
}


/* ---------- §loop --------------------------------------------------------- */
function loop(t){
  if(!last) last=t;
  const dt=t-last; last=t;
  const tms = mode==='course' ? K.COURSE_TICK : tickMs;
  if(running && !paused){ acc+=dt; let guard=0; while(acc>=tms && guard++<8){ tick(); acc-=tms; } if(acc>tms*8) acc=0; }
  draw();
}

/* ---------- §input -------------------------------------------------------- */
let downAt=null, moved=0;
/* No modes and no text. A press-and-HOLD on wood cuts it — a single click is
   too easy to do by accident, and a cut is the one irreversible act here.
   A drag on empty paper paints. The wheel zooms. */
cv.addEventListener('pointerdown', e=>{
  initAudio();
  const t=pickTool(e.clientX,e.clientY);
  if(t!==-1){ activeTool = t; return; }   // selecting a tool selects it; it never toggles off
  const [x,y]=screenToWorld(e.clientX,e.clientY);
  downAt={x:e.clientX,y:e.clientY}; moved=0;
  try{ cv.setPointerCapture(e.pointerId); }catch(_){}

  if(e.button===2 || e.button===1){ panning=true; panFrom={x:e.clientX,y:e.clientY,
    px:view.panX, py:view.panY}; return; }

  const hit=pick(x,y);
  if(hit!==null){ holdId=hit; holdT0=performance.now(); holdProg=0; holdStart(); return; }

  const rail=pickRail(x,y);
  if(rail>=0){ holdRailIdx=rail; holdT0=performance.now(); holdProg=0; holdStart(); return; }

  if(activeTool==='trellis'){
    if(trellisStock > 20) dragTrellis={x0:x,y0:y,x1:x,y1:y};
    return;
  }
  if(activeTool==='food'){
    if(foodStock >= K.FOOD_COST){
      foodStock -= K.FOOD_COST;
      foods.push({x, y, born:dayT}); stats.foodTotal++; stats.foodRun++; checkAchievements();
      if(AC) chime(PENT[2], 0.022);
      scheduleSave();
    }
    return;
  }
});
cv.addEventListener('pointermove', e=>{
  const [x,y]=screenToWorld(e.clientX,e.clientY); pointer={x,y};
  if(downAt) moved=Math.max(moved, Math.hypot(e.clientX-downAt.x, e.clientY-downAt.y));

  if(panning && panFrom){
    view.panX = panFrom.px - (e.clientX-panFrom.x)/view.s;
    view.panY = panFrom.py - (e.clientY-panFrom.y)/view.s;
    return;
  }
  if(holdRailIdx!==null){
    const t=trellises[holdRailIdx];
    if(!t){ cancelHold(); return; }
    if(segDist(x,y,t.x0,t.y0,t.x1,t.y1) > K.HOLD_SLIP/view.s) cancelHold();
    return;
  }
  if(holdId!==null){
    // What matters is whether you are still on the BRANCH you are cutting, not
    // how far the pointer has drifted from where it went down. Measuring drift
    // from the press point meant a hand twitch cancelled the cut silently, with
    // no feedback, which is what made the gesture feel broken.
    const hn = N(holdId);
    if(!hn){ cancelHold(); return; }
    const hq = N(hn.parent);
    const d = hq ? segDist(x, y, hq.x, hq.y, hn.x, hn.y) : Math.hypot(x-hn.x, y-hn.y);
    const slip = K.HOLD_SLIP/view.s;                 // screen px -> world px
    if(d <= slip) return;                            // still on it: keep going
    const re = pick(x,y);
    if(re !== null && re !== holdId){                // moved onto other wood
      holdId = re; holdT0 = performance.now(); holdProg = 0;
    } else if(re === null){
      cancelHold();
    }
    return;
  }
  if(dragTrellis){
    // a rail cannot be longer than the stock you hold
    const dx=x-dragTrellis.x0, dy=y-dragTrellis.y0, L=Math.hypot(dx,dy)||1;
    const max=Math.max(0, trellisStock);
    const u=Math.min(1, max/L);
    dragTrellis.x1 = dragTrellis.x0 + dx*u;
    dragTrellis.y1 = dragTrellis.y0 + dy*u;
    const cl = clipTrellis(dragTrellis);
    dragTrellis.x1 = cl.x1; dragTrellis.y1 = cl.y1;
    hover=null; hoverRail=-1; return;
  }

  hover = pick(x,y);
  hoverRail = hover===null ? pickRail(x,y) : -1;
});
function cancelHold(){ holdId=null; holdRailIdx=null; holdProg=0; holdStop(); }
function endPointer(e){
  cancelHold();
  if(dragTrellis){
    const L=Math.hypot(dragTrellis.x1-dragTrellis.x0, dragTrellis.y1-dragTrellis.y0);
    if(L > 26){ trellises.push(clipTrellis(dragTrellis)); stats.railsTotal++; stats.railsRun++; checkAchievements(); trellisStock=Math.max(0, trellisStock-L);
                if(AC) chime(PENT[1], 0.020); scheduleSave(); }
    dragTrellis=null;
  }
  panning=false; panFrom=null; downAt=null;
  if(e){ const [x,y]=screenToWorld(e.clientX,e.clientY); hover=pick(x,y); }
}
cv.addEventListener('pointerup', endPointer);
cv.addEventListener('pointercancel', endPointer);
cv.addEventListener('pointerleave', ()=>{ cancelHold(); dragTrellis=null; hover=null; });
cv.addEventListener('contextmenu', e=>e.preventDefault());
cv.addEventListener('wheel', e=>{
  e.preventDefault();
  const k = e.deltaY < 0 ? K.ZOOM_STEP : 1/K.ZOOM_STEP;
  view.zoom = Math.max(K.ZOOM_MIN, Math.min(K.ZOOM_MAX, view.zoom*k));
}, {passive:false});

/* Advance the held cut. Called from the render loop so it tracks real time
   rather than the sim tick — the tick can be slowed to 600ms in dev. */
function advanceHold(){
  if(holdRailIdx!==null){
    if(!trellises[holdRailIdx]){ cancelHold(); return; }
    holdProg = Math.min(1, (performance.now()-holdT0)/K.HOLD_MS);
    if(holdProg >= 1){ const i=holdRailIdx; cancelHold(); removeRail(i); }
    return;
  }
  if(holdId===null) return;
  if(!N(holdId)){ cancelHold(); return; }        // the branch went away under us
  holdProg = Math.min(1, (performance.now()-holdT0)/K.HOLD_MS);
  if(holdProg >= 1){
    const id=holdId; cancelHold();
    cut(id);
  }
}

/* ---------- §dev (stripped before v1) ------------------------------------- */
const dev=document.getElementById('dev');
addEventListener('keydown', e=>{
  if(e.key==='d'){ dev.classList.toggle('on'); }
  if(e.key==='r'){ reset(seed); }
  if(e.key==='m'){ mode = mode==='course'?'garden':'course'; reset(seed); }
});
document.getElementById('reseed').onclick=()=>{ seed=+document.getElementById('seed').value||1; reset(seed); };
document.getElementById('speed').oninput=e=>{ tickMs=+e.target.value; document.getElementById('speedv').textContent=tickMs+'ms'; };
setInterval(()=>{
  if(!dev.classList.contains('on')) return;
  let s=0; for(const n of plant.nodes.values()) s+=n.vigor;
  document.getElementById('ncount').textContent=plant.nodes.size;
  document.getElementById('vsum').textContent=s.toFixed(6);
  document.getElementById('modev').textContent=mode;
  document.getElementById('dayv').textContent=(dayT/K.DAY_TICKS).toFixed(2);
  document.getElementById('reachv').textContent=reached?'yes':'no';
}, 400);

/* ---------- §score -------------------------------------------------------
   No time limit. The clock only decides how much of the time bonus survives,
   so a slow, careful solve still scores — it just scores less. */
function elapsedSec(){ return runT/ (1000/16.7) / 60 * 1; }   // ticks -> seconds below
function runSeconds(){ return runT * (mode==='course'?K.COURSE_TICK:tickMs) / 1000; }
function parSeconds(){ return levelConfig(level).par; }
function timeBonus(){
  const slack = parSeconds()*2 - runSeconds();
  return Math.max(0, Math.round(slack * K.TIME_RATE));
}
function liveScore(){ return score + (cleared ? 0 : 0); }
function finishRun(){
  if(cleared) return;
  const bonus = timeBonus();
  const flowerPts = flowersPruned*K.PRUNE_FLOWER;
  cleared = true;
  score += K.CLEAR_BASE + bonus;
  stats.scoreTotal += K.CLEAR_BASE + bonus;
  totalCleared++;
  const prev = bestScore[level] || 0;
  const isBest = score > prev;
  if(isBest) bestScore[level] = score;
  checkAchievements('clear');
  saveNow();
  updateHUD();
  showCleared({bonus, flowerPts, isBest, prev});
}
/* Reaching the arch used to change nothing on screen: the run just stopped and
   the player was left holding a finished level with no way forward. */
function showCleared(d){
  const q=id=>document.getElementById(id);
  const set=(id,v)=>{ const e=q(id); if(e) e.textContent=v; };
  set('cl-lv',  'Level '+level+' cleared');
  set('cl-time', fmtTime(runSeconds()) + '  (par ' + fmtTime(parSeconds()) + ')');
  set('cl-base', String(K.CLEAR_BASE));
  set('cl-bonus', String(d.bonus));
  set('cl-flowers', flowersPruned + ' \u00d7 ' + K.PRUNE_FLOWER + ' = ' + d.flowerPts);
  set('cl-total', String(score));
  set('cl-best', d.isBest ? 'New best' : ('Best ' + (d.prev||0)));
  const nx=q('cl-next');
  if(nx){
    const last = level >= K.LEVELS;
    nx.textContent = last ? 'All one hundred cleared' : 'Next level \u2192';
    nx.disabled = last;
  }
  clearPending = true;
  buildShareCard();
  openPanel('clear', true);
}

/* ---------- §share — the win as a herbarium plate ------------------------
   Composed off-screen from the live canvas, so what you share is the vine you
   actually grew. No upload, no network, no account: it is a PNG on your disk.
   Drawn in the same register as the game — paper ground, ink hairline, the
   caption set the way a specimen sheet is labelled. */
let shareURL=null;
function buildShareCard(){
  try{
    // Draw first. The card copies the canvas, and the canvas holds whatever the
    // last frame left there — which is the CURRENT frame during normal play and
    // a stale or blank one any time the sim advanced without a repaint (a
    // capture harness, a background tab, a paused rAF). Caught in the store
    // capture pass: a real win produced a plate of empty paper.
    if(typeof draw==='function') draw();
    const CW=1200, CH=800;
    const card=document.createElement('canvas'); card.width=CW; card.height=CH;
    const g=card.getContext('2d');
    g.fillStyle=PAPER; g.fillRect(0,0,CW,CH);
    // the plate: the play surface, letterboxed into the sheet
    const m=48, pw=CW-m*2, ph=CH-m*2-96;
    const sc=Math.max(pw/cv.width, ph/cv.height);
    const dw=cv.width*sc, dh=cv.height*sc;
    g.save();
    g.beginPath(); g.rect(m,m,pw,ph); g.clip();
    g.drawImage(cv, m+(pw-dw)/2, m+(ph-dh)/2, dw, dh);
    g.restore();
    g.strokeStyle='rgba(31,28,24,0.55)'; g.lineWidth=1.2;
    g.strokeRect(m+0.5, m+0.5, pw-1, ph-1);
    // caption block
    const by=m+ph+40;
    g.fillStyle='rgba(31,28,24,0.90)';
    g.textBaseline='alphabetic';
    g.font='italic 30px Georgia, "Iowan Old Style", serif';
    g.fillText('Ipomoea underglorii', m, by);
    g.font='19px Georgia, "Iowan Old Style", serif';
    g.fillStyle='rgba(31,28,24,0.66)';
    const line = mode==='sandbox'
      ? 'Sandbox · grown by hand'
      : ('Level '+level+'  ·  '+fmtTime(runSeconds())+'  ·  '+score+' points'
         + (flowersPruned ? ('  ·  '+flowersPruned+' flower'+(flowersPruned===1?'':'s')+' pruned') : ''));
    g.fillText(line, m, by+30);
    g.textAlign='right';
    g.fillText('Underglory', CW-m, by+30);
    g.textAlign='left';
    g.beginPath(); g.moveTo(m, by+12.5); g.lineTo(CW-m, by+12.5);
    g.strokeStyle='rgba(31,28,24,0.22)'; g.lineWidth=1; g.stroke();
    shareURL = card.toDataURL('image/png');
    const img=document.getElementById('cl-shot');
    if(img){ img.src=shareURL; img.style.display='block'; }
    return shareURL;
  }catch(err){ shareURL=null; return null; }
}
function saveShareCard(){
  const url = shareURL || buildShareCard();
  if(!url) return false;
  const a=document.createElement('a');
  a.href=url;
  a.download = 'underglory-' + (mode==='sandbox' ? 'sandbox' : ('level-'+level)) + '.png';
  document.body.appendChild(a); a.click(); a.remove();
  return true;
}
/* Clipboard is best-effort: it needs a secure context and a permission the
   extension page has and a file:// page does not. Falling back to the download
   is the honest behaviour, not an error message. */
async function copyShareCard(){
  const url = shareURL || buildShareCard();
  if(!url) return false;
  try{
    const blob = await (await fetch(url)).blob();
    await navigator.clipboard.write([new ClipboardItem({'image/png': blob})]);
    toast('Copied');
    return true;
  }catch(err){ return saveShareCard(); }
}

/* ---------- §achievements — 25, all earnable from play ------------------- */
const ACH = [
  ['first-light',    'First Light',        'Reach the arch on any level.',            s=>s.cleared],
  ['ten-down',       'Ten Down',           'Clear ten levels.',                        s=>s.totalCleared>=10],
  ['quarter',        'Quarter Turn',       'Clear twenty-five levels.',                s=>s.totalCleared>=25],
  ['halfway',        'Halfway Up',         'Clear fifty levels.',                      s=>s.totalCleared>=50],
  ['understory',     'Understory',         'Clear all one hundred levels.',            s=>s.totalCleared>=100],
  ['brisk',          'Brisk',              'Clear a level inside par.',                s=>s.cleared && s.secs<=s.par],
  ['half-par',       'Bolted',             'Clear a level in half par.',               s=>s.cleared && s.secs<=s.par*0.5],
  ['unhurried',      'Unhurried',          'Clear a level after twice par. No rush.',  s=>s.cleared && s.secs>=s.par*2],
  ['first-cut',      'First Cut',          'Prune anything.',                          s=>s.cutsTotal>=1],
  ['thinning',       'Thinning',           'Prune fifty times.',                       s=>s.cutsTotal>=50],
  ['coppice',        'Coppice',            'Prune five hundred times.',                s=>s.cutsTotal>=500],
  ['compost',        'Compost',            'Prune ten flowers.',                       s=>s.flowersTotal>=10],
  ['deadhead',       'Deadheading',        'Prune a hundred flowers.',                 s=>s.flowersTotal>=100],
  ['untouched',      'Left Alone',         'Clear a level without pruning once.',      s=>s.cleared && s.cutsRun===0],
  ['scorched',       'Hard Prune',         'Prune ten times in one level.',            s=>s.cutsRun>=10],
  ['first-rail',     'First Rail',         'Build a trellis.',                         s=>s.railsTotal>=1],
  ['scaffold',       'Scaffolding',        'Build fifty trellises.',                   s=>s.railsTotal>=50],
  ['bare-hands',     'Bare Hands',         'Clear a level without building a rail.',   s=>s.cleared && s.railsRun===0],
  ['well-fed',       'Well Fed',           'Use plant food twenty times.',             s=>s.foodTotal>=20],
  ['frugal',         'Frugal',             'Clear a level using neither food nor rail.',s=>s.cleared && s.railsRun===0 && s.foodRun===0],
  ['eight',          'Full House',         'Have eight vines growing at once.',        s=>s.maxVines>=8],
  ['lone',           'Single Runner',      'Clear a level that never had more than two vines.', s=>s.cleared && s.maxVinesRun<=2],
  ['night-shift',    'Night Shift',        'Reach the arch after dark.',               s=>s.cleared && s.night],
  ['bloomer',        'In Bloom',           'Have ten corollas open at once.',          s=>s.maxOpen>=10],
  ['ten-thousand',   'Ten Thousand',       'Bank ten thousand points.',                s=>s.scoreTotal>=10000],
];
let stats={cutsTotal:0, cutsRun:0, flowersTotal:0, railsTotal:0, railsRun:0,
           foodTotal:0, foodRun:0, maxVines:0, maxVinesRun:0, maxOpen:0, scoreTotal:0};
let newlyUnlocked=[];
function achState(){
  return { cleared, totalCleared, secs:runSeconds(), par:parSeconds(),
           night: typeof isNight==='function' && isNight(), ...stats };
}
function checkAchievements(){
  const st=achState();
  for(const [id,name,,test] of ACH){
    if(unlocked[id]) continue;
    let ok=false; try{ ok=!!test(st); }catch(_){}
    if(ok){ unlocked[id]=Date.now?0:0; unlocked[id]=1; newlyUnlocked.push([id,name]); toast(name); }
  }
}
function toast(name){
  const el=document.getElementById('toast'); if(!el) return;
  el.textContent='Unlocked — '+name;
  el.classList.add('on');
  setTimeout(()=>el.classList.remove('on'), 3200);
}

/* ---------- §shell — settings, pause, tutorial ---------------------------
   The one place text is allowed. The canvas stays wordless — the register was
   never about hiding how the game works, it was about keeping labels off the
   picture. Icons with no explanation anywhere is not minimalism, it is a
   guessing game, and it was the right call to flag it. */
let paused=false, hudFrame=0;
function fmtTime(sec){
  const m=Math.floor(sec/60), r=Math.floor(sec%60);
  return m+':'+String(r).padStart(2,'0');
}
function updateHUD(){
  const q=id=>document.getElementById(id);
  const lv=q('hud-lv'), tm=q('hud-time'), sc=q('hud-score'), vn=q('hud-vines');
  const sand = mode==='sandbox';
  const w=q('hud'); if(w) w.classList.toggle('sandbox', sand);
  if(lv) lv.textContent = sand ? 'Sandbox' : ('Level '+level);
  if(tm) tm.textContent = sand ? '' : fmtTime(runSeconds());
  if(sc) sc.textContent = sand ? '' : String(score);
  if(vn){
    let live=0; if(plant) for(const n of plant.nodes.values()) if(isApex(n)) live++;
    vn.textContent = live+'/'+vineCap();
  }
  if(w) w.classList.toggle('cleared', cleared);
}
/* Motion: full / reduced / none. `none` also freezes the sky so nothing on the
   page moves except the vine itself, which is the whole point of the setting. */
function setMotion(m){
  motion=m;
  document.body && document.body.setAttribute('data-motion', m);
  saveNow();
}
function viewEase(){ return motion==='none' ? 1 : (motion==='reduced' ? 0.06 : K.VIEW_EASE); }
function skyMoves(){ return motion==='full'; }
function startLevel(lv){
  level = Math.max(1, Math.min(K.LEVELS, lv|0));
  runT=0; score=0; flowersPruned=0; cleared=false;
  stats.cutsRun=0; stats.railsRun=0; stats.foodRun=0; stats.maxVinesRun=0;
  mode='course';
  reset(1000+level*7919);          // one fixed layout per level, always
  activeTool='trellis';            // the tool you need first is the one in hand
  stallT=0; stallBest=Infinity; rescues=0; stallRuns=0;
  clearPending=false;
  setPanel('clear', false);
  setPaused(false);
  updateHUD();
  saveNow();
}
/* Sandbox: your own vine, no arch, no clock, nothing to win. The same tools and
   the same eight-vine ceiling — just no course around it. */
function startSandbox(seedv){
  mode='sandbox';
  runT=0; score=0; flowersPruned=0; cleared=false;
  stats.cutsRun=0; stats.railsRun=0; stats.foodRun=0; stats.maxVinesRun=0;
  reset(seedv===undefined ? Math.floor(rndSeedFromClock()) : seedv);
  activeTool='trellis';
  stallT=0; stallBest=Infinity; rescues=0; stallRuns=0;
  clearPending=false;
  setPanel('clear', false);
  setPaused(false);
  updateHUD();
  saveNow();
}
/* dayT is a sim clock, not a wall clock — deterministic, and no Date needed. */
function rndSeedFromClock(){ return 1 + ((dayT*2654435761) % 99991); }
function toggleFullscreen(){
  const el=document.documentElement;
  if(!document.fullscreenElement){ el.requestFullscreen && el.requestFullscreen().catch(()=>{}); }
  else { document.exitFullscreen && document.exitFullscreen(); }
}
function setPaused(v){
  paused=v;
  const b=document.getElementById('pausebtn');
  if(b){ b.setAttribute('aria-pressed', String(v)); b.textContent = v ? 'Resume' : 'Pause'; }
  if(AC && master) master.gain.setTargetAtTime(v ? 0 : (muted?0:K.VOL*vol), AC.currentTime, 0.25);
}
let vol=1, muted=false;
function setVol(v){
  vol=v;
  if(AC && master) master.gain.setTargetAtTime((paused||muted)?0:K.VOL*vol, AC.currentTime, 0.2);
}
const PANELS=['settings','tutorial','levels','achievements','clear'];
/* The clear panel is modal in the real sense: while it is up the run is over,
   and dismissing it left the vine growing on a finished course. It has no close
   control, Escape does not touch it, and anything opened on top of it (the
   level grid) hands it back when that closes. Only Next / Replay / a chosen
   level clears the flag. */
let clearPending=false;
/* One panel at a time, and Escape closes whichever is up. The first version
   only knew about two of the four, so opening the achievements list on top of
   settings left both mounted and the buttons underneath unclickable. */
function openPanel(id, on){
  if(on) for(const p of PANELS) if(p!==id) setPanel(p,false);
  setPanel(id,on);
  if(on) setPaused(true);
}
function setPanel(id,on){
  const el=document.getElementById(id);
  if(!el) return;
  el.classList.toggle('on', on);
  el.setAttribute('aria-hidden', String(!on));
}
function anyPanelOpen(){
  return PANELS.some(p=>{ const e=document.getElementById(p); return e && e.classList.contains('on'); });
}
function closeAllPanels(){
  for(const p of PANELS){ if(p==='clear' && clearPending) continue; setPanel(p,false); }
  if(clearPending){ setPanel('clear', true); setPaused(true); }
  else setPaused(false);
}
function initShell(){
  const q=id=>document.getElementById(id);
  const gear=q('gear'), help=q('helpbtn');
  if(gear) gear.addEventListener('click', ()=>openPanel('settings', !q('settings').classList.contains('on')));
  if(help) help.addEventListener('click', ()=>openPanel('tutorial', true));
  const pb=q('pausebtn'); if(pb) pb.addEventListener('click', ()=>setPaused(!paused));
  const vs=q('vol'); if(vs) vs.addEventListener('input', e=>setVol(+e.target.value/100));
  const mu=q('mute'); if(mu) mu.addEventListener('click', ()=>{
    muted=!muted; mu.setAttribute('aria-pressed', String(muted));
    mu.textContent = muted ? 'Unmute' : 'Mute'; setVol(vol); });
  const rs=q('restart'); if(rs) rs.addEventListener('click', ()=>{
    startLevel(level); openPanel('settings', false); });
  const fs=q('fullscreen'); if(fs) fs.addEventListener('click', toggleFullscreen);
  for(const b of document.querySelectorAll('[data-motion-set]'))
    b.addEventListener('click', ()=>{
      setMotion(b.getAttribute('data-motion-set'));
      for(const o of document.querySelectorAll('[data-motion-set]'))
        o.setAttribute('aria-pressed', String(o===b));
    });
  const nx=q('nextlv'); if(nx) nx.addEventListener('click', ()=>{
    startLevel(level+1); setPanel('levels', false); });
  const cn=q('cl-next'); if(cn) cn.addEventListener('click', ()=>{
    clearPending=false; setPanel('clear', false); startLevel(level+1); });
  const cr=q('cl-replay'); if(cr) cr.addEventListener('click', ()=>{
    clearPending=false; setPanel('clear', false); startLevel(level); });
  const cs=q('cl-save'); if(cs) cs.addEventListener('click', ()=>{ saveShareCard(); });
  const cc=q('cl-copy'); if(cc) cc.addEventListener('click', ()=>{ copyShareCard(); });
  // No-penalty skip. There is no failure state in this game, so being stuck
  // must not be a dead end either — the level is simply left behind, and the
  // grid still shows it unfinished.
  const sk=q('skiplv'); if(sk) sk.addEventListener('click', ()=>{
    startLevel(level+1); openPanel('settings', false); });
  const cl=q('cl-levels'); if(cl) cl.addEventListener('click', ()=>{
    buildLevelGrid(); openPanel('levels', true); });
  const lvbtn=q('lvbtn'); if(lvbtn) lvbtn.addEventListener('click', ()=>{ buildLevelGrid(); openPanel('levels', true); });
  const sb=q('sandbox'); if(sb) sb.addEventListener('click', ()=>{
    startSandbox(); closeAllPanels(); });
  const sb2=q('lv-sandbox'); if(sb2) sb2.addEventListener('click', ()=>{
    startSandbox(); closeAllPanels(); });
  const abtn=q('achbtn'); if(abtn) abtn.addEventListener('click', ()=>{ buildAchList(); openPanel('achievements', true); });
  // the OS preference wins on first run
  try{ if(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) setMotion('reduced'); }catch(_){}
  for(const b of document.querySelectorAll('[data-close]'))
    b.addEventListener('click', ()=>{ setPanel(b.getAttribute('data-close'), false);
      if(clearPending){ setPanel('clear', true); setPaused(true); }
      else if(!anyPanelOpen()) setPaused(false); });
  addEventListener('keydown', e=>{
    if(e.key==='Escape'){ closeAllPanels(); }
    if(e.key===' '){ e.preventDefault(); setPaused(!paused); }
  });
  // first run gets the tutorial, once
  if(HAS_STORE){
    chrome.storage.local.get('underglory.seen').then(g=>{
      if(!g || !g['underglory.seen']){
        openPanel('tutorial', true);
        chrome.storage.local.set({'underglory.seen': true});
      }
    }).catch(()=>{});
  } else if(!localStorageSeen()) openPanel('tutorial', true);
}
function localStorageSeen(){ return false; }   // standalone always shows it
/* A hundred buttons. Locked levels are the ones more than five past your best,
   so the grid is a ladder rather than a wall of grey. */
function highestUnlocked(){ return Math.min(K.LEVELS, totalCleared + 5); }
function buildLevelGrid(){
  const g=document.getElementById('lvgrid'); if(!g) return;
  g.innerHTML='';
  const top=highestUnlocked();
  for(let i=1;i<=K.LEVELS;i++){
    const b=document.createElement('button');
    b.className='lv'+(i>top?' locked':'')+(bestScore[i]?' done':'')+(i===level?' cur':'');
    b.textContent=String(i);
    b.title = i>top ? 'Locked' : (bestScore[i] ? 'Best '+bestScore[i] : 'Level '+i);
    if(i<=top) b.addEventListener('click', ()=>{ startLevel(i); openPanel('levels', false); });
    else b.disabled=true;
    g.appendChild(b);
  }
}
function buildAchList(){
  const g=document.getElementById('achlist'); if(!g) return;
  g.innerHTML='';
  for(const [id,name,desc] of ACH){
    const li=document.createElement('li');
    li.className = unlocked[id] ? 'ach got' : 'ach';
    const b=document.createElement('b'); b.textContent=name;
    const s2=document.createElement('span'); s2.textContent=' — '+desc;
    li.appendChild(b); li.appendChild(s2);
    g.appendChild(li);
  }
  const c=document.getElementById('achcount');
  if(c) c.textContent = Object.keys(unlocked).length+' of '+ACH.length;
}

/* ---------- §persist — chrome.storage.local only, no backend -------------- */
/* State is packed into typed arrays and base64'd. A plant is ~1600 nodes; as
   naive JSON that is megabytes, and chrome.storage.local's default quota is
   10MB for the whole extension. */
// One slot per mode. A single shared slot let the course's saved state restore
// into the popup and silently switch the garden into course mode, walls and
// all — the surfaces are different things and do not share a save.
const SAVE_KEY=()=>'underglory.v2.'+mode;   // sandbox and course never share a slot
const HAS_STORE = typeof chrome!=='undefined' && chrome.storage && chrome.storage.local;
let saveBusy=false, saveAgain=false, saveTimer=null, lastSaveError=null;
let savePending=null, savePendingResolve=null;

function b64(bytes){ let s=''; const C=0x8000;
  for(let i=0;i<bytes.length;i+=C) s+=String.fromCharCode.apply(null, bytes.subarray(i,i+C));
  return btoa(s); }
function unb64(str){ const bin=atob(str), out=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) out[i]=bin.charCodeAt(i); return out; }

function snapshot(){
  const ids=[...plant.nodes.keys()];
  const idx=new Map(ids.map((id,i)=>[id,i]));
  const n=ids.length;
  const f32=new Float32Array(n*6), i32=new Int32Array(n*2), u8=new Uint8Array(n*3);
  ids.forEach((id,i)=>{
    const m=plant.nodes.get(id);
    f32[i*6]=m.x; f32[i*6+1]=m.y; f32[i*6+2]=m.angle; f32[i*6+3]=m.set;
    f32[i*6+4]=m.axisLen; f32[i*6+5]=m.girth;
    i32[i*2]=m.parent===null?-1:(idx.has(m.parent)?idx.get(m.parent):-1);
    i32[i*2+1]=m.age;
    u8[i*3]=(m.dormant?1:0)|(m.spent?2:0)|(m.cutTip?4:0)|(m.leaf?8:0)|(m.flower?16:0);
    u8[i*3+1]=Math.min(255, Math.round(m.sat*255));
    u8[i*3+2]=Math.min(255, Math.round(((m.hue%6.2832)+6.2832)%6.2832/6.2832*255));
  });
  return { v:1, mode, seed, dayT, reached, walls, goal, trellises, foods,
    trellisStock:+trellisStock.toFixed(1), foodStock:+foodStock.toFixed(3),
    seasonHue:+seasonHue.toFixed(4), seasonT,
    level, runT, score, flowersPruned, cleared, motion,
    bestScore, unlocked, totalCleared, stats,
    n, f32:b64(new Uint8Array(f32.buffer)), i32:b64(new Uint8Array(i32.buffer)),
    u8:b64(u8), fn:field.n };
}
/* Busy flag before the await, cleared in finally; a second save while one is in
   flight collapses into one trailing save rather than racing it. */
async function saveNow(){
  if(!HAS_STORE || !plant) return;
  if(saveBusy){
    // Collapse into one trailing save, but hand the caller a promise that
    // actually resolves when THAT write lands. Returning early here meant an
    // awaited saveNow() could return before anything had been written.
    saveAgain=true;
    if(!savePending) savePending = new Promise(r => { savePendingResolve = r; });
    return savePending;
  }
  saveBusy=true;
  try { await chrome.storage.local.set({ [SAVE_KEY()]: snapshot() }); }
  catch(e){ lastSaveError = String(e && e.message || e); }
  finally {
    saveBusy=false;
    if(saveAgain){
      saveAgain=false;
      const r=savePendingResolve; savePending=null; savePendingResolve=null;
      await saveNow();
      if(r) r();
    } else if(savePendingResolve){
      const r=savePendingResolve; savePending=null; savePendingResolve=null; r();
    }
  }
}
function scheduleSave(){
  if(!HAS_STORE) return;
  if(saveTimer) return;
  saveTimer=setTimeout(()=>{ saveTimer=null; saveNow(); }, 4000);
}
function restore(snap){
  if(!snap || snap.v!==1) return false;
  if(snap.mode !== mode) return false;   // never let a save change the surface
  seed=snap.seed; rnd=mulberry32(seed);
  dayT=snap.dayT||0; reached=snap.reached||0;
  walls=snap.walls||[]; goal=snap.goal||null;
  trellises=snap.trellises||[]; foods=snap.foods||[];
  trellisStock=snap.trellisStock!=null?snap.trellisStock:K.TRELLIS_STOCK;
  foodStock=snap.foodStock!=null?snap.foodStock:K.FOOD_STOCK;
  field=makeField(snap.fn||K.FIELD_N);   // occupancy is rebuilt from the nodes below
  seasonHue=snap.seasonHue!=null?snap.seasonHue:0.6; seasonT=snap.seasonT||0;
  level=snap.level||1; runT=snap.runT||0; score=snap.score||0;
  flowersPruned=snap.flowersPruned||0; cleared=!!snap.cleared;
  bestScore=snap.bestScore||{}; unlocked=snap.unlocked||{}; totalCleared=snap.totalCleared||0;
  if(snap.stats) stats=Object.assign(stats, snap.stats);
  if(snap.motion) setMotion(snap.motion);
  const f32=new Float32Array(unb64(snap.f32).buffer);
  const i32=new Int32Array(unb64(snap.i32).buffer);
  const u8=unb64(snap.u8);
  const nodes=new Map(); const list=[];
  NEXT_ID=1;
  for(let i=0;i<snap.n;i++){
    const m=makeNode(null, f32[i*6], f32[i*6+1], f32[i*6+2], false);
    m.set=f32[i*6+3]; m.axisLen=f32[i*6+4]; m.girth=f32[i*6+5];
    m.age=i32[i*2+1];
    const fl=u8[i*3];
    m.dormant=!!(fl&1); m.spent=!!(fl&2); m.cutTip=!!(fl&4);
    if(fl&8) m.leaf={side:(i%2?1:-1), born:0, scale:1};
    m.sat=u8[i*3+1]/255; m.hue=u8[i*3+2]/255*6.2832;
    m.px=m.x; m.py=m.y;
    nodes.set(m.id,m); list.push(m);
  }
  for(let i=0;i<snap.n;i++){
    const pi=i32[i*2];
    if(pi>=0 && list[pi]){ list[i].parent=list[pi].id; list[pi].children.push(list[i].id); }
    else list[i].parent=null;
  }
  plant={nodes, rootId:list.length?list[0].id:null};
  for(const m of nodes.values()) occAdd(m.x, m.y, 1);   // occupancy is derived, not stored
  if(!plant.rootId){ plant=makePlant(); }
  allocate();
  view.ready=false;
  return true;
}
async function boot(){
  if(HAS_STORE){
    try {
      const k=SAVE_KEY();
      const got = await chrome.storage.local.get(k);
      if(got && got[k] && restore(got[k])) return;
    } catch(_){}
  }
  reset(seed);
}
if(typeof document!=='undefined'){
  document.addEventListener('visibilitychange', ()=>{ if(document.hidden) saveNow(); });
  window.addEventListener('pagehide', ()=>{ saveNow(); });
}

/* ---------- §boot --------------------------------------------------------- */
function resize(){
  DPR=Math.min(2, window.devicePixelRatio||1);
  W=cv.clientWidth; H=cv.clientHeight;
  cv.width=Math.round(W*DPR); cv.height=Math.round(H*DPR);
}
function reset(s){ view.ready=false;
  seed=s; rnd=mulberry32(seed);
  dayT=0; reached=0;
  resize();
  field=makeField(K.FIELD_N);
  seasonHue=0.6+rnd()*6.2832; seasonT=0;
  trellises=[]; foods=[]; dragTrellis=null;
  trellisStock=K.TRELLIS_STOCK; foodStock=K.FOOD_STOCK; activeTool='trellis';
  buildCourse();
  plant=makePlant(); allocate();
  acc=0; last=0; hover=null; hoverRail=-1;
  // stall state is per-run. Left standing between resets, a run inherits the
  // previous one's best distance and the rescue fires on a different tick —
  // which is exactly how the determinism check caught it.
  stallT=0; stallBest=Infinity; rescues=0; stallRuns=0;
}
addEventListener('resize', ()=>{ const c=W,h=H; resize(); if(plant && (c!==W||h!==H)){} });
document.getElementById('speedv').textContent=tickMs+'ms';
// Start valid immediately, then let a saved game replace it if there is one.
// Calling reset() AFTER boot() clobbered every restore — the async restore
// landed first and the synchronous reset threw it away.
reset(seed);
boot();
initShell();
updateHUD();
requestAnimationFrame(loop);

/* ---------- §probes (dev-only; stripped before v1) ------------------------ */
window.__peek = () => plant;
window.__world = () => ({mode, walls, goal, dayT, reached,
  flowers:[...plant.nodes.values()].filter(n=>n.flower).length,
  leaves:[...plant.nodes.values()].filter(n=>n.leaf).length});
window.__setMode = m => { mode=m; reset(seed); };
window.__cut = id => cut(id);
window.__ff = n => { for(let i=0;i<n;i++) tick(); };

window.__saveError = () => lastSaveError;
window.__hold = () => ({holdId, holdRailIdx, holdProg:+holdProg.toFixed(2),
  rails:trellises.length, stock:+trellisStock.toFixed(1)});
/* Measure the REAL signal on master, not the graph's shape. "Is it connected"
   and "can you hear it" are different questions and only one of them matters. */
window.__audioRMS = (ms) => new Promise(res => {
  if(!AC || !master) return res({error:'no audio'});
  const an = AC.createAnalyser(); an.fftSize = 2048;
  master.connect(an);
  const buf = new Float32Array(an.fftSize);
  let peak = 0, sum = 0, n = 0;
  const t0 = performance.now();
  const step = () => {
    an.getFloatTimeDomainData(buf);
    for (let i=0;i<buf.length;i++){ const v=Math.abs(buf[i]); if(v>peak) peak=v; sum+=buf[i]*buf[i]; n++; }
    if (performance.now()-t0 < (ms||3000)) requestAnimationFrame(step);
    else { try{ master.disconnect(an); }catch(_){}
      const rms = Math.sqrt(sum/Math.max(1,n));
      res({ rms:+rms.toFixed(5), peak:+peak.toFixed(4),
            dbfs:+(20*Math.log10(Math.max(rms,1e-9))).toFixed(1) }); }
  };
  requestAnimationFrame(step);
});
/* Spectral balance, not just level. "Fuzzy or static" is a SHAPE complaint and a
   dBFS number cannot see it: the mix measured -27 dBFS both before and after the
   noise bus. What changed is where the energy is. Bands are in Hz. */
window.__audioBands = (ms) => new Promise(res => {
  if(!AC || !master) return res({error:'no audio'});
  const an = AC.createAnalyser(); an.fftSize = 4096; an.smoothingTimeConstant = 0;
  master.connect(an);
  const buf = new Float32Array(an.frequencyBinCount);
  const hz = AC.sampleRate / an.fftSize;
  const EDGES = [0, 250, 1000, 2500, 5000, 24000];
  const acc = new Array(EDGES.length-1).fill(0);
  let frames = 0;
  const t0 = performance.now();
  const step = () => {
    an.getFloatFrequencyData(buf);                    // dB per bin
    for(let i=1;i<buf.length;i++){
      const f = i*hz, lin = Math.pow(10, buf[i]/10);  // dB -> power
      for(let b=0;b<acc.length;b++) if(f>=EDGES[b] && f<EDGES[b+1]){ acc[b]+=lin; break; }
    }
    frames++;
    if(performance.now()-t0 < (ms||4000)) requestAnimationFrame(step);
    else {
      try{ master.disconnect(an); }catch(_){}
      const tot = acc.reduce((a,b)=>a+b,0) || 1;
      res({ frames,
        sub:   +(acc[0]/tot).toFixed(4),   // <250   body
        low:   +(acc[1]/tot).toFixed(4),   // 250-1k pad + bells
        mid:   +(acc[2]/tot).toFixed(4),   // 1k-2.5k
        high:  +(acc[3]/tot).toFixed(4),   // 2.5k-5k
        top:   +(acc[4]/tot).toFixed(4),   // >5k    pure fizz
        fuzz:  +((acc[3]+acc[4])/tot).toFixed(4) });
    }
  };
  requestAnimationFrame(step);
});
window.__audioState = () => AC ? {state:AC.state, sampleRate:AC.sampleRate,
  masterGain:+master.gain.value.toFixed(3), bed:bed?bed.length:0,
  pad:!!pad, chord:chordIx, padGain:pad?+pad.out.gain.value.toFixed(4):0,
  rain:!!rain, raining:rain?rain.on:false, timers:audioTimers.length}
  : {state:'uninitialised'};

/* ---------- §harness export (Node only; inert in the browser) ------------- */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {mulberry32, K, makeField};
}
