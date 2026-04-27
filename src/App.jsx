import React,{useCallback,useEffect,useRef,useState}from'react';

// ─────────────────────────────────────────────────────────────────────────────
// CESIRA V2 — Autonomous Electronic Music Workstation
// Full-screen, self-composing, live-performable, export-ready
// ─────────────────────────────────────────────────────────────────────────────

const MAX_STEPS=64,PAGE=16,SCHED=0.14,LOOK=20,UNDO=32,REDO=32;
const SESSION_STORAGE_KEY='cesira-session-v9';
const SESSION_PAYLOAD_VERSION=10;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const rnd=()=>Math.random();
const pick=a=>a[Math.floor(rnd()*a.length)];
const lerp=(a,b,t)=>a+(b-a)*t;

const SOUND_CHARACTERS={
  warm:{toneBias:0.12,spaceBias:0.08,driveBias:-0.03,noiseBias:-0.02,bassFilterBias:-0.04,synthFilterBias:-0.02,accentBias:0.02,motionBias:0.06,humanizeBias:0.05},
  dark:{toneBias:-0.16,spaceBias:0.02,driveBias:0.05,noiseBias:0.04,bassFilterBias:-0.08,synthFilterBias:-0.1,accentBias:0.03,motionBias:0.04,humanizeBias:0.02},
  bright:{toneBias:0.16,spaceBias:0.0,driveBias:-0.01,noiseBias:0.03,bassFilterBias:0.04,synthFilterBias:0.12,accentBias:0.01,motionBias:0.08,humanizeBias:0.04},
  dirty:{toneBias:-0.08,spaceBias:-0.02,driveBias:0.12,noiseBias:0.08,bassFilterBias:-0.02,synthFilterBias:-0.06,accentBias:0.05,motionBias:0.1,humanizeBias:0.06},
  tight:{toneBias:0.02,spaceBias:-0.04,driveBias:0.02,noiseBias:-0.01,bassFilterBias:0.06,synthFilterBias:0.04,accentBias:0.06,motionBias:-0.02,humanizeBias:-0.02},
};
const CHARACTER_BY_GENRE={techno:'tight',house:'warm',ambient:'bright',dnb:'dirty',acid:'dirty',industrial:'dark',experimental:'bright',cinematic:'warm'};
const getGenreSoundCharacter=genre=>CHARACTER_BY_GENRE[genre]||pick(Object.keys(SOUND_CHARACTERS));

const GENRE_FAMILY_PROFILES={
  techno:{drive:0.08,tone:-0.04,space:-0.03,motion:0.05,accent:0.05,hookBias:0.72,fillBias:'impact',bassRole:'pulse',synthRole:'stab'},
  house:{drive:-0.01,tone:0.08,space:0.06,motion:0.03,accent:0.02,hookBias:0.64,fillBias:'lift',bassRole:'round',synthRole:'chord'},
  ambient:{drive:-0.06,tone:0.12,space:0.14,motion:0.02,accent:-0.02,hookBias:0.4,fillBias:'air',bassRole:'drone',synthRole:'wash'},
  dnb:{drive:0.1,tone:0.0,space:-0.02,motion:0.08,accent:0.06,hookBias:0.78,fillBias:'break',bassRole:'pressure',synthRole:'stab'},
  acid:{drive:0.14,tone:-0.03,space:-0.02,motion:0.1,accent:0.05,hookBias:0.82,fillBias:'squelch',bassRole:'lead',synthRole:'answer'},
  industrial:{drive:0.18,tone:-0.08,space:-0.05,motion:0.07,accent:0.08,hookBias:0.58,fillBias:'impact',bassRole:'weight',synthRole:'shard'},
  experimental:{drive:0.05,tone:0.03,space:0.07,motion:0.14,accent:0.03,hookBias:0.52,fillBias:'glitch',bassRole:'shape',synthRole:'gesture'},
  cinematic:{drive:-0.03,tone:0.1,space:0.12,motion:0.04,accent:0.01,hookBias:0.56,fillBias:'swell',bassRole:'pedal',synthRole:'theme'},
};
const getGenreFamilyProfile=genre=>GENRE_FAMILY_PROFILES[genre]||GENRE_FAMILY_PROFILES.techno;


const GENRE_NARRATIVE_PROFILES={
  techno:{restBias:0.08,answerShift:-1,climbLift:1,chordPalette:['open','sus2','quartal'],cadenceBias:0.72,registerLift:0,polyDepth:3,ornamentBias:0.18},
  house:{restBias:0.12,answerShift:1,chordPalette:['seventh','add9','open'],cadenceBias:0.66,registerLift:1,polyDepth:4,ornamentBias:0.14},
  ambient:{restBias:0.32,answerShift:0,chordPalette:['open','add9','quartal'],cadenceBias:0.48,registerLift:2,polyDepth:4,ornamentBias:0.08},
  dnb:{restBias:0.1,answerShift:-2,chordPalette:['sus2','triad','cluster'],cadenceBias:0.74,registerLift:1,polyDepth:3,ornamentBias:0.24},
  acid:{restBias:0.1,answerShift:1,chordPalette:['sus2','cluster','triad'],cadenceBias:0.58,registerLift:1,polyDepth:3,ornamentBias:0.3},
  industrial:{restBias:0.14,answerShift:-1,chordPalette:['quartal','cluster','open'],cadenceBias:0.62,registerLift:0,polyDepth:3,ornamentBias:0.22},
  experimental:{restBias:0.22,answerShift:2,chordPalette:['quartal','add9','cluster'],cadenceBias:0.52,registerLift:1,polyDepth:4,ornamentBias:0.34},
  cinematic:{restBias:0.18,answerShift:1,chordPalette:['add9','seventh','open'],cadenceBias:0.84,registerLift:2,polyDepth:4,ornamentBias:0.12},
};
const getGenreNarrativeProfile=genre=>GENRE_NARRATIVE_PROFILES[genre]||GENRE_NARRATIVE_PROFILES.techno;

const THEME_CELLS={
  bass:[
    [0,0,2,null,4,2,0,-1],
    [0,null,0,2,3,2,0,null],
    [0,0,4,2,0,null,2,-1],
    [0,2,0,null,5,4,2,0],
  ],
  synth:[
    [0,2,4,2,5,4,2,0],
    [0,4,2,5,4,2,1,0],
    [0,2,5,4,2,4,7,5],
    [0,3,5,3,6,5,3,1],
  ],
};
const RESPONSE_CELLS={
  bass:[
    [0,null,2,0,3,2,0,-2],
    [0,2,0,null,2,0,-1,null],
    [0,null,4,2,0,null,2,0],
  ],
  synth:[
    [2,4,5,4,2,1,0,0],
    [4,2,5,4,2,0,1,0],
    [5,7,5,4,2,1,0,0],
  ],
};


function rotateCell(cell, amount=0){
  if(!Array.isArray(cell)||!cell.length)return [];
  const len=cell.length;
  const shift=((amount%len)+len)%len;
  return cell.map((_,idx)=>cell[(idx-shift+len)%len]);
}

function shiftCell(cell, delta=0){
  return (cell||[]).map(v=>v===null?v:(typeof v==='number'?v+delta:v));
}

function invertCell(cell, pivot=0){
  return (cell||[]).map(v=>v===null?v:(typeof v==='number'?pivot-(v-pivot):v));
}

function fragmentCell(cell, length=4){
  if(!Array.isArray(cell)||!cell.length)return [];
  const frag=cell.slice(0,Math.max(2,length));
  return [...frag,...frag].slice(0,cell.length);
}

function elongateCell(cell){
  if(!Array.isArray(cell)||!cell.length)return [];
  const out=[];
  for(const value of cell){
    out.push(value);
    if(out.length<cell.length)out.push(value===null?null:value);
  }
  return out.slice(0,cell.length);
}

function buildMotifFamilies(seed, responseSeed, genre='techno'){
  const base=(seed&&seed.length?seed:THEME_CELLS.synth[0]).slice(0,8);
  const answer=(responseSeed&&responseSeed.length?responseSeed:rotateCell(base,1)).slice(0,8);
  const pivot=typeof base.find(v=>typeof v==='number')==='number'?base.find(v=>typeof v==='number'):0;
  const climb=shiftCell(base, genre==='dnb'||genre==='acid'?2:1).slice(0,8);
  const climax=rotateCell(shiftCell(base,1),2).map((v,idx)=>v===null && idx%2===0?0:v).slice(0,8);
  const cadence=fragmentCell(answer,4).map((v,idx,arr)=>idx>=arr.length-2?(v===null?0:v-1):v).slice(0,8);
  const release=elongateCell(invertCell(base,pivot)).map((v,idx)=>idx%3===2?null:v).slice(0,8);
  return {statement:base,answer,climb,climax,cadence,release};
}

function createSectionPlans(genre){
  const baseThemes=GENRE_THEME_BANK[genre]||THEME_CELLS;
  const responses=GENRE_RESPONSE_BANK[genre]||RESPONSE_CELLS;
  const bassFamilies=buildMotifFamilies(pick(baseThemes.bass),pick(responses.bass),genre);
  const synthFamilies=buildMotifFamilies(pick(baseThemes.synth),pick(responses.synth),genre);
  const sectionRoles={
    intro:['statement','answer','statement','release'],
    build:['statement','climb','answer','climb'],
    drop:['statement','answer','climax','cadence'],
    groove:['statement','answer','statement','cadence'],
    break:['release','answer','release','cadence'],
    tension:['climb','answer','climb','climax'],
    fill:['climax','cadence'],
    outro:['statement','release','cadence','release'],
  };
  const progressionKinds={
    intro:'pedal',build:'rising',drop:'full',groove:'groove',break:'pedal',tension:'dominant',fill:'turnaround',outro:'falling'
  };
  const chordStyles={
    intro:'open',build:'sus2',drop:'open',groove:'seventh',break:'quartal',tension:'cluster',fill:'triad',outro:'add9'
  };
  const densityLift={intro:0.86,build:1.02,drop:1.12,groove:1.0,break:0.72,tension:1.06,fill:1.18,outro:0.78};
  return Object.fromEntries(Object.keys(SECTIONS).map(section=>[section,{
    phraseRoles:sectionRoles[section]||['statement','answer','cadence','release'],
    progressionKind:progressionKinds[section]||'full',
    chordStyle:chordStyles[section]||'triad',
    densityLift:densityLift[section]||1,
    motifFamilies:{bass:bassFamilies,synth:synthFamilies},
    laneSeeds:{
      bass:bassFamilies[(sectionRoles[section]||['statement'])[0]]||bassFamilies.statement,
      synth:synthFamilies[(sectionRoles[section]||['statement'])[0]]||synthFamilies.statement,
    },
    laneResponses:{
      bass:bassFamilies.answer,
      synth:synthFamilies.answer,
    },
  }]));
}

function buildSectionProgression(baseProgression, sectionName, cycleIndex=0, visitCount=0, genre='techno', sectionPlan=null){
  const base=(baseProgression||[]).map(ch=>({...ch}));
  if(!base.length)return base;
  const kind=sectionPlan?.progressionKind||'full';
  if(kind==='pedal'){
    const first={...base[0]};
    const second={...base[Math.min(1,base.length-1)]};
    return [first,first,second,first].slice(0,Math.max(2,base.length));
  }
  if(kind==='rising'){
    const rotated=[...base.slice(1),base[0]].map(ch=>({...ch}));
    return base.map((ch,idx)=>idx<base.length-1?rotated[idx]:{...base[base.length-1]});
  }
  if(kind==='dominant'){
    const last=base[base.length-1];
    const pen=base[Math.max(0,base.length-2)];
    return [base[0],pen,last,last].slice(0,Math.max(2,base.length));
  }
  if(kind==='turnaround'){
    return [...base.slice(-2),...base.slice(0,2)].map(ch=>({...ch})).slice(0,Math.max(2,base.length));
  }
  if(kind==='falling'){
    return [...base].reverse().map(ch=>({...ch}));
  }
  if(kind==='groove' && (genre==='house'||genre==='techno')){
    const first=base[0], third=base[Math.min(2,base.length-1)]||base[0], fourth=base[Math.min(3,base.length-1)]||third;
    return [first,third,fourth,third].map(ch=>({...ch})).slice(0,Math.max(2,base.length));
  }
  if(kind==='full' && ((cycleIndex+visitCount)%2===1)){
    return [...base.slice(1),base[0]].map(ch=>({...ch}));
  }
  return base;
}

const GENRE_RHYTHM_BANK={
  techno:{
    bass:[[0,4,7,10,12,15],[0,3,6,8,12,14],[0,2,7,10,12,15]],
    synth:[[2,6,10,14],[1,5,9,13,14],[2,5,10,13,14]],
  },
  house:{
    bass:[[0,4,8,10,12],[0,5,8,12,14],[0,4,7,11,12,15]],
    synth:[[2,4,6,10,12,14],[0,6,10,14],[2,6,9,12,14]],
  },
  ambient:{
    bass:[[0,8,12],[0,6,12,15],[0,4,10,12]],
    synth:[[0,4,8,12],[2,6,10,14],[0,6,12,15]],
  },
  dnb:{
    bass:[[0,3,6,10,12,14],[0,2,7,10,12,15],[0,5,8,10,12,14]],
    synth:[[1,5,9,13,15],[2,6,10,14],[3,7,11,15]],
  },
  acid:{
    bass:[[0,3,6,7,10,12,14],[0,2,5,7,10,12,15],[0,4,7,9,12,14]],
    synth:[[2,5,8,10,13,14],[1,6,9,14],[3,7,11,14]],
  },
  industrial:{
    bass:[[0,4,6,10,12,15],[0,3,6,9,12,14],[0,2,6,10,12,15]],
    synth:[[2,6,10,14],[3,7,11,15],[1,5,9,13]],
  },
  experimental:{
    bass:[[0,5,7,11,13],[0,3,9,12,14],[0,2,6,10,12,15]],
    synth:[[1,4,9,12,15],[2,5,10,13,14],[0,7,11,14]],
  },
  cinematic:{
    bass:[[0,8,12],[0,4,8,12],[0,6,12,15]],
    synth:[[0,4,8,12],[2,6,10,14],[0,5,9,12,15]],
  },
};
const GENRE_THEME_BANK={
  techno:{bass:[[0,0,2,null,4,2,0,-1],[0,2,0,null,5,4,2,0]],synth:[[0,2,4,2,5,4,2,0],[0,4,2,5,4,2,1,0]]},
  house:{bass:[[0,0,2,4,5,4,2,0],[0,null,0,2,4,2,0,-1]],synth:[[0,2,4,6,5,4,2,0],[0,4,6,5,4,2,1,0]]},
  ambient:{bass:[[0,null,0,null,4,null,2,null],[0,null,5,null,4,null,2,null]],synth:[[0,4,7,5,4,2,0,2],[0,5,7,9,7,5,4,2]]},
  dnb:{bass:[[0,2,0,4,2,5,4,2],[0,0,3,2,6,5,3,2]],synth:[[0,2,5,4,7,5,4,2],[0,3,5,7,5,4,2,0]]},
  acid:{bass:[[0,2,3,5,7,6,3,2],[0,1,3,6,5,3,2,0]],synth:[[0,3,5,7,6,5,3,2],[0,2,5,6,8,6,5,3]]},
  industrial:{bass:[[0,null,0,2,5,4,2,-1],[0,0,4,2,6,4,2,0]],synth:[[0,3,6,3,7,6,3,1],[0,4,7,4,8,7,4,2]]},
  experimental:{bass:[[0,3,null,6,2,7,4,null],[0,null,5,1,6,2,7,3]],synth:[[0,3,7,4,8,5,9,6],[0,5,2,7,3,8,4,9]]},
  cinematic:{bass:[[0,null,0,2,4,2,0,-1],[0,null,5,4,2,0,-1,null]],synth:[[0,2,4,7,5,4,2,0],[0,4,7,9,7,5,4,2]]},
};
const GENRE_RESPONSE_BANK={
  techno:{bass:[[0,null,2,0,3,2,0,-2],[0,2,0,null,2,0,-1,null]],synth:[[2,4,5,4,2,1,0,0],[4,2,5,4,2,0,1,0]]},
  house:{bass:[[0,2,4,2,0,-1,0,null],[0,null,2,4,2,0,-1,null]],synth:[[4,6,5,4,2,1,0,0],[2,4,6,5,4,2,0,0]]},
  ambient:{bass:[[0,null,2,null,0,null,-1,null],[0,null,4,null,2,null,0,null]],synth:[[4,7,5,4,2,0,2,0],[5,7,9,7,5,4,2,0]]},
  dnb:{bass:[[0,2,0,3,2,0,-2,null],[0,null,4,2,0,null,2,0]],synth:[[5,4,2,1,0,2,4,2],[7,5,4,2,0,1,3,2]]},
  acid:{bass:[[0,1,3,2,0,-1,0,null],[0,3,5,3,2,0,-1,null]],synth:[[3,5,6,5,3,2,0,0],[5,6,8,6,5,3,2,0]]},
  industrial:{bass:[[0,null,2,0,5,2,0,-2],[0,0,4,2,0,-1,0,null]],synth:[[3,6,7,6,3,1,0,0],[4,7,8,7,4,2,1,0]]},
  experimental:{bass:[[0,3,1,4,2,5,3,null],[0,null,5,2,6,3,7,4]],synth:[[7,4,8,5,9,6,4,2],[5,2,7,3,8,4,9,5]]},
  cinematic:{bass:[[0,null,2,0,4,2,0,-2],[0,null,5,4,2,0,-1,null]],synth:[[7,5,4,2,0,2,4,0],[9,7,5,4,2,0,2,0]]},
};
const GENRE_DEFAULT_PRESETS={
  techno:{bass:'midnight_reese',synth:'orbital_super',drum:'warehouse',performance:'pressure_tunnel'},
  house:{bass:'club_root',synth:'liquid_halo',drum:'silk_room',performance:'velvet_afterhours'},
  ambient:{bass:'cinema_pedal',synth:'drone_veil',drum:'smoky_room',performance:'skyline_drift'},
  dnb:{bass:'jungle_torque',synth:'hybrid_glow',drum:'prism_break',performance:'break_vector'},
  acid:{bass:'rubber_pluck',synth:'ivory_pluck',drum:'acid_plate',performance:'acid_run'},
  industrial:{bass:'steel_fold',synth:'scene_prism',drum:'rave_metal',performance:'industrial_drive'},
  experimental:{bass:'vapor_current',synth:'hybrid_glow',drum:'jungle_foil',performance:'pulse_theatre'},
  cinematic:{bass:'monolith_formant',synth:'cine_brass',drum:'cinema_smoke',performance:'cinematic_rise'},
};

// ─── GENRE DNA ────────────────────────────────────────────────────────────────
const GENRES={
  techno:{bpm:[128,140],kick:'every4',swing:0.02,atmosphere:'dark industrial',
    kickFreq:80,kickEnd:30,kickDecay:0.22,noiseColor:'brown',
    modes:['phrygian','minor'],density:0.72,chaos:0.35,
    bassMode:'fm',synthMode:'lead',fxProfile:{drive:0.3,space:0.4,tone:0.6},
    hatPattern:'16th',description:'Dark mechanical pulse'},
  house:{bpm:[120,130],kick:'every4',swing:0.06,atmosphere:'warm Chicago',
    kickFreq:90,kickEnd:40,kickDecay:0.20,noiseColor:'pink',
    modes:['dorian','mixo'],density:0.65,chaos:0.28,
    bassMode:'sub',synthMode:'organ',fxProfile:{drive:0.1,space:0.55,tone:0.8},
    hatPattern:'offbeat',description:'Warm soulful groove'},
  ambient:{bpm:[70,90],kick:'sparse',swing:0.0,atmosphere:'oceanic',
    kickFreq:60,kickEnd:25,kickDecay:0.35,noiseColor:'pink',
    modes:['lydian','dorian'],density:0.25,chaos:0.55,
    bassMode:'drone',synthMode:'pad',fxProfile:{drive:0.0,space:0.9,tone:0.7},
    hatPattern:'sparse',description:'Textural spatial sound'},
  dnb:{bpm:[160,180],kick:'syncopated',swing:0.04,atmosphere:'jungle pressure',
    kickFreq:95,kickEnd:35,kickDecay:0.14,noiseColor:'white',
    modes:['minor','dorian'],density:0.78,chaos:0.55,
    bassMode:'grit',synthMode:'glass',fxProfile:{drive:0.35,space:0.3,tone:0.5},
    hatPattern:'breakbeat',description:'Fast broken jungle'},
  acid:{bpm:[125,138],kick:'every4',swing:0.05,atmosphere:'303 acid',
    kickFreq:85,kickEnd:32,kickDecay:0.18,noiseColor:'white',
    modes:['phrygian','chroma'],density:0.68,chaos:0.65,
    bassMode:'bit',synthMode:'mist',fxProfile:{drive:0.45,space:0.35,tone:0.4},
    hatPattern:'16th',description:'Squelching resonant acid'},
  industrial:{bpm:[130,150],kick:'every4',swing:0.0,atmosphere:'concrete noise',
    kickFreq:70,kickEnd:28,kickDecay:0.28,noiseColor:'brown',
    modes:['chroma','phrygian'],density:0.8,chaos:0.75,
    bassMode:'fold',synthMode:'air',fxProfile:{drive:0.55,space:0.25,tone:0.35},
    hatPattern:'noise',description:'Harsh mechanical noise'},
  experimental:{bpm:[80,160],kick:'irregular',swing:0.08,atmosphere:'avant-garde',
    kickFreq:100,kickEnd:45,kickDecay:0.25,noiseColor:'pink',
    modes:['chroma','lydian'],density:0.45,chaos:0.88,
    bassMode:'wet',synthMode:'strings',fxProfile:{drive:0.2,space:0.7,tone:0.6},
    hatPattern:'random',description:'Unpredictable textural'},
  cinematic:{bpm:[85,110],kick:'sparse',swing:0.03,atmosphere:'epic orchestral',
    kickFreq:75,kickEnd:30,kickDecay:0.32,noiseColor:'pink',
    modes:['minor','lydian'],density:0.38,chaos:0.35,
    bassMode:'drone',synthMode:'strings',fxProfile:{drive:0.05,space:0.85,tone:0.85},
    hatPattern:'sparse',description:'Dramatic cinematic score'},
};
const GENRE_NAMES=Object.keys(GENRES);

// ─── MUSICAL THEORY ───────────────────────────────────────────────────────────
const MODES={
  minor:   {b:['C2','D2','Eb2','F2','G2','Ab2','Bb2','C3','D3','Eb3'],s:['C4','D4','Eb4','F4','G4','Ab4','Bb4','C5','D5','Eb5']},
  phrygian:{b:['C2','Db2','Eb2','F2','G2','Ab2','Bb2','C3','Db3','Eb3'],s:['C4','Db4','Eb4','F4','G4','Ab4','Bb4','C5','Db5','Eb5']},
  dorian:  {b:['C2','D2','Eb2','F2','G2','A2','Bb2','C3','D3','Eb3'],s:['C4','D4','Eb4','F4','G4','A4','Bb4','C5','D5','Eb5']},
  chroma:  {b:['C2','Db2','D2','Eb2','E2','F2','G2','Ab2','A2','Bb2'],s:['C4','Db4','D4','Eb4','E4','F4','G4','Ab4','A4','Bb4']},
  mixo:    {b:['C2','D2','E2','F2','G2','A2','Bb2','C3','D3','E3'],s:['C4','D4','E4','F4','G4','A4','Bb4','C5','D5','E5']},
  lydian:  {b:['C2','D2','E2','F#2','G2','A2','B2','C3','D3','E3'],s:['C4','D4','E4','F#4','G4','A4','B4','C5','D5','E5']},
};

const CHORD_PROGS={
  minor:[
    [{r:0,t:2,f:4},{r:5,t:0,f:2},{r:3,t:5,f:0},{r:4,t:0,f:2}],
    [{r:0,t:2,f:4},{r:3,t:5,f:0},{r:4,t:0,f:2},{r:0,t:2,f:4}],
    [{r:0,t:2,f:4},{r:0,t:2,f:4},{r:3,t:5,f:0},{r:3,t:5,f:0}],
    [{r:0,t:2,f:4},{r:4,t:0,f:2},{r:3,t:5,f:0},{r:6,t:1,f:3}],
  ],
  phrygian:[
    [{r:0,t:1,f:3},{r:1,t:3,f:5},{r:3,t:5,f:0},{r:1,t:3,f:5}],
    [{r:0,t:1,f:3},{r:0,t:1,f:3},{r:1,t:3,f:5},{r:1,t:3,f:5}],
  ],
  dorian:[
    [{r:0,t:2,f:4},{r:5,t:0,f:2},{r:3,t:5,f:0},{r:4,t:0,f:2}],
    [{r:0,t:2,f:4},{r:4,t:6,f:1},{r:3,t:5,f:0},{r:0,t:2,f:4}],
  ],
  mixo:[
    [{r:0,t:2,f:4},{r:6,t:1,f:3},{r:4,t:6,f:1},{r:0,t:2,f:4}],
    [{r:0,t:2,f:4},{r:0,t:2,f:4},{r:6,t:1,f:3},{r:6,t:1,f:3}],
  ],
  lydian:[
    [{r:0,t:2,f:4},{r:3,t:5,f:0},{r:4,t:6,f:1},{r:2,t:4,f:6}],
  ],
  chroma:[
    [{r:0,t:1,f:4},{r:3,t:6,f:1},{r:7,t:2,f:5},{r:4,t:9,f:2}],
    [{r:0,t:3,f:6},{r:1,t:4,f:7},{r:2,t:5,f:8},{r:0,t:3,f:6}],
  ],
};

// Song sections with musical character
const SECTIONS={
  intro:   {kM:0.3,sM:0.2,hM:0.4,bM:0.5,syM:0.6,vel:'rise',pb:0.45,lb:3,bars:4},
  build:   {kM:0.7,sM:0.6,hM:1.0,bM:0.9,syM:0.8,vel:'rise',pb:0.6,lb:1.5,bars:4},
  drop:    {kM:1.3,sM:1.1,hM:0.9,bM:1.2,syM:0.8,vel:'accent',pb:0.85,lb:1,bars:8},
  groove:  {kM:1.0,sM:1.0,hM:1.0,bM:1.0,syM:0.9,vel:'groove',pb:0.72,lb:1.2,bars:8},
  break:   {kM:0.1,sM:0.3,hM:0.2,bM:0.4,syM:1.5,vel:'flat',pb:0.4,lb:4,bars:4},
  tension: {kM:0.5,sM:0.7,hM:1.4,bM:1.0,syM:1.1,vel:'accent',pb:0.55,lb:1.5,bars:4},
  outro:   {kM:0.4,sM:0.3,hM:0.3,bM:0.3,syM:0.4,vel:'fall',pb:0.35,lb:2.5,bars:4},
  fill:    {kM:1.6,sM:1.5,hM:0.6,bM:0.7,syM:0.4,vel:'accent',pb:0.75,lb:0.5,bars:2},
};

// Song arc templates — sequences of sections that tell a story
const SONG_ARCS=[
  ['intro','build','drop','groove','break','build','drop','outro'],
  ['intro','groove','tension','drop','break','drop','outro'],
  ['build','drop','groove','fill','drop','break','outro'],
  ['intro','tension','build','drop','groove','drop','outro'],
  ['groove','groove','break','tension','drop','groove','outro'],
];
const SONG_ARC_NAMES=['CATWALK IMPACT','PRESSURE WAVE','NIGHT MACHINE','ASCENT RITUAL','AFTERHOURS ARC'];

const GROOVE_MAPS={
  steady:{kB:0.22,sB:0.16,hB:0.58,bB:0.22,syB:0.12},
  broken:{kB:0.28,sB:0.14,hB:0.46,bB:0.28,syB:0.18},
  bunker:{kB:0.34,sB:0.10,hB:0.34,bB:0.24,syB:0.14},
  float: {kB:0.16,sB:0.12,hB:0.50,bB:0.18,syB:0.28},
};

const NOTE_FREQ={
  C2:65.41,Db2:69.3,D2:73.42,Eb2:77.78,E2:82.41,F2:87.31,'F#2':92.5,G2:98,Ab2:103.83,A2:110,Bb2:116.54,B2:123.47,
  C3:130.81,Db3:138.59,D3:146.83,Eb3:155.56,E3:164.81,F3:174.61,G3:196,A3:220,Bb3:233.08,B3:246.94,
  C4:261.63,Db4:277.18,D4:293.66,Eb4:311.13,E4:329.63,F4:349.23,'F#4':370,'G4':392,Ab4:415.3,A4:440,Bb4:466.16,B4:493.88,
  C5:523.25,Db5:554.37,D5:587.33,Eb5:622.25,F5:698.46,G5:783.99,A5:880,
};
const NOTE_MIDI={
  C2:36,D2:38,Eb2:39,E2:40,F2:41,'F#2':42,G2:43,Ab2:44,A2:45,Bb2:46,
  C3:48,D3:50,Eb3:51,G3:55,A3:57,
  C4:60,D4:62,Eb4:63,E4:64,F4:65,G4:67,Ab4:68,A4:69,Bb4:70,
  C5:72,D5:74,Eb5:75,G5:79,A5:81,
};
const CHROMA=['C','Db','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
const parseNoteName=n=>{const m=String(n||'').match(/^([A-G](?:b|#)?)(-?\d+)$/);return m?{name:m[1],oct:Number(m[2])}:null;};
const transposeNote=(note,semitones)=>{
  const parsed=parseNoteName(note);
  if(!parsed)return note;
  const idx=CHROMA.indexOf(parsed.name);
  if(idx===-1)return note;
  const abs=parsed.oct*12+idx+semitones;
  const nextIdx=((abs%12)+12)%12;
  const nextOct=Math.floor(abs/12);
  return `${CHROMA[nextIdx]}${nextOct}`;
};
const noteValueToDisplay=value=>{
  if(Array.isArray(value))return value.map(noteValueToDisplay).filter(Boolean).join('/');
  if(value===null||value===undefined)return '';
  if(typeof value==='number')return String(value);
  if(typeof value==='string')return value.replace(/b/g,'♭').replace(/#/g,'♯');
  if(typeof value==='object'){
    if(typeof value.note==='string')return noteValueToDisplay(value.note);
    if(Array.isArray(value.notes))return noteValueToDisplay(value.notes);
  }
  return String(value);
};
const noteValueRoot=value=>{
  if(Array.isArray(value)){
    for(const entry of value){
      const root=noteValueRoot(entry);
      if(root)return root;
    }
    return '';
  }
  if(value===null||value===undefined)return '';
  if(typeof value==='number')return String(value);
  if(typeof value==='string')return value;
  if(typeof value==='object'){
    if(typeof value.root==='string')return value.root;
    if(typeof value.note==='string')return value.note;
    if(Array.isArray(value.notes))return noteValueRoot(value.notes);
    if(typeof value.label==='string')return value.label.split('/')[0]||value.label;
  }
  return '';
};

const mkSteps=()=>Array.from({length:MAX_STEPS},()=>({on:false,p:1,v:1,l:1}));
const mkNotes=(d='C2')=>Array.from({length:MAX_STEPS},()=>d);

// ─── MUSIC GENERATION ENGINE ──────────────────────────────────────────────────
function chordNotes(chord,pool){
  const n=pool.length;
  return[pool[chord.r%n],pool[chord.t%n],pool[chord.f%n]].filter(Boolean);
}

function voiceLead(cur,pool){
  if(!pool.length)return cur;
  const i=pool.indexOf(cur);if(i===-1)return pool[Math.floor(rnd()*pool.length)];
  const r=rnd();
  if(r<0.5)return pool[Math.min(i+1,pool.length-1)];
  if(r<0.78)return pool[Math.max(i-1,0)];
  return pool[clamp(i+(rnd()<0.5?2:-2),0,pool.length-1)];
}

function arp(notes,mode,step){
  if(!notes||!notes.length)return'C4';
  const n=notes.length;
  switch(mode){
    case'up':return notes[step%n];
    case'down':return notes[(n-1-step%n)];
    case'updown':{const p=Math.max(1,n*2-2);const s=step%p;return s<n?notes[s]:notes[p-s];}
    case'outside':{const s=step%n;return s%2===0?notes[Math.floor(s/2)]:notes[n-1-Math.floor(s/2)];}
    default:return notes[step%n];
  }
}

function velCurve(type,i,total,pw){
  const t=i/total;
  switch(type){
    case'rise':return clamp(0.3+t*0.7*pw,0.2,1);
    case'fall':return clamp(0.95-t*0.6,0.15,1);
    case'accent':return i%4===0?clamp(0.88+pw*0.12,0.65,1):clamp(0.48+pw*0.28,0.25,0.82);
    case'groove':return i%8===0?0.95:i%4===0?0.76:i%2===0?0.60:0.42+rnd()*0.18;
    case'flat':return clamp(0.55+pw*0.2,0.38,0.82);
    default:return clamp(0.45+pw*0.55,0.28,1);
  }
}

// ─── MELODIC PHRASE BUILDER ───────────────────────────────────────────────────
// Creates real melodic phrases: 4-bar motifs, repetitions, silences, legato
function sectionEnergy(sectionName){
  const T={intro:0.24,build:0.56,drop:1,groove:0.74,break:0.2,tension:0.68,outro:0.18,fill:0.86};
  return T[sectionName] ?? 0.6;
}

function getCharacterConfig(name){
  return SOUND_CHARACTERS[name]||SOUND_CHARACTERS.tight;
}

function computeMacroEnergy(sectionName, blueprint=null, cycleIndex=0, visitCount=0){
  const base=sectionEnergy(sectionName);
  const profile=blueprint?.macroEnergyCurve||[0.9,1.02,0.96,1.08];
  const charCfg=getCharacterConfig(blueprint?.soundCharacter);
  const curve=profile[(cycleIndex+visitCount)%profile.length]||1;
  const revisit=visitCount>0?Math.min(0.12,visitCount*0.03):0;
  return clamp(base*curve+revisit+charCfg.accentBias*0.35,0.12,1);
}

function createStructuredBarProfile(sectionName,totalBars,visitCount,cycleIndex,macroEnergy,characterName){
  const charCfg=getCharacterConfig(characterName);
  const last=Math.max(1,totalBars)-1;
  const visitLift=Math.min(0.08,visitCount*0.02);
  return Array.from({length:Math.max(1,totalBars)},(_,barIndex)=>{
    const t=last<=0?1:barIndex/last;
    let shape=1;
    if(sectionName==='intro')shape=0.72+t*0.28;
    else if(sectionName==='build')shape=0.78+t*0.34;
    else if(sectionName==='drop')shape=1.08-(barIndex%4===3?0.08:0)+(t>0.45?0.06:0);
    else if(sectionName==='groove')shape=[1,0.94,1.03,0.9][barIndex%4]||1;
    else if(sectionName==='break')shape=0.62+(1-t)*0.16;
    else if(sectionName==='tension')shape=0.92+t*0.24+(barIndex===last?0.08:0);
    else if(sectionName==='fill')shape=1.06+(barIndex===last?0.12:0.05);
    else if(sectionName==='outro')shape=1.02-t*0.28;
    shape+=charCfg.motionBias*0.12+visitLift;
    shape*=0.9+macroEnergy*0.16;
    return clamp(shape,0.55,1.24);
  });
}


function mergeCharacterAndGenre(name, genre){
  const charCfg=getCharacterConfig(name);
  const fam=getGenreFamilyProfile(genre);
  return{
    ...charCfg,
    toneBias:charCfg.toneBias+fam.tone,
    spaceBias:charCfg.spaceBias+fam.space,
    driveBias:charCfg.driveBias+fam.drive,
    accentBias:charCfg.accentBias+fam.accent,
    motionBias:charCfg.motionBias+fam.motion,
  };
}

function scoreHook(notes,pool,lane,sectionName){
  const seq=(notes||[]).filter(Boolean);
  if(seq.length<3)return 0;
  const uniq=new Set(seq).size;
  const motion=seq.slice(1).reduce((acc,n,i)=>acc+Math.abs((pool.indexOf(n)??0)-(pool.indexOf(seq[i])??0)),0);
  const repeated=Math.max(0,seq.length-uniq);
  const contourBonus=seq[0]===seq[seq.length-1]?0.35:0;
  const laneBias=lane==='synth'?0.28:0.18;
  const sectionBias=sectionName==='drop'||sectionName==='groove'?0.22:sectionName==='build'?0.12:0;
  return repeated*0.24 + motion*0.04 + contourBonus + laneBias + sectionBias;
}

function extractHookCandidates(line, active, lane, pool, sectionName){
  const candidates=[];
  for(let start=0; start<=Math.min(line.length-4,16); start+=2){
    const slice=line.slice(start,start+6).filter(Boolean);
    const activeCount=(active||[]).slice(start,start+6).filter(Boolean).length;
    if(slice.length>=3 && activeCount>=2){
      candidates.push({
        notes:slice.slice(0,4),
        score:scoreHook(slice,pool,lane,sectionName)+activeCount*0.08-(start*0.01),
      });
    }
  }
  return candidates.sort((a,b)=>b.score-a.score).slice(0,2);
}

function getHookRecallWeight(sectionName, genre){
  const fam=getGenreFamilyProfile(genre);
  const sectionBias={intro:0.08,build:0.42,drop:0.88,groove:0.76,break:0.24,tension:0.54,outro:0.18,fill:0.34};
  return clamp((sectionBias[sectionName]??0.4)*fam.hookBias,0.06,0.92);
}

function chooseTransitionFillMode(sectionName,memory,genre){
  const recent=memory?.recentSections||[];
  const prev=recent[recent.length-1]||null;
  const fam=getGenreFamilyProfile(genre);
  if(sectionName==='fill'){
    if(prev==='break')return 're-entry';
    if(prev==='build'||prev==='tension')return fam.fillBias==='break'?'break-rush':'lift';
    if(prev==='drop'||prev==='groove')return fam.fillBias==='air'?'air-gap':'roll';
    return fam.fillBias||'impact';
  }
  if(sectionName==='drop'&&(prev==='break'||prev==='build'||prev==='tension'))return 'release';
  if(sectionName==='break'&&(prev==='drop'||prev==='groove'))return 'strip';
  return 'neutral';
}

function createCompositionBlueprint(genre, modeName, progression, arpeMode, songArc=null){
  const contour=[0];
  const profile=getGenreNarrativeProfile(genre);
  const family=getGenreFamilyProfile(genre);
  const motionChoices = genre==='ambient' ? [-1,0,0,1,1,2] : genre==='dnb' ? [-2,-1,1,2,2] : [-2,-1,-1,0,1,1,2];
  for(let i=1;i<8;i++){
    const move=pick(motionChoices);
    contour.push(clamp(contour[i-1]+move,-4,5));
  }
  const genreRhythms=GENRE_RHYTHM_BANK[genre]||GENRE_RHYTHM_BANK.techno;
  const themeBank=GENRE_THEME_BANK[genre]||THEME_CELLS;
  const responseBank=GENRE_RESPONSE_BANK[genre]||RESPONSE_CELLS;
  const hookShift=pick(genre==='acid'||genre==='experimental'?[-3,-2,-1,1,2,3]:[-2,-1,1,2]);
  const soundCharacter=getGenreSoundCharacter(genre);
  const macroCurvePool = genre==='ambient' || genre==='cinematic'
    ? [[0.84,0.92,0.98,1.06],[0.88,0.96,1.02,1.08],[0.86,0.94,1.0,1.1]]
    : genre==='dnb' || genre==='acid' || genre==='industrial'
      ? [[0.96,1.08,1.02,1.14],[0.94,1.06,1.0,1.12],[0.98,1.1,1.04,1.16]]
      : [[0.92,1.02,0.96,1.08],[0.9,0.98,1.04,1.1],[0.88,1.0,0.95,1.12]];
  return{
    id:`${genre}-${modeName}-${Date.now()}-${Math.floor(rnd()*9999)}`,
    genre,modeName,arpeMode,progression,
    soundCharacter,
    genreFamily:family,
    narrativeProfile:profile,
    macroEnergyCurve:pick(macroCurvePool),
    contour,
    bassRhythm:pick(genreRhythms.bass).slice(),
    synthRhythm:pick(genreRhythms.synth).slice(),
    themeCells:{bass:pick(themeBank.bass).slice(),synth:pick(themeBank.synth).slice()},
    responseCells:{bass:pick(responseBank.bass).slice(),synth:pick(responseBank.synth).slice()},
    sectionPlans:createSectionPlans(genre),
    songArc:Array.isArray(songArc)?[...songArc]:null,
    hookShift,
    answerBias:clamp(0.22+rnd()*0.24+family.hookBias*0.08,0.18,0.72),
    repetitionBias:clamp(0.5+rnd()*0.18+profile.cadenceBias*0.14,0.44,0.9),
    mutationBias:clamp(0.12+rnd()*0.16+family.motion*0.12,0.1,0.46),
    polychordBias:clamp(0.1+rnd()*0.14+(profile.polyDepth-2)*0.05,0.08,0.42),
    cadenceGravity:clamp(profile.cadenceBias+(genre==='cinematic'?0.08:genre==='experimental'?-0.06:0),0.36,0.92),
    narrativeSeed:pick(['statement','answer','climb','cadence','release']),
    memory:{
      bassMotif:null,
      synthMotif:null,
      previousBassTail:null,
      previousSynthTail:null,
      sectionVisits:{},
      recentSections:[],
      sectionHistory:[],
      hooks:[],
      laneHooks:{bass:[],synth:[]},
      energyHistory:[],
      cadenceBySection:{},
      lastStrongHook:null,
      previousVoicing:null,
    },
  };
}

function evolveRhythm(base, lane, sectionName, chaos, cycleIndex){
  const evolved=[...base];
  if(sectionName==='fill')return Array.from(new Set([...evolved,12,13,14,15])).sort((a,b)=>a-b);
  if(sectionName==='break')return evolved.filter(p=>lane==='bass'?p===0||p===8:p===2||p===10);
  if(sectionName==='intro')return evolved.filter((_,i)=>i<Math.max(2,Math.ceil(evolved.length*0.55)));
  if(sectionName==='outro')return evolved.filter((p,i)=>i<Math.max(2,Math.ceil(evolved.length*0.45))&&p<12);
  if(sectionName==='build'){
    evolved.push(14);
    if(cycleIndex%2===1)evolved.push(15);
  }
  if(sectionName==='drop'){
    evolved.push(lane==='bass'?15:13);
    if(chaos>0.45)evolved.push(lane==='bass'?11:9);
  }
  return Array.from(new Set(evolved.filter(p=>p>=0&&p<16))).sort((a,b)=>a-b);
}

function motifStepToNote(stepHint, chordNotePool, globalPool, previous){
  const source=(chordNotePool&&chordNotePool.length)?chordNotePool:[globalPool[0]];
  const fallback=source[0] || globalPool[0];
  const baseIdx=Math.max(0,globalPool.indexOf(fallback));
  const target=baseIdx+stepHint;
  const candidates=source.slice().sort((a,b)=>{
    const da=Math.abs(globalPool.indexOf(a)-target);
    const db=Math.abs(globalPool.indexOf(b)-target);
    return da-db;
  });
  if(previous && candidates.includes(previous) && rnd()<0.18)return previous;
  return candidates[0] || fallback;
}

function chooseLength(sectionName, lane, lenBias, localStep, energy){
  const anchor=(localStep%8===0);
  if(sectionName==='break')return Math.min(8,Math.max(1.5,lenBias*(lane==='synth'?3.2:2.2)));
  if(sectionName==='fill')return Math.max(0.5,lenBias*(anchor?0.8:0.5));
  if(sectionName==='drop')return Math.max(0.5,lenBias*(anchor?1.25:0.82));
  if(sectionName==='intro'||sectionName==='outro')return Math.min(8,Math.max(1,lenBias*(anchor?2.4:1.6)));
  return Math.min(8,Math.max(0.5,lenBias*(anchor?1.9:1.05+energy*0.5)));
}

function noteIndexSafe(pool,note){
  const idx=pool.indexOf(note);
  return idx===-1?0:idx;
}

function nearestPoolNote(target,pool,prefer=[]) {
  const source=[...new Set([...(prefer||[]).filter(Boolean),...(pool||[]).filter(Boolean)])];
  if(!source.length)return target||'C4';
  const targetIdx=noteIndexSafe(pool,target||source[0]);
  return source.reduce((best,n)=>{
    const d=Math.abs(noteIndexSafe(pool,n)-targetIdx);
    const bd=Math.abs(noteIndexSafe(pool,best)-targetIdx);
    return d<bd?n:best;
  },source[0]);
}

function classifyChordFunction(chord,pool){
  const root=chord?.r ?? 0;
  const degree=((root%7)+7)%7;
  if(degree===0)return 'tonic';
  if(degree===4||degree===6)return 'dominant';
  if(degree===3||degree===1)return 'predominant';
  return 'color';
}

function chooseTargetTone(chordPool,pool,lane,sectionName,functionType,energy,previous){
  const triad=(chordPool&&chordPool.length)?chordPool:[pool[0]];
  const root=triad[0]||pool[0];
  const third=triad[1]||root;
  const fifth=triad[2]||third;
  const choices = lane==='bass'
    ? (functionType==='dominant'?[root,fifth,root] : functionType==='predominant'?[root,third,root] : [root,root,fifth])
    : (functionType==='dominant'?[third,fifth,third,root] : functionType==='predominant'?[third,root,fifth,third] : [root,third,fifth,third]);
  const preferred=choices.filter(Boolean);
  const resolved=nearestPoolNote(previous||preferred[0], pool, preferred);
  if(sectionName==='break'&&lane==='synth'&&rnd()<0.45)return nearestPoolNote(third,pool,[third,fifth]);
  if(sectionName==='drop'&&energy>0.8&&lane==='synth'&&rnd()<0.35)return nearestPoolNote(fifth,pool,[fifth,third]);
  if(rnd()<0.62)return resolved;
  return preferred[Math.floor(rnd()*preferred.length)]||resolved;
}

function choosePassingTone(current,target,pool,lane,energy){
  if(!current||!target)return target||current||pool[0];
  const ci=noteIndexSafe(pool,current), ti=noteIndexSafe(pool,target);
  const diff=ti-ci;
  if(Math.abs(diff)<=1)return target;
  const step=diff>0?1:-1;
  const leapBias=lane==='bass'?0.26:0.18;
  if(rnd()<clamp(leapBias-energy*0.1,0.08,0.28))return target;
  const mid=pool[clamp(ci+step,0,pool.length-1)]||target;
  return rnd()<0.18 && Math.abs(diff)>2 ? (pool[clamp(ci+step*2,0,pool.length-1)]||mid) : mid;
}

function applySynthExpression(line,lengths,active,pool,sectionName='groove',opts={}){
  const chordChance=clamp(opts.chordChance??0.36,0,1);
  const holdAmt=clamp(opts.holdAmt??0.5,0,1);
  const curve=opts.curve||'balanced';
  const profile=opts.narrativeProfile||getGenreNarrativeProfile(opts.genre||'techno');
  const outLine=[...line];
  const outLengths=[...lengths];
  let prevVoicing=null;
  for(let i=0;i<outLine.length;i++){
    if(!active[i])continue;
    const local=i%16;
    const anchor=local===0||local===8;
    const halfCadence=local===4||local===12;
    const shouldChord = anchor ? rnd()<chordChance*(sectionName==='drop'?1.12:sectionName==='break'?0.78:1) : halfCadence && rnd()<chordChance*0.52;
    const shouldColor = sectionName==='break'||sectionName==='ambient'||(sectionName==='drop'&&anchor);
    if((shouldChord||shouldColor) && !Array.isArray(outLine[i])){
      const style = chooseChordStyle(sectionName,opts.genre||'techno',curve,profile);
      outLine[i]=getSynthChordVoicing(outLine[i],pool,sectionName,style,prevVoicing,profile);
      prevVoicing=outLine[i];
    }else if(Array.isArray(outLine[i])){
      const style = chooseChordStyle(sectionName,opts.genre||'techno',curve,profile);
      outLine[i]=getSynthChordVoicing(outLine[i][0],pool,sectionName,style,prevVoicing,profile);
      prevVoicing=outLine[i];
    }
    const baseLen=outLengths[i]||1;
    let holdMult = 1 + holdAmt*(anchor?3.1:halfCadence?1.9:0.82);
    if(curve==='snappy')holdMult*=anchor?1.12:0.72;
    if(curve==='soft')holdMult*=1.32;
    if(curve==='bloom')holdMult*=1.72;
    if(curve==='glass')holdMult*=1.1;
    if(sectionName==='break'||sectionName==='ambient')holdMult*=1.28;
    if(sectionName==='drop'&&anchor)holdMult*=1.12;
    if(anchor||halfCadence)outLengths[i]=Math.min(16,Math.max(baseLen,baseLen*holdMult));
  }
  return {line:outLine,lengths:outLengths};
}


// ─── MELODIC PHRASE BUILDER ───────────────────────────────────────────────────
// Creates motif/reply phrases with recall, section energy and controlled mutation

function shiftNoteInPool(note,pool,delta=0){
  if(Array.isArray(note))return note.map(n=>shiftNoteInPool(n,pool,delta));
  const idx=noteIndexSafe(pool,note);
  return pool[clamp(idx+delta,0,pool.length-1)]||note;
}

function getPhraseNarrativeRole(sectionName,phraseIndex,phraseCount){
  const last=phraseIndex===Math.max(0,phraseCount-1);
  if(sectionName==='intro')return phraseIndex===0?'statement':last?'lift':'answer';
  if(sectionName==='build')return last?'climax':phraseIndex%2===0?'climb':'answer';
  if(sectionName==='drop')return last?'cadence':phraseIndex%2===0?'statement':'answer';
  if(sectionName==='groove')return phraseIndex%2===0?'statement':'answer';
  if(sectionName==='break')return last?'cadence':'release';
  if(sectionName==='tension')return last?'climax':'climb';
  if(sectionName==='fill')return 'climax';
  if(sectionName==='outro')return last?'release':'cadence';
  return 'statement';
}

function applyNarrativePhrasing({line,lengths,active,pool,lane,sectionName,genre,blueprint,cycleIndex}){
  const outLine=[...line];
  const outLengths=[...lengths];
  const outActive=[...active];
  const profile=blueprint?.narrativeProfile||getGenreNarrativeProfile(genre);
  const phraseCount=Math.max(1,Math.ceil(outLine.length/16));
  const cadenceTargets=lane==='bass'?[pool[0],pool[4],pool[2]].filter(Boolean):[pool[0],pool[2],pool[4],pool[6]].filter(Boolean);
  const sectionVisit=blueprint?.memory?.sectionVisits?.[sectionName]||0;
  for(let phrase=0;phrase<phraseCount;phrase++){
    const role=getPhraseNarrativeRole(sectionName,phrase,phraseCount);
    const start=phrase*16;
    const registerLift = (role==='climax'?1:role==='release'?-1:role==='lift'?1:0) + (lane==='synth'?(profile.registerLift||0):0);
    const restBias = clamp(profile.restBias + (role==='release'?0.1:role==='climb'?-0.04:role==='climax'?-0.06:0) + (sectionName==='break'?0.08:0),0.02,0.42);
    for(let local=0;local<16 && start+local<outLine.length;local++){
      const abs=start+local;
      if(!outActive[abs])continue;
      const anchor=local===0||local===8;
      const halfCadence=local===4||local===12;
      const weak=!anchor && !halfCadence;
      if(weak && rnd()<restBias*(lane==='bass'?0.82:1) && !(sectionName==='drop'&&local===14)){
        outActive[abs]=false;
        continue;
      }
      if(Array.isArray(outLine[abs])){
        outLine[abs]=outLine[abs].map((n,idx)=>{
          let next=shiftNoteInPool(n,pool,Math.max(-1,Math.min(2,registerLift-idx%2)));
          if((role==='cadence'||role==='release') && (anchor||halfCadence))next=nearestPoolNote(next,pool,cadenceTargets);
          return next;
        });
      }else{
        let note=outLine[abs];
        if(role==='answer' && local%4===2)note=shiftNoteInPool(note,pool,profile.answerShift||0);
        if(role==='climb' && (local===6||local===10||local===14))note=shiftNoteInPool(note,pool,profile.climbLift||1);
        if(role==='climax' && (anchor||local===14))note=shiftNoteInPool(note,pool,1+(lane==='synth'?1:0));
        if((role==='cadence'||role==='release') && (local>=14 || halfCadence))note=nearestPoolNote(note,pool,cadenceTargets);
        if(sectionName==='drop' && lane==='bass' && anchor && sectionVisit>0)note=nearestPoolNote(note,pool,[pool[0],pool[4],pool[2]]);
        if(sectionName==='break' && lane==='synth' && anchor)note=shiftNoteInPool(note,pool,1);
        if(lane==='synth' && registerLift!==0 && (anchor||local===6||local===10))note=shiftNoteInPool(note,pool,registerLift);
        outLine[abs]=note;
      }
      const baseLen=outLengths[abs]||1;
      const lenBoost = role==='climax'?1.18:role==='release'?1.26:role==='cadence'?1.12:role==='climb'?0.96:1;
      if(anchor||halfCadence||sectionName==='break'||sectionName==='ambient')outLengths[abs]=Math.min(16,Math.max(baseLen,baseLen*lenBoost*(lane==='synth'?1.12:1.04)));
    }
  }
  return {line:outLine,lengths:outLengths,active:outActive};
}

const CHORD_STYLE_BANK={
  triad:[[0,2,4],[0,4,6],[0,2,6]],
  open:[[0,4,8],[0,4,6],[0,5,8]],
  seventh:[[0,2,4,6],[0,4,6,8],[0,2,6,8]],
  add9:[[0,2,4,8],[0,4,8,10]],
  quartal:[[0,3,6],[0,3,5,8]],
  sus2:[[0,1,4,6],[0,1,4,8]],
  cluster:[[0,1,3,6],[0,2,3,6]],
  pedal:[[0,4,8],[0,2,8]],
};

function buildVoicingFromPool(baseIdx,pool,offsets){
  return [...new Set(offsets.map(offset=>pool[clamp(baseIdx+offset,0,pool.length-1)]).filter(Boolean))];
}

function voicingDistance(candidate,previous,pool){
  if(!previous||!previous.length)return 0;
  const current=candidate.map(n=>noteIndexSafe(pool,n));
  const prev=previous.map(n=>noteIndexSafe(pool,n));
  const max=Math.max(current.length,prev.length);
  let dist=0;
  for(let i=0;i<max;i++)dist+=Math.abs((current[i]??current[current.length-1]??0)-(prev[i]??prev[prev.length-1]??0));
  return dist;
}

function chooseChordStyle(sectionName,genre,curve='balanced',profile=null){
  const palette=(profile?.chordPalette||getGenreNarrativeProfile(genre).chordPalette||['triad']).slice();
  if(curve==='glass')return 'add9';
  if(curve==='bloom')return palette.includes('seventh')?'seventh':palette[0]||'triad';
  if(sectionName==='break')return palette.includes('quartal')?'quartal':palette[0]||'open';
  if(sectionName==='drop')return palette.includes('open')?'open':palette[0]||'triad';
  if(sectionName==='ambient')return palette.includes('add9')?'add9':palette[0]||'open';
  return palette[0]||'triad';
}

function getSynthChordVoicing(baseNote,pool,sectionName='groove',style='triad',prevVoicing=null,profile=null){
  const idx=noteIndexSafe(pool,baseNote);
  const styleKey=style==='auto'?chooseChordStyle(sectionName,'techno','balanced',profile):style;
  const families=CHORD_STYLE_BANK[styleKey]||CHORD_STYLE_BANK.triad;
  const candidates=families.map(offsets=>buildVoicingFromPool(idx,pool,offsets)).filter(v=>v.length>=2);
  if(!candidates.length)return [baseNote];
  const targetCount=profile?.polyDepth||3;
  const shaped=candidates.map(voicing=>voicing.slice(0,Math.max(2,Math.min(targetCount,voicing.length))));
  return shaped.sort((a,b)=>voicingDistance(a,prevVoicing,pool)-voicingDistance(b,prevVoicing,pool))[0];
}

function enrichVoicingSpread(voicing,pool,profile,sectionName){
  if(!Array.isArray(voicing))return voicing;
  let next=[...new Set(voicing.filter(Boolean))];
  if((profile?.polyDepth||3)>=4 && next.length>=3 && next.length<4){
    const candidate=shiftNoteInPool(next[next.length-1],pool,sectionName==='drop'?2:1);
    if(candidate && !next.includes(candidate))next.push(candidate);
  }
  if(sectionName==='drop' && next.length>=3){
    const ordered=[next[0],next[Math.min(2,next.length-1)],next[next.length-1],...next.slice(1,-1)].filter(Boolean);
    next=[...new Set(ordered)];
  }
  return next;
}

function polishNarrativeLine({line,lengths,active,pool,lane,sectionName,genre,progression,blueprint}){
  const outLine=[...line];
  const outLengths=[...lengths];
  const outActive=[...active];
  const profile=blueprint?.narrativeProfile||getGenreNarrativeProfile(genre);
  const energy=sectionEnergy(sectionName);
  const maxLeap=lane==='bass' ? (sectionName==='tension'?5:sectionName==='drop'?4:3) : (sectionName==='tension'?6:5);
  let prevValue=null;
  let prevVoicing=blueprint?.memory?.previousVoicing||null;
  let repeatCount=0;
  for(let abs=0;abs<outLine.length;abs++){
    if(!outActive[abs])continue;
    const local=abs%16;
    const anchor=local===0||local===8;
    const halfCadence=local===4||local===12;
    const cadence=local===14||local===15;
    const chordIndex=Math.floor(abs/Math.max(1,Math.floor(outLine.length/Math.max(1,progression.length))))%Math.max(1,progression.length);
    const chordPool=chordNotes(progression[chordIndex],pool);
    let value=outLine[abs];
    if(lane==='synth'){
      const chordLift=clamp(0.1 + profile.polyDepth*0.08 + (anchor?0.12:0) + (halfCadence?0.08:0) + ((genre==='ambient'||genre==='cinematic'||genre==='house')?0.08:0),0.12,0.82);
      if((anchor||halfCadence||local===6||local===10) && !Array.isArray(value) && rnd()<chordLift){
        value=getSynthChordVoicing(value,pool,sectionName,chooseChordStyle(sectionName,genre,'balanced',profile),prevVoicing,profile);
      }
      if(Array.isArray(value)){
        value=enrichVoicingSpread(value,pool,profile,sectionName);
        prevVoicing=value;
      }
    }
    const baseNote=Array.isArray(value)?value[0]:value;
    const prevBase=prevValue?(Array.isArray(prevValue)?prevValue[0]:prevValue):null;
    if(prevBase){
      const leap=Math.abs(noteIndexSafe(pool,baseNote)-noteIndexSafe(pool,prevBase));
      if(leap>maxLeap && !(anchor||halfCadence||sectionName==='tension')){
        const eased=choosePassingTone(prevBase,baseNote,pool,lane,energy);
        value=Array.isArray(value)
          ? getSynthChordVoicing(eased,pool,sectionName,chooseChordStyle(sectionName,genre,'balanced',profile),prevVoicing,profile)
          : eased;
      }
    }
    const signature=JSON.stringify(value);
    const prevSignature=JSON.stringify(prevValue);
    repeatCount=signature===prevSignature?repeatCount+1:0;
    if(repeatCount>=2 && !anchor && !halfCadence && sectionName!=='ambient'){
      value=Array.isArray(value)
        ? getSynthChordVoicing(shiftNoteInPool(Array.isArray(value)?value[0]:value,pool,1),pool,sectionName,chooseChordStyle(sectionName,genre,'balanced',profile),prevVoicing,profile)
        : shiftNoteInPool(baseNote,pool,lane==='bass'?1:pick([-1,1]));
      repeatCount=0;
    }
    if(cadence){
      if(lane==='bass')value=nearestPoolNote(Array.isArray(value)?value[0]:value,pool,[chordPool[0],chordPool[2],pool[0]].filter(Boolean));
      else if(!Array.isArray(value) && rnd()<profile.cadenceBias){
        value=getSynthChordVoicing(nearestPoolNote(value,pool,[chordPool[1],chordPool[0],chordPool[2]].filter(Boolean)),pool,sectionName,'open',prevVoicing,profile);
      }
    }
    if(anchor||halfCadence)outLengths[abs]=Math.min(16,Math.max(outLengths[abs]||1,(outLengths[abs]||1)*(lane==='synth'?1.18:1.08)));
    outLine[abs]=value;
    prevValue=value;
    if(Array.isArray(value))prevVoicing=value;
  }
  if(blueprint?.memory)blueprint.memory.previousVoicing=prevVoicing;
  return {line:outLine,lengths:outLengths,active:outActive};
}

function orchestrateSectionInterplay({bassLine,bassLengths,bassActive,synthLine,synthLengths,synthActive,bassPool,synthPool,sectionName,genre,progression,blueprint}){
  const nextBass=[...bassLine];
  const nextBassLengths=[...bassLengths];
  const nextSynth=[...synthLine];
  const nextSynthLengths=[...synthLengths];
  const nextSynthActive=[...synthActive];
  const profile=blueprint?.narrativeProfile||getGenreNarrativeProfile(genre);
  for(let abs=0;abs<Math.max(nextBass.length,nextSynth.length);abs++){
    const local=abs%16;
    const anchor=local===0||local===8;
    const cadence=local===14||local===15;
    const bassNote=nextBass[abs];
    const synthValue=nextSynth[abs];
    const chordIndex=Math.floor(abs/Math.max(1,Math.floor(Math.max(nextBass.length,nextSynth.length)/Math.max(1,progression.length))))%Math.max(1,progression.length);
    const chordPool=chordNotes(progression[chordIndex],synthPool);
    if(bassActive[abs] && anchor && (genre==='techno'||genre==='house'||genre==='dnb'||genre==='acid')){
      nextBass[abs]=nearestPoolNote(Array.isArray(bassNote)?bassNote[0]:bassNote,bassPool,[bassPool[0],bassPool[4],bassPool[2]].filter(Boolean));
      nextBassLengths[abs]=Math.max(nextBassLengths[abs]||1,sectionName==='drop'?1.25:1);
    }
    if(nextSynthActive[abs]){
      const bassFreq=NOTE_FREQ[Array.isArray(bassNote)?bassNote[0]:bassNote]||110;
      const liftAboveBass=n=>{
        let note=n,guard=0;
        while((NOTE_FREQ[note]||440)<bassFreq*2.05 && guard<4){note=shiftNoteInPool(note,synthPool,1);guard++;}
        return note;
      };
      if(Array.isArray(synthValue)){
        nextSynth[abs]=[...new Set(synthValue.map(liftAboveBass).filter(Boolean))];
      }else{
        nextSynth[abs]=liftAboveBass(synthValue);
      }
      if((anchor||cadence) && !Array.isArray(nextSynth[abs]) && rnd()<clamp(0.14+profile.polyDepth*0.08+(genre==='cinematic'||genre==='ambient'?0.1:0),0.1,0.72)){
        nextSynth[abs]=getSynthChordVoicing(nextSynth[abs],synthPool,sectionName,chooseChordStyle(sectionName,genre,'balanced',profile),blueprint?.memory?.previousVoicing||null,profile);
      }
      if((genre==='ambient'||genre==='cinematic') && (sectionName==='intro'||sectionName==='break'||sectionName==='outro') && (anchor||local===4||local===12)){
        nextSynthLengths[abs]=Math.max(nextSynthLengths[abs]||1,6);
      }
      if(genre==='acid' && !Array.isArray(nextSynth[abs]) && !anchor && rnd()<0.12)nextSynth[abs]=shiftNoteInPool(nextSynth[abs],synthPool,1);
      if(genre==='house' && sectionName==='groove' && local===6 && !Array.isArray(nextSynth[abs]) && rnd()<0.22)nextSynth[abs]=getSynthChordVoicing(nextSynth[abs],synthPool,sectionName,'seventh',blueprint?.memory?.previousVoicing||null,profile);
      if(cadence && nextSynthActive[abs] && rnd()<0.18+profile.cadenceBias*0.2)nextSynthLengths[abs]=Math.max(nextSynthLengths[abs]||1,2.25);
    }
  }
  return {bassLine:nextBass,bassLengths:nextBassLengths,synthLine:nextSynth,synthLengths:nextSynthLengths,synthActive:nextSynthActive};
}

function buildMelodicLine(pool, chordProgression, steps, chaos, arpeMode, lenBias, options={}){
  const {lane='bass',sectionName='groove',blueprint=null,cycleIndex=0}=options;
  const line=mkNotes(pool[0]);
  const lengths=Array(steps).fill(1);
  const active=Array(steps).fill(false);
  const phraseLen=16;
  const phraseCount=Math.max(1,Math.ceil(steps/phraseLen));
  const energy=sectionEnergy(sectionName);
  const memory=blueprint?.memory;
  const motifKey=lane==='bass'?'bassMotif':'synthMotif';
  const tailKey=lane==='bass'?'previousBassTail':'previousSynthTail';
  const rhythmSource=lane==='bass'?(blueprint?.bassRhythm||[0,4,8,12]):(blueprint?.synthRhythm||[2,6,10,14]);
  const firstChord=chordProgression[0];
  const firstNotes=chordNotes(firstChord,pool);
  let current=(memory&&memory[tailKey])||firstNotes[0]||pool[0];
  const laneHooks=memory?.laneHooks?.[lane]||[];
  const longHook=(laneHooks[0]?.notes)||memory?.lastStrongHook?.notes||null;
  const hookRecallWeight=getHookRecallWeight(sectionName, blueprint?.genre||'techno');
  const sectionPlan=blueprint?.sectionPlans?.[sectionName]||null;
  const laneFamilies=sectionPlan?.motifFamilies?.[lane]||null;

  const themeSeed=(sectionPlan?.laneSeeds?.[lane]||blueprint?.themeCells?.[lane]||[]).slice();
  const motif=((memory&&Array.isArray(memory[motifKey])?memory[motifKey]:null) || (longHook&&rnd()<hookRecallWeight?longHook:null) || laneFamilies?.statement) || Array.from({length:8},(_,idx)=>{
    const themeHint=themeSeed[idx%Math.max(1,themeSeed.length)] ;
    if(themeHint===null)return null;
    if(themeHint===undefined && idx>0&&rnd()<(lane==='bass'?0.12:0.18))return null;
    const stepHint=((typeof themeHint==='number'?themeHint:(blueprint?.contour?.[idx]??0))+(lane==='synth'&&idx%3===2?(blueprint?.hookShift||0):0));
    const note=motifStepToNote(stepHint,firstNotes,pool,current);
    current=note||current;
    return note;
  });

  if(memory&&!memory[motifKey])memory[motifKey]=[...motif];

  for(let phrase=0;phrase<phraseCount;phrase++){
    const phraseStart=phrase*phraseLen;
    const isAnswer=phrase%2===1;
    const isRecall=phrase>1&&rnd()<(blueprint?.repetitionBias??0.62);
    const deepRecall=longHook&&phrase>0&&rnd()<hookRecallWeight*(phrase%2===0?0.72:0.44);
    const mutateAmt=clamp((blueprint?.mutationBias??0.18)+chaos*0.16+(sectionName==='tension'?0.08:0),0.08,0.42);
    const rhythm=evolveRhythm(rhythmSource,lane,sectionName,chaos,cycleIndex+phrase);
    const narrativeRole=(sectionPlan?.phraseRoles?.[phrase%Math.max(1,sectionPlan?.phraseRoles?.length||1)])||getPhraseNarrativeRole(sectionName,phrase,phraseCount);
    const responseSeed=(sectionPlan?.laneResponses?.[lane]||blueprint?.responseCells?.[lane]||[]).slice();
    const familyMotif=(laneFamilies&&laneFamilies[narrativeRole])?laneFamilies[narrativeRole].slice():null;
    const sourceMotif=deepRecall&&Array.isArray(longHook)?longHook:(familyMotif&&familyMotif.length?familyMotif:(narrativeRole==='answer'&&responseSeed.length?responseSeed.map((hint,idx)=>{
      if(hint===null)return null;
      const stepHint=(typeof hint==='number'?hint:(blueprint?.contour?.[idx]??0));
      return motifStepToNote(stepHint,firstNotes,pool,current);
    }):motif));
    const phraseMotif=sourceMotif.map((note,idx)=>{
      if(note===null)return null;
      if(sectionName==='fill'&&idx>=4)return voiceLead(note,pool);
      if(isRecall)return note;
      if(isAnswer&&rnd()<(blueprint?.answerBias??0.32))return voiceLead(note,pool);
      if(deepRecall&&idx===sourceMotif.length-1&&rnd()<0.4)return voiceLead(note,pool);
      if(rnd()<mutateAmt*(idx===7?1.4:1))return voiceLead(note,pool);
      return note;
    });

    for(let local=0;local<phraseLen&&phraseStart+local<steps;local++){
      const abs=phraseStart+local;
      const chordIndex=Math.floor(abs/Math.max(1,Math.floor(steps/chordProgression.length)))%chordProgression.length;
      const chordPool=chordNotes(chordProgression[chordIndex],pool);
      const on=rhythm.includes(local%16)&&!(sectionName==='break'&&lane==='bass'&&local%16===12&&rnd()<0.6);
      active[abs]=on;
      const motifSlot=Math.floor(local/2)%phraseMotif.length;
      const motifNote=phraseMotif[motifSlot];
      const anchor=local%8===0;

      const functionType=classifyChordFunction(chordProgression[chordIndex],pool);
      const prevNote=line[Math.max(0,abs-1)]||current||pool[0];
      let note=motifNote;
      if(note===null&&on){
        note=chooseTargetTone(chordPool,pool,lane,sectionName,functionType,energy,prevNote);
        if(lane==='synth'&&rnd()<0.22)note=nearestPoolNote(arp(chordPool.length?chordPool:pool,arpeMode,local+cycleIndex),pool,chordPool);
      }

      if(note!==null){
        const preferredTargets = lane==='bass'
          ? [chordPool[0],chordPool[2],prevNote]
          : [chordPool[1],chordPool[0],chordPool[2],prevNote];
        const nearest=nearestPoolNote(note,pool,preferredTargets);
        if(on)note=nearest;
      }else{
        note=prevNote;
      }

      const cadencePoint = local%16===14 || local%16===15;
      if(on && !anchor && cadencePoint && rnd()<(lane==='synth'?0.42:0.28)){
        const targetTone=chooseTargetTone(chordPool,pool,lane,sectionName,functionType,energy,prevNote);
        note=choosePassingTone(prevNote,targetTone,pool,lane,energy);
      }
      if(on && local%16===7 && lane==='synth' && rnd()<0.24){
        const targetTone=chooseTargetTone(chordPool,pool,lane,sectionName,functionType,energy,prevNote);
        note=choosePassingTone(prevNote,targetTone,pool,lane,energy);
      }

      if(anchor&&lane==='bass'&&rnd()<0.76)note=chooseTargetTone(chordPool,pool,lane,sectionName,functionType,energy,prevNote)||note;
      if(anchor&&lane==='synth'&&sectionName!=='break'&&rnd()<0.36)note=chooseTargetTone(chordPool,pool,lane,sectionName,functionType,energy,prevNote)||note;
      if(sectionName==='drop'&&lane==='bass'&&local%16===0&&rnd()<0.4)note=nearestPoolNote(chordPool[0]||note,pool,[chordPool[0],chordPool[2]]);

      line[abs]=note;
      current=note||current;
      lengths[abs]=chooseLength(sectionName,lane,lenBias,local,energy);
      if(on&&local%16===15&&sectionName!=='fill'&&rnd()<0.38)lengths[abs]=Math.min(8,lengths[abs]+1.5);
    }
  }

  const narrated=applyNarrativePhrasing({line,lengths,active,pool,lane,sectionName,genre:blueprint?.genre||'techno',blueprint,cycleIndex});
  line.splice(0,line.length,...narrated.line);
  lengths.splice(0,lengths.length,...narrated.lengths);
  active.splice(0,active.length,...narrated.active);
  const polished=polishNarrativeLine({line,lengths,active,pool,lane,sectionName,genre:blueprint?.genre||'techno',progression:chordProgression,blueprint});
  line.splice(0,line.length,...polished.line);
  lengths.splice(0,lengths.length,...polished.lengths);
  active.splice(0,active.length,...polished.active);

  const sectionsHistory=memory?.recentSections||[];
  const recallTail=(lane==='bass'?line[Math.max(0,steps-4)]:line[Math.max(0,steps-2)])||current;
  if(memory){
    memory[tailKey]=recallTail;
    memory.recentSections=[...sectionsHistory.slice(-5),sectionName];
    const history=memory.sectionHistory||[];
    memory.sectionHistory=[...history.slice(-11),{lane,section:sectionName,tail:recallTail,cycleIndex}];
    if(steps>=16){
      const candidates=extractHookCandidates(line,active,lane,pool,sectionName);
      if(candidates.length){
        const best=candidates[0];
        memory.hooks=[...(memory.hooks||[]).slice(-5),best.notes];
        const prevLaneHooks=((memory.laneHooks&&memory.laneHooks[lane])||[]).slice();
        memory.laneHooks={...(memory.laneHooks||{}),[lane]:[best,...prevLaneHooks].slice(0,4)};
        if(!memory.lastStrongHook || best.score>=memory.lastStrongHook.score-0.08)memory.lastStrongHook={...best,lane,section:sectionName};
      }
    }
  }

  for(let i=steps;i<MAX_STEPS;i++){
    line[i]=line[i%Math.max(1,steps)];
  }

  return{line,lengths,active,motif:[...motif]};
}


function buildSection(genre, sectionName, modeName, progression, arpeMode, prevBass, blueprint=null, cycleIndex=0){
  const sec = SECTIONS[sectionName] || SECTIONS.groove;
  const gd = GENRES[genre];
  const grooveName = gd.density > 0.65 && gd.chaos > 0.4 ? 'bunker' : gd.chaos > 0.6 ? 'broken' : gd.density < 0.4 ? 'float' : 'steady';
  const groove = GROOVE_MAPS[grooveName];
  const mode = MODES[modeName] || MODES.minor;
  const bp = mode.b, sp = mode.s;
  const laneLen = {kick:16, snare:16, hat:32, bass:32, synth:32};
  if(genre === 'dnb'){laneLen.hat = 48; laneLen.bass = 32; laneLen.synth = 64;}
  if(genre === 'ambient'){laneLen.kick = 32; laneLen.bass = 64; laneLen.synth = 64;}
  if(genre === 'acid'){laneLen.bass = 16; laneLen.synth = 32;}
  if(genre === 'cinematic'){laneLen.bass = 64; laneLen.synth = 64;}

  const density = gd.density, chaos = gd.chaos;
  const soundCharacter = blueprint?.soundCharacter || getGenreSoundCharacter(genre);
  const charCfg = mergeCharacterAndGenre(soundCharacter, genre);
  const genreFamily = blueprint?.genreFamily || getGenreFamilyProfile(genre);
  const fillMode = chooseTransitionFillMode(sectionName, blueprint?.memory, genre);
  const sectionPlan = blueprint?.sectionPlans?.[sectionName]||null;
  const sectionVisits = blueprint?.memory?.sectionVisits || {};
  const visitCount = sectionVisits[sectionName] || 0;
  if(blueprint?.memory)blueprint.memory.sectionVisits[sectionName] = visitCount + 1;
  const macroEnergy = computeMacroEnergy(sectionName, blueprint, cycleIndex, visitCount);
  const structuredBars = createStructuredBarProfile(sectionName, Math.max(1, Math.ceil(Math.max(laneLen.kick,laneLen.snare,laneLen.hat,laneLen.bass,laneLen.synth)/16)), visitCount, cycleIndex, macroEnergy, soundCharacter);
  if(blueprint?.memory){
    const eh=blueprint.memory.energyHistory||[];
    blueprint.memory.energyHistory=[...eh.slice(-11),{section:sectionName,energy:macroEnergy,fillMode,cycleIndex}];
    const cadence=blueprint.memory.cadenceBySection||{};
    blueprint.memory.cadenceBySection={...cadence,[sectionName]:{energy:macroEnergy,fillMode,visit:visitCount+1}};
  }

  const bassRoleBias = genreFamily.bassRole==='drone'?1.4:genreFamily.bassRole==='lead'?0.72:genreFamily.bassRole==='pulse'?0.88:genreFamily.bassRole==='pressure'?0.8:genreFamily.bassRole==='pedal'?1.55:1;
  const synthRoleBias = genreFamily.synthRole==='wash'?2.2:genreFamily.synthRole==='theme'?1.7:genreFamily.synthRole==='chord'?1.45:genreFamily.synthRole==='stab'?0.9:genreFamily.synthRole==='shard'?0.86:1.2;
  const sectionProgression=buildSectionProgression(progression,sectionName,cycleIndex,visitCount,genre,sectionPlan);
  const sectionDensityLift=sectionPlan?.densityLift||1;
  const bassLb = sec.lb * (sectionName === 'break' ? 2.5 : sectionName === 'drop' ? 0.8 : 1) * (0.94 + macroEnergy * 0.12) * bassRoleBias / sectionDensityLift;
  const synthLb = sec.lb * (sectionName === 'break' ? 3 : genre === 'ambient' ? 4 : 1.2) * (0.92 + macroEnergy * 0.14) * synthRoleBias / sectionDensityLift;
  const bassBuilt = buildMelodicLine(bp, sectionProgression, laneLen.bass, chaos, arpeMode, bassLb, {lane:'bass', sectionName, blueprint, cycleIndex:cycleIndex+visitCount});
  const synthBuilt = buildMelodicLine(sp, sectionProgression, laneLen.synth, chaos * 0.72, arpeMode, synthLb, {lane:'synth', sectionName, blueprint, cycleIndex:cycleIndex+visitCount});
  let {line: bassLine, lengths: bassLengths, active: bassActive} = bassBuilt;
  let {line: synthLine, lengths: synthLengths, active: synthActive} = synthBuilt;
  const synthExpression = applySynthExpression(synthLine, synthLengths, synthActive, sp, sectionName, {
    chordChance: (typeof globalThis!=='undefined' && typeof globalThis.__CESIRA_SYNTH_CHORD_CHANCE__==='number' ? globalThis.__CESIRA_SYNTH_CHORD_CHANCE__ : 0.34) + (blueprint?.polychordBias||0),
    holdAmt: typeof globalThis!=='undefined' && typeof globalThis.__CESIRA_SYNTH_HOLD__==='number' ? globalThis.__CESIRA_SYNTH_HOLD__ : 0.56,
    curve: typeof globalThis!=='undefined' && globalThis.__CESIRA_SYNTH_CURVE__ ? globalThis.__CESIRA_SYNTH_CURVE__ : 'balanced',
    genre,
    narrativeProfile: blueprint?.narrativeProfile,
  });
  synthLine = synthExpression.line;
  synthLengths = synthExpression.lengths;
  if(prevBass && bassLine.length)bassLine[0] = voiceLead(prevBass, [bassLine[0], ...(chordNotes(sectionProgression[0], bp))].filter(Boolean));
  const arranged=orchestrateSectionInterplay({bassLine,bassLengths,bassActive,synthLine,synthLengths,synthActive,bassPool:bp,synthPool:sp,sectionName,genre,progression:sectionProgression,blueprint});
  bassLine=arranged.bassLine;
  synthLine=arranged.synthLine;
  for(let i=0;i<bassLengths.length;i++)bassLengths[i]=arranged.bassLengths[i]??bassLengths[i];
  for(let i=0;i<synthLengths.length;i++)synthLengths[i]=arranged.synthLengths[i]??synthLengths[i];
  for(let i=0;i<synthActive.length;i++)synthActive[i]=arranged.synthActive[i]??synthActive[i];

  const p = {kick:mkSteps(), snare:mkSteps(), hat:mkSteps(), bass:mkSteps(), synth:mkSteps()};
  const bar = 16;
  const phraseW = [1, 0.78, 0.94, 0.7];
  const sectionE = sectionEnergy(sectionName);

  for(const lane of ['kick','snare','hat','bass','synth']){
    const ll = laneLen[lane];
    const lmKey = lane === 'kick' ? 'kM' : lane === 'snare' ? 'sM' : lane === 'hat' ? 'hM' : lane === 'bass' ? 'bM' : 'syM';
    const lm = sec[lmKey] || 1;
    const familyLift = 1 + (lane==='bass'?genreFamily.motion*0.18:lane==='synth'?genreFamily.hookBias*0.06:genreFamily.accent*0.12);
    const dm = density * lm * (0.92 + macroEnergy * 0.16) * (1 + charCfg.motionBias * 0.08) * familyLift;
    const maxDensity = (lane === 'bass' ? 0.72 : lane === 'synth' ? 0.58 : 1.0) * clamp(0.94 + macroEnergy * 0.1 + charCfg.accentBias * 0.04 + genreFamily.accent * 0.08,0.84,1.14);
    const totalBars = Math.max(1, Math.ceil(ll / 16));

    for(let i = 0; i < ll; i++){
      const pos = i % bar;
      const pb = Math.floor(i / 8) % 4;
      const barIndex = Math.floor(i / 16);
      const barPhase = totalBars <= 1 ? 1 : barIndex / (totalBars - 1);
      const strong = pos === 0 || pos === 8;
      const backbeat = pos === 4 || pos === 12;
      const offbeat = pos % 2 === 1;
      const endOfBar = pos >= 12;
      const sectionShape = structuredBars[Math.min(structuredBars.length-1,barIndex)] || 1;
      const energyLift = 0.82 + macroEnergy * 0.32;
      const pw = phraseW[pb] * sectionShape * energyLift * (sectionName === 'build' ? 0.82 + barPhase * 0.34 : sectionName === 'outro' ? 1.06 - barPhase * 0.24 : 1);
      let hit = false;

      if(lane === 'kick'){
        if(gd.kick === 'every4') hit = pos % 4 === 0 || (sectionName === 'fill' && pos === 14);
        else if(gd.kick === 'syncopated') hit = pos === 0 || pos === 10 || pos === 14 || (sectionName === 'drop' && pos === 6);
        else if(gd.kick === 'sparse') hit = pos === 0 || (sectionName === 'build' && pos === 12);
        else if(gd.kick === 'irregular') hit = pos === 0 || rnd() < dm * 0.28 * pw;
        else hit = strong || rnd() < (groove.kB + dm * 0.16 + (endOfBar && sectionName === 'fill' ? 0.2 : 0)) * pw;
        if(sectionName === 'break') hit = hit && (pos === 0 || pos === 12);
        if(sectionName === 'build' && barPhase > 0.5 && (pos === 12 || pos === 14)) hit = true;
      }
      else if(lane === 'snare'){
        if(gd.hatPattern === 'breakbeat') hit = backbeat || rnd() < (groove.sB + dm * 0.12) * (1 + pb * 0.18);
        else hit = backbeat || rnd() < (groove.sB + dm * 0.06 + (backbeat ? 0.24 : 0)) * (1.02 - pw * 0.14);
        if(sectionName === 'fill' && pos >= 12) hit = fillMode==='air-gap'?pos===12||pos===14:fillMode==='break-rush'?pos!==15:(pos !== 15);
        if(sectionName === 'intro') hit = hit && (pos === 12 || (barIndex % 2 === 1 && pos === 4));
      }
      else if(lane === 'hat'){
        const hatP = gd.hatPattern;
        if(hatP === '16th') hit = true;
        else if(hatP === 'offbeat') hit = offbeat;
        else if(hatP === 'breakbeat') hit = rnd() < (groove.hB + dm * 0.22) * (0.8 + pw * 0.25);
        else if(hatP === 'noise') hit = rnd() < 0.55 + dm * 0.18;
        else if(hatP === 'sparse') hit = rnd() < 0.2 + dm * 0.1;
        else hit = rnd() < (groove.hB + dm * 0.18) * (0.82 + pw * 0.22);
        if(sectionName === 'break') hit = hit && (pos % 4 === 2);
        if(sectionName === 'build' && endOfBar) hit = true;
        if(sectionName === 'fill' && fillMode==='re-entry') hit = hit || pos===10 || pos===15;
        if(sectionName === 'fill' && fillMode==='air-gap') hit = hit && (pos===6 || pos===10 || pos===14);
        if(hit && rnd() < chaos * 0.3) p.hat[i].p = 0.45 + rnd() * 0.4;
      }
      else if(lane === 'bass'){
        const anchorBoost = strong || pos === 4 || pos === 12;
        const melodicGate = !!bassActive[i];
        const prob = anchorBoost ? 0.86 * lm : (groove.bB + dm * 0.1 + sectionE * 0.06) * pw * 0.68;
        hit = melodicGate && rnd() < Math.min(prob, maxDensity);
        if(sectionName === 'drop' && anchorBoost) hit = true;
        if(sectionName === 'break' && genreFamily.bassRole==='pedal') hit = hit && (pos===0||pos===8);
      }
      else if(lane === 'synth'){
        const phraseOn = pos === 2 || pos === 6 || pos === 10 || pos === 14;
        const melodicGate = !!synthActive[i];
        const prob = phraseOn ? 0.68 * lm : (groove.syB + dm * 0.07 + sectionE * 0.05) * pw * 0.52;
        hit = melodicGate && ((rnd() < Math.min(prob, maxDensity) && !strong) || (pb === 3 && rnd() < 0.18 + chaos * 0.15));
        if(sectionName === 'break') hit = melodicGate && (phraseOn || pos === 0);
        if(sectionName === 'drop' && blueprint?.memory?.lastStrongHook?.lane==='synth' && (pos===2||pos===10)) hit = true;
      }

      if(hit){
        p[lane][i].on = true;
        p[lane][i].p = clamp(sec.pb + rnd() * (1 - sec.pb), sec.pb, 1);
        const fillVelocityBias = sectionName==='fill' ? (fillMode==='impact'||fillMode==='re-entry'?1.12:fillMode==='air-gap'?0.84:fillMode==='break-rush'?1.08:1) : 1;
        p[lane][i].v = clamp(velCurve(sec.vel, i, ll, pw) * (sectionName==='build' ? 0.88 + barPhase * 0.18 : 1) * fillVelocityBias * (0.94 + macroEnergy * 0.12 + charCfg.accentBias * 0.08 + genreFamily.accent * 0.06), 0.22, 1);
        if(lane === 'bass') p[lane][i].l = bassLengths[i] || sec.lb;
        else if(lane === 'synth') p[lane][i].l = synthLengths[i] || sec.lb;
        else p[lane][i].l = 1;
      }
    }
  }

  for(let i = 0; i < laneLen.kick; i += 16) p.kick[i].on = true;
  if(gd.kick !== 'sparse' && sectionName !== 'break'){
    for(let i = 0; i < laneLen.snare; i += 16){
      if(i + 4 < laneLen.snare) p.snare[i + 4].on = true;
      if(i + 12 < laneLen.snare) p.snare[i + 12].on = true;
    }
  }
  if(sectionName === 'fill'){
    const ll = laneLen.snare;
    for(let i = 0; i < ll; i++){
      const pos=i%16;
      if(fillMode==='air-gap') p.snare[i].on = pos===12 || pos===14;
      else if(fillMode==='break-rush') p.snare[i].on = pos>=10 && pos!==13;
      else if(fillMode==='re-entry') p.snare[i].on = pos===8 || pos===10 || pos===12 || pos===15;
      else if(pos>=12) p.snare[i].on = true;
    }
    if(fillMode==='lift'){
      for(let i=0;i<laneLen.hat;i++) if(i%16>=8) p.hat[i].on = true;
    }
  }

  for(const lane of ['bass', 'synth']){
    const ll = laneLen[lane];
    for(let i = 0; i < ll; i++){
      if(p[lane][i].on && p[lane][i].l > 1){
        const holdEnd = Math.min(ll - 1, i + Math.floor(p[lane][i].l));
        for(let j = i + 1; j <= holdEnd; j++){
          p[lane][j].tied = true;
          p[lane][j].on = false;
        }
      }
    }
  }

  const mp = Math.floor(chaos * 4);
  for(let m = 0; m < mp; m++){
    const ln = pick(['kick','snare','hat']);
    const ll = laneLen[ln];
    const pos = Math.floor(rnd() * ll);
    if(ln === 'hat') p.hat[pos].on = !p.hat[pos].on;
    else if(ln === 'kick'){if(pos % 4 !== 0) p.kick[pos].on = rnd() < 0.28 + chaos * 0.16;}
    else{p.snare[pos].on = !p.snare[pos].on && pos % 4 !== 0;}
  }

  const lb = bassLine[Math.max(0,laneLen.bass - 1)] || bp[0];
  return {patterns:p, bassLine, synthLine, laneLen, lastBass:lb, macroEnergy, soundCharacter};
}

function buildSong(genre,overrideArc=null){
  const gd=GENRES[genre];
  const modeName=pick(gd.modes);
  const progPool=CHORD_PROGS[modeName]||CHORD_PROGS.minor;
  const progression=pick(progPool);
  const arpeMode=pick(['up','down','updown','outside']);
  const bpm=Math.round(gd.bpm[0]+rnd()*(gd.bpm[1]-gd.bpm[0]));
  const arc=(overrideArc&&overrideArc.length)?[...overrideArc]:pick(SONG_ARCS);
  const composition=createCompositionBlueprint(genre,modeName,progression,arpeMode,arc);
  const soundCharacter=composition.soundCharacter;
  const genreFamily=composition.genreFamily;
  const sections=arc.map((name,idx)=>({
    name,
    modeName,
    progression,
    arpeMode,
    genre,
    energy:sectionEnergy(name),
    soundCharacter,
    genreFamily,
    order:idx,
  }));
  return{genre,modeName,progression,arpeMode,bpm,arc,sections,currentSection:0,composition,soundCharacter,genreFamily};
}

// ─── GROOVE ACCENT TABLE ──────────────────────────────────────────────────────
function grooveAccent(profile,lane,step,amount){
  const pos=step%16;
  const T={
    steady:{kick:[1.2,1,0.92,0.96,1,0.94,0.98,0.96,1.18,0.98,0.92,0.96,1.02,0.96,0.98,0.96],snare:[0.92,0.9,0.92,0.9,1.16,0.92,0.92,0.9,0.92,0.9,0.92,0.9,1.12,0.92,0.92,0.9],hat:[0.92,1.02,0.9,1.04,0.94,1.02,0.9,1.06,0.92,1.02,0.9,1.04,0.94,1.02,0.9,1.08],bass:[1.1,0.96,0.98,1.02,0.96,0.94,1,1.04,1.08,0.96,0.98,1.02,0.96,0.94,1,1.04],synth:[0.96,1,1.04,1,0.96,1,1.08,1,0.96,1,1.04,1,0.96,1,1.12,1]},
    broken:{kick:[1.22,0.88,1.04,0.84,0.96,1.06,0.9,1.02,1.14,0.86,1.08,0.82,0.94,1.04,0.9,1.06],snare:[0.88,0.94,0.9,1,1.12,0.9,0.96,0.9,0.88,1,0.9,0.96,1.1,0.88,1,0.92],hat:[0.84,1.08,0.9,1.14,0.86,1.02,0.92,1.12,0.84,1.08,0.9,1.14,0.86,1.02,0.92,1.16],bass:[1.06,0.94,1.1,0.88,1,0.94,1.08,0.9,1.04,0.94,1.1,0.88,1,0.94,1.08,0.92],synth:[0.92,1.04,1.12,0.9,0.94,1.08,1.14,0.88,0.92,1.04,1.1,0.9,0.94,1.08,1.16,0.86]},
    bunker:{kick:[1.28,0.92,0.94,0.9,1.02,0.92,0.94,0.9,1.24,0.92,0.94,0.9,1.04,0.92,0.94,0.9],snare:[0.9,0.9,0.92,0.9,1.08,0.9,0.92,0.9,0.9,0.9,0.92,0.9,1.06,0.9,0.92,0.9],hat:[0.88,0.98,0.9,1.02,0.88,0.98,0.9,1.04,0.88,0.98,0.9,1.02,0.88,0.98,0.9,1.06],bass:[1.16,0.94,0.96,1,1.04,0.94,0.96,1.02,1.14,0.94,0.96,1,1.06,0.94,0.96,1.04],synth:[0.9,0.98,1.02,0.96,0.9,0.98,1.06,0.96,0.9,0.98,1.02,0.96,0.9,0.98,1.1,0.96]},
    float: {kick:[1.12,0.98,0.96,1,1.04,0.98,0.96,1,1.1,0.98,0.96,1,1.02,0.98,0.96,1],snare:[0.94,0.98,0.96,1,1.06,0.98,0.96,1,0.94,0.98,0.96,1,1.08,0.98,0.96,1],hat:[0.96,1.02,0.98,1.04,0.96,1.02,0.98,1.06,0.96,1.02,0.98,1.04,0.96,1.02,0.98,1.08],bass:[1.04,0.98,1,1.02,1.04,0.98,1,1.04,1.02,0.98,1,1.02,1.06,0.98,1,1.04],synth:[1,1.04,1.08,1.02,1,1.04,1.1,1.02,1,1.04,1.08,1.02,1,1.04,1.12,1.02]},
  };
  const t=(T[profile]||T.steady)[lane]||T.steady.kick;
  return 1+(t[pos]-1)*clamp(amount,0,1);
}

// ─── COLORS & THEME ───────────────────────────────────────────────────────────
const LANE_CLR={kick:'#ff4444',snare:'#ffaa00',hat:'#ffdd00',bass:'#00ccff',synth:'#cc88ff'};
const GENRE_CLR={
  techno:'#ff2244',house:'#ff8800',ambient:'#44ffcc',dnb:'#ff4400',
  acid:'#aaff00',industrial:'#aaaaaa',experimental:'#ff44ff',cinematic:'#4488ff'
};


const SOUND_PRESETS={
  bass:{
    sub_floor:{label:'SUB FLOOR',bassMode:'sub',bassFilter:0.38,bassSubAmt:0.92,drive:0.06,compress:0.24,tone:0.48,bassDetune:0.004,bassMotion:0.18,bassPunch:0.52},
    deep_foundation:{label:'DEEP FOUNDATION',bassMode:'sub',bassFilter:0.32,bassSubAmt:0.98,drive:0.04,compress:0.18,tone:0.42,bassDetune:0.002,bassMotion:0.14,bassPunch:0.44},
    acid_pressure:{label:'ACID PRESSURE',bassMode:'bit',bassFilter:0.72,bassSubAmt:0.36,drive:0.42,compress:0.32,tone:0.42,fmIdx:0.86,bassDetune:0.006,bassMotion:0.58,bassPunch:0.76},
    acid_serpent:{label:'ACID SERPENT',bassMode:'bit',bassFilter:0.78,bassSubAmt:0.28,drive:0.46,compress:0.34,tone:0.38,fmIdx:1.12,bassDetune:0.008,bassMotion:0.66,bassPunch:0.82},
    fm_metal:{label:'FM METAL',bassMode:'fm',bassFilter:0.62,bassSubAmt:0.28,drive:0.26,compress:0.38,tone:0.44,fmIdx:1.08,bassDetune:0.005,bassMotion:0.46,bassPunch:0.68},
    fm_orbit:{label:'FM ORBIT',bassMode:'fm',bassFilter:0.58,bassSubAmt:0.34,drive:0.22,compress:0.3,tone:0.52,fmIdx:0.92,bassDetune:0.007,bassMotion:0.54,bassPunch:0.62},
    drift_drone:{label:'DRIFT DRONE',bassMode:'drone',bassFilter:0.56,bassSubAmt:0.62,drive:0.1,compress:0.18,tone:0.66,bassDetune:0.01,bassMotion:0.8,bassPunch:0.24},
    night_drone:{label:'NIGHT DRONE',bassMode:'drone',bassFilter:0.48,bassSubAmt:0.72,drive:0.08,compress:0.16,tone:0.6,bassDetune:0.012,bassMotion:0.88,bassPunch:0.18},
    fold_grit:{label:'FOLD GRIT',bassMode:'fold',bassFilter:0.68,bassSubAmt:0.34,drive:0.48,compress:0.4,tone:0.36,bassDetune:0.009,bassMotion:0.72,bassPunch:0.86},
    steel_fold:{label:'STEEL FOLD',bassMode:'fold',bassFilter:0.74,bassSubAmt:0.26,drive:0.52,compress:0.42,tone:0.3,bassDetune:0.01,bassMotion:0.76,bassPunch:0.88},
    wet_orbit:{label:'WET ORBIT',bassMode:'wet',bassFilter:0.48,bassSubAmt:0.5,drive:0.22,compress:0.24,tone:0.7,bassDetune:0.006,bassMotion:0.62,bassPunch:0.42},
    vapor_current:{label:'VAPOR CURRENT',bassMode:'wet',bassFilter:0.44,bassSubAmt:0.56,drive:0.18,compress:0.2,tone:0.76,bassDetune:0.008,bassMotion:0.7,bassPunch:0.38},
    pulse_body:{label:'PULSE BODY',bassMode:'pulse',bassFilter:0.58,bassSubAmt:0.44,drive:0.18,compress:0.28,tone:0.56,bassDetune:0.01,bassMotion:0.52,bassPunch:0.64},
    mono_pulse:{label:'MONO PULSE',bassMode:'pulse',bassFilter:0.62,bassSubAmt:0.4,drive:0.22,compress:0.32,tone:0.48,bassDetune:0.014,bassMotion:0.4,bassPunch:0.72},
    saw_motion:{label:'SAW MOTION',bassMode:'saw',bassFilter:0.64,bassSubAmt:0.3,drive:0.3,compress:0.34,tone:0.52,bassDetune:0.012,bassMotion:0.58,bassPunch:0.7},
    reese_engine:{label:'REESE ENGINE',bassMode:'saw',bassFilter:0.54,bassSubAmt:0.36,drive:0.34,compress:0.36,tone:0.46,bassDetune:0.024,bassMotion:0.74,bassPunch:0.74},
    club_root:{label:'CLUB ROOT',bassMode:'pulse',bassFilter:0.52,bassSubAmt:0.52,drive:0.14,compress:0.26,tone:0.58,bassDetune:0.006,bassMotion:0.22,bassPunch:0.58},
    cinema_pedal:{label:'CINEMA PEDAL',bassMode:'drone',bassFilter:0.42,bassSubAmt:0.82,drive:0.04,compress:0.14,tone:0.68,bassDetune:0.004,bassMotion:0.34,bassPunch:0.2},
    void_reese:{label:'VOID REESE',bassMode:'reese',bassFilter:0.5,bassSubAmt:0.44,drive:0.28,compress:0.34,tone:0.4,bassDetune:0.03,bassMotion:0.82,bassPunch:0.7},
    midnight_reese:{label:'MIDNIGHT REESE',bassMode:'reese',bassFilter:0.46,bassSubAmt:0.58,drive:0.32,compress:0.36,tone:0.38,bassDetune:0.028,bassMotion:0.88,bassPunch:0.78},
    rubber_pluck:{label:'RUBBER PLUCK',bassMode:'pluck',bassFilter:0.7,bassSubAmt:0.28,drive:0.22,compress:0.26,tone:0.54,bassDetune:0.007,bassMotion:0.46,bassPunch:0.86},
    silo_weight:{label:'SILO WEIGHT',bassMode:'reese',bassFilter:0.4,bassSubAmt:0.7,drive:0.18,compress:0.3,tone:0.34,bassDetune:0.018,bassMotion:0.54,bassPunch:0.64},
    reactor_bite:{label:'REACTOR BITE',bassMode:'harmonic',bassFilter:0.62,bassSubAmt:0.34,drive:0.28,compress:0.32,tone:0.48,bassDetune:0.012,bassMotion:0.5,bassPunch:0.82},
    monolith_formant:{label:'MONOLITH FORMANT',bassMode:'harmonic',bassFilter:0.48,bassSubAmt:0.62,drive:0.16,compress:0.28,tone:0.4,bassDetune:0.008,bassMotion:0.34,bassPunch:0.58},
    jungle_torque:{label:'JUNGLE TORQUE',bassMode:'pluck',bassFilter:0.66,bassSubAmt:0.36,drive:0.24,compress:0.28,tone:0.52,bassDetune:0.01,bassMotion:0.64,bassPunch:0.84},
  },
  synth:{
    velvet_pad:{label:'VELVET PAD',synthMode:'pad',synthFilter:0.64,space:0.72,tone:0.68,drive:0.08,polySynth:true,synthDetune:0.012,synthMotion:0.28,synthPunch:0.3},
    cathedral_pad:{label:'CATHEDRAL PAD',synthMode:'pad',synthFilter:0.72,space:0.88,tone:0.76,drive:0.04,polySynth:true,synthDetune:0.016,synthMotion:0.34,synthPunch:0.26},
    neon_lead:{label:'NEON LEAD',synthMode:'lead',synthFilter:0.72,space:0.28,tone:0.74,drive:0.22,polySynth:false,synthDetune:0.01,synthMotion:0.48,synthPunch:0.72},
    razor_lead:{label:'RAZOR LEAD',synthMode:'lead',synthFilter:0.82,space:0.18,tone:0.78,drive:0.3,polySynth:false,synthDetune:0.008,synthMotion:0.42,synthPunch:0.84},
    glass_bell:{label:'GLASS BELL',synthMode:'glass',synthFilter:0.78,space:0.54,tone:0.82,drive:0.06,polySynth:true,synthDetune:0.004,synthMotion:0.24,synthPunch:0.44},
    prism_bell:{label:'PRISM BELL',synthMode:'bell',synthFilter:0.86,space:0.58,tone:0.88,drive:0.05,polySynth:true,synthDetune:0.003,synthMotion:0.18,synthPunch:0.48},
    air_organ:{label:'AIR ORGAN',synthMode:'organ',synthFilter:0.52,space:0.34,tone:0.62,drive:0.12,polySynth:true,fmIdx:0.72,synthDetune:0.006,synthMotion:0.2,synthPunch:0.62},
    house_organ:{label:'HOUSE ORGAN',synthMode:'organ',synthFilter:0.58,space:0.3,tone:0.7,drive:0.16,polySynth:true,fmIdx:0.64,synthDetune:0.004,synthMotion:0.16,synthPunch:0.68},
    string_machine:{label:'STRING MACHINE',synthMode:'strings',synthFilter:0.68,space:0.66,tone:0.7,drive:0.08,polySynth:true,synthDetune:0.012,synthMotion:0.32,synthPunch:0.34},
    noir_strings:{label:'NOIR STRINGS',synthMode:'strings',synthFilter:0.6,space:0.72,tone:0.64,drive:0.06,polySynth:true,synthDetune:0.014,synthMotion:0.4,synthPunch:0.3},
    choir_mist:{label:'CHOIR MIST',synthMode:'choir',synthFilter:0.58,space:0.76,tone:0.66,drive:0.04,polySynth:true,synthDetune:0.01,synthMotion:0.22,synthPunch:0.28},
    star_noise:{label:'STAR NOISE',synthMode:'star',synthFilter:0.8,space:0.62,tone:0.86,drive:0.14,polySynth:true,synthDetune:0.008,synthMotion:0.36,synthPunch:0.4},
    cinematic_air:{label:'CINEMATIC AIR',synthMode:'air',synthFilter:0.6,space:0.84,tone:0.74,drive:0.02,polySynth:true,fmIdx:0.54,synthDetune:0.006,synthMotion:0.44,synthPunch:0.22},
    mist_pluck:{label:'MIST PLUCK',synthMode:'mist',synthFilter:0.44,space:0.46,tone:0.58,drive:0.12,polySynth:false,synthDetune:0.006,synthMotion:0.52,synthPunch:0.74},
    bell_shard:{label:'BELL SHARD',synthMode:'bell',synthFilter:0.82,space:0.48,tone:0.8,drive:0.04,polySynth:true,synthDetune:0.005,synthMotion:0.2,synthPunch:0.5},
    wide_arp:{label:'WIDE ARP',synthMode:'mist',synthFilter:0.56,space:0.52,tone:0.66,drive:0.18,polySynth:false,synthDetune:0.018,synthMotion:0.66,synthPunch:0.76},
    drone_veil:{label:'DRONE VEIL',synthMode:'pad',synthFilter:0.42,space:0.92,tone:0.54,drive:0.03,polySynth:true,synthDetune:0.02,synthMotion:0.52,synthPunch:0.16},
    theatre_theme:{label:'THEATRE THEME',synthMode:'strings',synthFilter:0.74,space:0.7,tone:0.76,drive:0.05,polySynth:true,synthDetune:0.01,synthMotion:0.26,synthPunch:0.42},
    opaline_chords:{label:'OPALINE CHORDS',synthMode:'organ',synthFilter:0.66,space:0.44,tone:0.72,drive:0.1,polySynth:true,fmIdx:0.58,synthDetune:0.008,synthMotion:0.18,synthPunch:0.54},
    noir_bloom:{label:'NOIR BLOOM',synthMode:'choir',synthFilter:0.54,space:0.82,tone:0.62,drive:0.03,polySynth:true,synthDetune:0.014,synthMotion:0.28,synthPunch:0.24},
    super_glass:{label:'SUPER GLASS',synthMode:'glass',synthFilter:0.84,space:0.62,tone:0.9,drive:0.08,polySynth:true,synthDetune:0.005,synthMotion:0.3,synthPunch:0.5},
    orbital_super:{label:'ORBITAL SUPER',synthMode:'supersaw',synthFilter:0.62,space:0.48,tone:0.72,drive:0.16,polySynth:true,synthDetune:0.024,synthMotion:0.52,synthPunch:0.7},
    ivory_pluck:{label:'IVORY PLUCK',synthMode:'pluck',synthFilter:0.58,space:0.32,tone:0.68,drive:0.12,polySynth:false,synthDetune:0.007,synthMotion:0.34,synthPunch:0.82},
    hybrid_glow:{label:'HYBRID GLOW',synthMode:'hybrid',synthFilter:0.66,space:0.56,tone:0.74,drive:0.14,polySynth:true,synthDetune:0.012,synthMotion:0.46,synthPunch:0.58},
    scene_prism:{label:'SCENE PRISM',synthMode:'hybrid',synthFilter:0.54,space:0.42,tone:0.6,drive:0.18,polySynth:true,synthDetune:0.016,synthMotion:0.5,synthPunch:0.66},
    brass_memory:{label:'BRASS MEMORY',synthMode:'brass',synthFilter:0.56,space:0.34,tone:0.62,drive:0.12,polySynth:true,synthDetune:0.01,synthMotion:0.24,synthPunch:0.76},
    cine_brass:{label:'CINE BRASS',synthMode:'brass',synthFilter:0.5,space:0.5,tone:0.58,drive:0.08,polySynth:true,synthDetune:0.008,synthMotion:0.18,synthPunch:0.82},
    shimmer_veil:{label:'SHIMMER VEIL',synthMode:'shimmer',synthFilter:0.76,space:0.86,tone:0.82,drive:0.04,polySynth:true,synthDetune:0.012,synthMotion:0.42,synthPunch:0.34},
    liquid_halo:{label:'LIQUID HALO',synthMode:'shimmer',synthFilter:0.7,space:0.7,tone:0.78,drive:0.06,polySynth:true,synthDetune:0.01,synthMotion:0.36,synthPunch:0.4},
  },
  drum:{
    tight_punch:{label:'TIGHT PUNCH',drumDecay:0.32,noiseMix:0.12,compress:0.18,drive:0.1,kickTone:0.74,snareTone:0.62,hatTone:0.82,hatOpenChance:0.08},
    warehouse:{label:'WAREHOUSE',drumDecay:0.48,noiseMix:0.22,compress:0.28,drive:0.18,kickTone:0.54,snareTone:0.56,hatTone:0.74,hatOpenChance:0.11},
    broken_air:{label:'BROKEN AIR',drumDecay:0.58,noiseMix:0.34,compress:0.24,drive:0.12,swing:0.06,kickTone:0.48,snareTone:0.66,hatTone:0.7,hatOpenChance:0.16},
    industrial_haze:{label:'INDUSTRIAL HAZE',drumDecay:0.64,noiseMix:0.42,compress:0.34,drive:0.28,kickTone:0.42,snareTone:0.74,hatTone:0.6,hatOpenChance:0.14},
    dusty_tape:{label:'DUSTY TAPE',drumDecay:0.44,noiseMix:0.28,compress:0.22,drive:0.16,tone:0.58,kickTone:0.52,snareTone:0.48,hatTone:0.62,hatOpenChance:0.09},
    crisp_club:{label:'CRISP CLUB',drumDecay:0.26,noiseMix:0.1,compress:0.26,drive:0.08,tone:0.68,kickTone:0.78,snareTone:0.68,hatTone:0.9,hatOpenChance:0.1},
    deep_warehouse:{label:'DEEP WAREHOUSE',drumDecay:0.52,noiseMix:0.18,compress:0.3,drive:0.16,kickTone:0.46,snareTone:0.52,hatTone:0.72,hatOpenChance:0.1},
    punch_club:{label:'PUNCH CLUB',drumDecay:0.24,noiseMix:0.08,compress:0.32,drive:0.14,kickTone:0.82,snareTone:0.64,hatTone:0.88,hatOpenChance:0.08},
    rave_metal:{label:'RAVE METAL',drumDecay:0.38,noiseMix:0.26,compress:0.34,drive:0.24,kickTone:0.7,snareTone:0.8,hatTone:0.86,hatOpenChance:0.14},
    velvet_breaks:{label:'VELVET BREAKS',drumDecay:0.46,noiseMix:0.24,compress:0.22,drive:0.12,kickTone:0.58,snareTone:0.6,hatTone:0.74,hatOpenChance:0.18},
    smoky_room:{label:'SMOKY ROOM',drumDecay:0.5,noiseMix:0.32,compress:0.2,drive:0.1,kickTone:0.44,snareTone:0.46,hatTone:0.58,hatOpenChance:0.1},
    hard_grid:{label:'HARD GRID',drumDecay:0.28,noiseMix:0.16,compress:0.38,drive:0.26,kickTone:0.86,snareTone:0.72,hatTone:0.84,hatOpenChance:0.07},
    acid_plate:{label:'ACID PLATE',drumDecay:0.3,noiseMix:0.18,compress:0.28,drive:0.18,kickTone:0.74,snareTone:0.58,hatTone:0.92,hatOpenChance:0.12},
    jungle_foil:{label:'JUNGLE FOIL',drumDecay:0.42,noiseMix:0.2,compress:0.26,drive:0.16,kickTone:0.62,snareTone:0.7,hatTone:0.82,hatOpenChance:0.2},
    cinema_smoke:{label:'CINEMA SMOKE',drumDecay:0.56,noiseMix:0.22,compress:0.18,drive:0.06,kickTone:0.5,snareTone:0.54,hatTone:0.6,hatOpenChance:0.08},
    iron_breaker:{label:'IRON BREAKER',drumDecay:0.34,noiseMix:0.24,compress:0.34,drive:0.22,kickTone:0.76,snareTone:0.78,hatTone:0.86,hatOpenChance:0.16},
    silk_room:{label:'SILK ROOM',drumDecay:0.4,noiseMix:0.12,compress:0.2,drive:0.08,kickTone:0.68,snareTone:0.62,hatTone:0.78,hatOpenChance:0.11},
    prism_break:{label:'PRISM BREAK',drumDecay:0.46,noiseMix:0.2,compress:0.28,drive:0.16,kickTone:0.6,snareTone:0.72,hatTone:0.84,hatOpenChance:0.22},
  },
  performance:{
    club_night:{label:'CLUB NIGHT',genre:'techno',grooveAmt:0.7,swing:0.03,space:0.26,tone:0.56,drive:0.18,compress:0.28},
    acid_run:{label:'ACID RUN',genre:'acid',grooveAmt:0.76,swing:0.06,space:0.24,tone:0.42,drive:0.38,compress:0.3},
    jungle_grid:{label:'JUNGLE GRID',genre:'dnb',grooveAmt:0.74,swing:0.05,space:0.22,tone:0.52,drive:0.2,compress:0.24},
    ambient_bloom:{label:'AMBIENT BLOOM',genre:'ambient',grooveAmt:0.42,swing:0.0,space:0.88,tone:0.72,drive:0.02,compress:0.16},
    cinematic_rise:{label:'CINEMATIC RISE',genre:'cinematic',grooveAmt:0.5,swing:0.02,space:0.82,tone:0.76,drive:0.04,compress:0.18},
    industrial_drive:{label:'INDUSTRIAL DRIVE',genre:'industrial',grooveAmt:0.78,swing:0.0,space:0.18,tone:0.34,drive:0.48,compress:0.36},
    velvet_afterhours:{label:'VELVET AFTERHOURS',genre:'house',grooveAmt:0.68,swing:0.07,space:0.38,tone:0.72,drive:0.1,compress:0.24},
    pressure_tunnel:{label:'PRESSURE TUNNEL',genre:'techno',grooveAmt:0.82,swing:0.02,space:0.18,tone:0.44,drive:0.3,compress:0.34},
    skyline_drift:{label:'SKYLINE DRIFT',genre:'ambient',grooveAmt:0.38,swing:0.01,space:0.94,tone:0.8,drive:0.01,compress:0.12},
    steel_lobby:{label:'STEEL LOBBY',genre:'industrial',grooveAmt:0.72,swing:0.01,space:0.24,tone:0.38,drive:0.42,compress:0.32},
    pulse_theatre:{label:'PULSE THEATRE',genre:'cinematic',grooveAmt:0.56,swing:0.03,space:0.76,tone:0.78,drive:0.06,compress:0.2},
    break_vector:{label:'BREAK VECTOR',genre:'dnb',grooveAmt:0.8,swing:0.06,space:0.2,tone:0.5,drive:0.24,compress:0.28},
  }
};

const getBassPresetCfg=key=>SOUND_PRESETS.bass[key]||SOUND_PRESETS.bass.sub_floor;
const getSynthPresetCfg=key=>SOUND_PRESETS.synth[key]||SOUND_PRESETS.synth.velvet_pad;
const getDrumPresetCfg=key=>SOUND_PRESETS.drum[key]||SOUND_PRESETS.drum.tight_punch;

const PATTERN_AUTHORITY_LEVELS=['lock','assist','evolve'];
const defaultPatternAuthority=()=>({drums:'assist',bass:'assist',synth:'assist'});
const defaultLaneVolume=()=>({kick:0.96,snare:0.92,hat:0.78,bass:0.9,synth:0.88});
const defaultLaneProbability=()=>({kick:1,snare:1,hat:1,bass:1,synth:1});
const SYNTH_CURVES=['balanced','soft','snappy','bloom','glass'];
const laneAuthorityKey=lane=>(lane==='kick'||lane==='snare'||lane==='hat')?'drums':lane;
const preserveLockedLanes=(generated,currentPatterns,currentBass,currentSynth,authority)=>{
  const next={...generated,patterns:{...generated.patterns},bassLine:[...generated.bassLine],synthLine:[...generated.synthLine]};
  if((authority?.drums||'assist')==='lock'){
    next.patterns.kick=(currentPatterns?.kick||next.patterns.kick).map(s=>({...s}));
    next.patterns.snare=(currentPatterns?.snare||next.patterns.snare).map(s=>({...s}));
    next.patterns.hat=(currentPatterns?.hat||next.patterns.hat).map(s=>({...s}));
  }
  if((authority?.bass||'assist')==='lock'){
    next.patterns.bass=(currentPatterns?.bass||next.patterns.bass).map(s=>({...s}));
    next.bassLine=[...(currentBass||next.bassLine)];
  }
  if((authority?.synth||'assist')==='lock'){
    next.patterns.synth=(currentPatterns?.synth||next.patterns.synth).map(s=>({...s}));
    next.synthLine=[...(currentSynth||next.synthLine)];
  }
  return next;
};
const mergeProtectedMutation=(mutated,current,authority)=>{
  const next={...mutated};
  if((authority?.drums||'assist')==='lock'){
    next.kick=current.kick.map(s=>({...s}));
    next.snare=current.snare.map(s=>({...s}));
    next.hat=current.hat.map(s=>({...s}));
  }
  if((authority?.bass||'assist')==='lock')next.bass=current.bass.map(s=>({...s}));
  if((authority?.synth||'assist')==='lock')next.synth=current.synth.map(s=>({...s}));
  return next;
};

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App(){
  // ── Audio
  const audioRef=useRef(null);
  const analyserRef=useRef(null);
  const [isReady,setIsReady]=useState(false);

  // ── Transport
  const [isPlaying,setIsPlaying]=useState(false);
  const isPlayingRef=useRef(false);
  const schedulerRef=useRef(null);
  const nextNoteRef=useRef(0);
  const stepRef=useRef(0);
  const [step,setStep]=useState(0);
  const [bpm,setBpm]=useState(128);
  const bpmRef=useRef(128);
  useEffect(()=>{bpmRef.current=bpm;},[bpm]);

  // ── Song state
  const [genre,setGenre]=useState('techno');
  const [currentSectionName,setCurrentSectionName]=useState('groove');
  const [modeName,setModeName]=useState('minor');
  const [songArc,setSongArc]=useState([]);
  const [selectedArcIdx,setSelectedArcIdx]=useState(0);
  const selectedArcIdxRef=useRef(0);
  useEffect(()=>{selectedArcIdxRef.current=selectedArcIdx;},[selectedArcIdx]);
  const [arcIdx,setArcIdx]=useState(0);
  const [songActive,setSongActive]=useState(false);
  const songActiveRef=useRef(false);
  const arcRef=useRef([]);
  const arcIdxRef=useRef(0);
  const barCountRef=useRef(0);// bars elapsed in current section
  const currentSectionRef=useRef('groove');
  useEffect(()=>{currentSectionRef.current=currentSectionName;},[currentSectionName]);

  // ── Patterns
  const [patterns,setPatterns]=useState({kick:mkSteps(),snare:mkSteps(),hat:mkSteps(),bass:mkSteps(),synth:mkSteps()});
  const patternsRef=useRef(patterns);
  useEffect(()=>{patternsRef.current=patterns;},[patterns]);
  const [bassLine,setBassLine]=useState(mkNotes('C2'));
  const bassRef=useRef(bassLine);
  useEffect(()=>{bassRef.current=bassLine;},[bassLine]);
  const [synthLine,setSynthLine]=useState(mkNotes('C4'));
  const synthRef=useRef(synthLine);
  useEffect(()=>{synthRef.current=synthLine;},[synthLine]);
  const [laneLen,setLaneLen]=useState({kick:16,snare:16,hat:32,bass:32,synth:32});
  const laneLenRef=useRef(laneLen);
  useEffect(()=>{laneLenRef.current=laneLen;},[laneLen]);

  // ── Parameters
  const [master,setMaster]=useState(0.85);
  const [swing,setSwing]=useState(0.03);
  const swingRef=useRef(0.03);
  useEffect(()=>{swingRef.current=swing;},[swing]);
  const [humanize,setHumanize]=useState(0.012);
  const humanizeRef=useRef(0.012);
  useEffect(()=>{humanizeRef.current=humanize;},[humanize]);
  const [grooveAmt,setGrooveAmt]=useState(0.65);
  const grooveRef=useRef(0.65);
  useEffect(()=>{grooveRef.current=grooveAmt;},[grooveAmt]);
  const [grooveProfile,setGrooveProfile]=useState('steady');
  const grooveProfileRef=useRef('steady');
  useEffect(()=>{grooveProfileRef.current=grooveProfile;},[grooveProfile]);
  const [space,setSpace]=useState(0.3);
  const [tone,setTone]=useState(0.7);
  const [noiseMix,setNoiseMix]=useState(0.2);
  const [drive,setDrive]=useState(0.1);
  const [compress,setCompress]=useState(0.3);
  const [bassFilter,setBassFilter]=useState(0.55);
  const [synthFilter,setSynthFilter]=useState(0.65);
  const [drumDecay,setDrumDecay]=useState(0.5);
  const [bassSubAmt,setBassSubAmt]=useState(0.5);
  const [fmIdx,setFmIdx]=useState(0.6);
  const fmIdxRef=useRef(0.6);
  useEffect(()=>{fmIdxRef.current=fmIdx;},[fmIdx]);
  const [polySynth,setPolySynth]=useState(true);
  const [bassStack,setBassStack]=useState(true);
  const [bassPreset,setBassPreset]=useState('sub_floor');
  const [synthPreset,setSynthPreset]=useState('velvet_pad');
  const [drumPreset,setDrumPreset]=useState('tight_punch');
  const [performancePreset,setPerformancePreset]=useState('club_night');
  const bassPresetCfg=getBassPresetCfg(bassPreset);
  const synthPresetCfg=getSynthPresetCfg(synthPreset);
  const drumPresetCfg=getDrumPresetCfg(drumPreset);
  const applyGenreBundleToState=(genreKey)=>{
    const bundle=GENRE_DEFAULT_PRESETS[genreKey]||GENRE_DEFAULT_PRESETS.techno;
    if(!bundle)return;
    const bassCfg=SOUND_PRESETS.bass[bundle.bass];
    const synthCfg=SOUND_PRESETS.synth[bundle.synth];
    const drumCfg=SOUND_PRESETS.drum[bundle.drum];
    const perfCfg=SOUND_PRESETS.performance[bundle.performance];
    if(bundle.bass&&bassCfg){setBassPreset(bundle.bass);}
    if(bundle.synth&&synthCfg){setSynthPreset(bundle.synth);}
    if(bundle.drum&&drumCfg){setDrumPreset(bundle.drum);}
    if(bundle.performance&&perfCfg){setPerformancePreset(bundle.performance);}
    const applyCfg=(preset)=>{
      if(!preset)return;
      if(preset.bassMode)GENRES[genreKey]={...GENRES[genreKey],bassMode:preset.bassMode};
      if(preset.synthMode)GENRES[genreKey]={...GENRES[genreKey],synthMode:preset.synthMode};
      if(preset.space!==undefined)setSpace(preset.space);
      if(preset.tone!==undefined)setTone(preset.tone);
      if(preset.drive!==undefined)setDrive(preset.drive);
      if(preset.compress!==undefined)setCompress(preset.compress);
      if(preset.noiseMix!==undefined)setNoiseMix(preset.noiseMix);
      if(preset.drumDecay!==undefined)setDrumDecay(preset.drumDecay);
      if(preset.bassFilter!==undefined)setBassFilter(preset.bassFilter);
      if(preset.synthFilter!==undefined)setSynthFilter(preset.synthFilter);
      if(preset.bassSubAmt!==undefined)setBassSubAmt(preset.bassSubAmt);
      if(preset.fmIdx!==undefined){setFmIdx(preset.fmIdx);fmIdxRef.current=preset.fmIdx;}
      if(preset.polySynth!==undefined)setPolySynth(preset.polySynth);
      if(preset.bassStack!==undefined)setBassStack(preset.bassStack);
      if(preset.grooveAmt!==undefined){setGrooveAmt(preset.grooveAmt);grooveRef.current=preset.grooveAmt;}
      if(preset.swing!==undefined){setSwing(preset.swing);swingRef.current=preset.swing;}
    };
    applyCfg(bassCfg);applyCfg(synthCfg);applyCfg(drumCfg);applyCfg(perfCfg);
  };
  const [soundCharacter,setSoundCharacter]=useState(getGenreSoundCharacter('techno'));
  const soundCharacterRef=useRef(getGenreSoundCharacter('techno'));
  useEffect(()=>{soundCharacterRef.current=soundCharacter;},[soundCharacter]);
  const [compositionEnergy,setCompositionEnergy]=useState(0.68);
  const compositionEnergyRef=useRef(0.68);
  useEffect(()=>{compositionEnergyRef.current=compositionEnergy;},[compositionEnergy]);
  const [patternAuthority,setPatternAuthority]=useState(defaultPatternAuthority());
  const patternAuthorityRef=useRef(defaultPatternAuthority());
  useEffect(()=>{patternAuthorityRef.current=patternAuthority;},[patternAuthority]);
  const [laneVolume,setLaneVolume]=useState(defaultLaneVolume());
  const laneVolumeRef=useRef(defaultLaneVolume());
  useEffect(()=>{laneVolumeRef.current=laneVolume;},[laneVolume]);
  const [laneProbability,setLaneProbability]=useState(defaultLaneProbability());
  const laneProbabilityRef=useRef(defaultLaneProbability());
  useEffect(()=>{laneProbabilityRef.current=laneProbability;},[laneProbability]);
  const [synthChordChance,setSynthChordChance]=useState(0.34);
  const synthChordChanceRef=useRef(0.34);
  useEffect(()=>{synthChordChanceRef.current=synthChordChance; if(typeof globalThis!=='undefined')globalThis.__CESIRA_SYNTH_CHORD_CHANCE__=synthChordChance;},[synthChordChance]);
  const [synthHold,setSynthHold]=useState(0.56);
  const synthHoldRef=useRef(0.56);
  useEffect(()=>{synthHoldRef.current=synthHold; if(typeof globalThis!=='undefined')globalThis.__CESIRA_SYNTH_HOLD__=synthHold;},[synthHold]);
  const [synthCurve,setSynthCurve]=useState('balanced');
  const synthCurveRef=useRef('balanced');
  useEffect(()=>{synthCurveRef.current=synthCurve; if(typeof globalThis!=='undefined')globalThis.__CESIRA_SYNTH_CURVE__=synthCurve;},[synthCurve]);

  // ── Autopilot
  const [autopilot,setAutopilot]=useState(false);
  const autopilotRef=useRef(false);
  useEffect(()=>{autopilotRef.current=autopilot;},[autopilot]);
  const autopilotBarRef=useRef(0);
  const autopilotActionBudgetRef=useRef(0);
  const autopilotStatusBootRef=useRef(false);
  const [autopilotIntensity,setAutopilotIntensity]=useState(0.5);

  // ── Composition seed for transformations
  const seedRef=useRef(null);
  const lastBassRef=useRef('C2');
  const progressionRef=useRef(CHORD_PROGS.minor[0]);
  const arpModeRef=useRef('up');
  const compositionRef=useRef(createCompositionBlueprint('techno','minor',CHORD_PROGS.minor[0],'up',SONG_ARCS[0]));
  const compositionCycleRef=useRef(0);
  const [arpMode,setArpMode]=useState('up');

  // ── UI state
  const [view,setView]=useState('perform');// 'perform' | 'studio' | 'song'
  const [activeTab,setActiveTab]=useState('mix');
  const [activeLane,setActiveLane]=useState('kick');
  const [laneVU,setLaneVU]=useState({kick:0,snare:0,hat:0,bass:0,synth:0});
  const vuTimers=useRef({});
  const [page,setPage]=useState(0);
  const [status,setStatus]=useState('Ready — press PLAY');
  const [recordings,setRecordings]=useState([]);
  const recordingUrlSetRef=useRef(new Set());
  const [recState,setRecState]=useState('idle');
  const recorderRef=useRef(null);
  const chunksRef=useRef([]);
  const [projectName,setProjectName]=useState('CESIRA SESSION');
  const [savedScenes,setSavedScenes]=useState([null,null,null,null,null,null]);
  const didHydrateRef=useRef(false);
  const persistTimerRef=useRef(null);
  const [midiOk,setMidiOk]=useState(false);
  const midiRef=useRef(null);
  const [tapTimes,setTapTimes]=useState([]);
  const undoStack=useRef([]);
  const redoStack=useRef([]);
  const [undoLen,setUndoLen]=useState(0);
  const [redoLen,setRedoLen]=useState(0);
  const [vizData,setVizData]=useState(new Uint8Array(64));
  const transportBarRef=useRef(0);

  // ── Active notes display
  const [activeNotes,setActiveNotes]=useState({bass:'—',synth:'—'});
  const setAuthorityForLane=useCallback((lane,value)=>{
    const key=laneAuthorityKey(lane);
    if(!PATTERN_AUTHORITY_LEVELS.includes(value))return;
    setPatternAuthority(prev=>{const next={...prev,[key]:value};patternAuthorityRef.current=next;return next;});
  },[]);

  const safeRevokeUrl=useCallback(url=>{
    if(!url)return;
    try{URL.revokeObjectURL(url);}catch{}
    recordingUrlSetRef.current.delete(url);
  },[]);

  const panicEngine=useCallback(async(message='Panic reset')=>{
    if(recorderRef.current?.state==='recording'){
      try{recorderRef.current.stop();}catch{}
    }
    autopilotBarRef.current=0;
    autopilotActionBudgetRef.current=0;
    stopClock();
    const a=audioRef.current;
    audioRef.current=null;
    analyserRef.current=null;
    laneGains.current={};
    activeNodes.current=0;
    setIsReady(false);
    setActiveNotes({bass:'—',synth:'—'});
    setLaneVU({kick:0,snare:0,hat:0,bass:0,synth:0});
    if(a){
      try{await a.ctx.close();}catch{}
    }
    setStatus(message);
  },[]);

  // ─── AUDIO ENGINE ─────────────────────────────────────────────────────────
  const driveCurve=(node,amt)=>{
    const k=2+clamp(amt,0,1)*60;const s=512;const c=new Float32Array(s);
    for(let i=0;i<s;i++){const x=(i*2)/s-1;c[i]=((1+k)*x)/(1+k*Math.abs(x));}
    node.curve=c;node.oversample='2x';
  };
  const identityCurve=node=>{const c=new Float32Array(512);for(let i=0;i<512;i++){c[i]=(i*2)/512-1;}node.curve=c;};
  const reverbIR=(ctx,dur=1.2,dec=2.6)=>{const sr=ctx.sampleRate,l=Math.floor(sr*dur);const b=ctx.createBuffer(2,l,sr);for(let ch=0;ch<2;ch++){const d=b.getChannelData(ch);for(let i=0;i<l;i++)d[i]=(rnd()*2-1)*Math.pow(1-i/l,dec);}return b;};

  const initAudio=async()=>{
    if(audioRef.current){await audioRef.current.ctx.resume();setIsReady(true);return;}
    const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;
    const ctx=new Ctx({sampleRate:44100,latencyHint:'interactive'});
    const bus=ctx.createGain();bus.gain.value=0.62;
    const preD=ctx.createWaveShaper();identityCurve(preD);
    const toneF=ctx.createBiquadFilter();toneF.type='lowpass';toneF.frequency.value=16000;toneF.Q.value=0.35;
    const comp=ctx.createDynamicsCompressor();comp.threshold.value=-24;comp.knee.value=18;comp.ratio.value=3;comp.attack.value=0.008;comp.release.value=0.22;
    const lim=ctx.createDynamicsCompressor();lim.threshold.value=-3;lim.knee.value=0;lim.ratio.value=20;lim.attack.value=0.001;lim.release.value=0.04;
    const dry=ctx.createGain(),wet=ctx.createGain();dry.gain.value=1;wet.gain.value=0;
    const spl=ctx.createChannelSplitter(2),mrg=ctx.createChannelMerger(2);
    const lDly=ctx.createDelay(0.5),rDly=ctx.createDelay(0.5),fb=ctx.createGain(),dlyT=ctx.createBiquadFilter();
    dlyT.type='lowpass';dlyT.frequency.value=4500;fb.gain.value=0.15;
    const chorus=ctx.createGain();chorus.gain.value=0;
    const cD1=ctx.createDelay(0.025),cD2=ctx.createDelay(0.031);
    const rev=ctx.createConvolver();rev.buffer=reverbIR(ctx);
    const revW=ctx.createGain();revW.gain.value=0;
    const out=ctx.createGain();out.gain.value=0.88;
    const an=ctx.createAnalyser();an.fftSize=256;an.smoothingTimeConstant=0.8;
    const dest=ctx.createMediaStreamDestination();
    bus.connect(preD);preD.connect(toneF);toneF.connect(comp);
    comp.connect(dry);comp.connect(spl);comp.connect(cD1);comp.connect(cD2);comp.connect(rev);
    cD1.connect(chorus);cD2.connect(chorus);rev.connect(revW);
    spl.connect(lDly,0);spl.connect(rDly,1);rDly.connect(dlyT);dlyT.connect(fb);fb.connect(lDly);
    lDly.connect(mrg,0,0);rDly.connect(mrg,0,1);mrg.connect(wet);
    dry.connect(out);wet.connect(out);chorus.connect(out);revW.connect(out);
    out.connect(lim);lim.connect(an);lim.connect(ctx.destination);lim.connect(dest);
    audioRef.current={ctx,bus,preD,toneF,comp,lim,dry,wet,lDly,rDly,fb,chorus,revW,out,an,dest};
    analyserRef.current=an;
    setIsReady(true);setStatus('Audio online');
    applyFxNow();
  };

  const applyFxNow=()=>{
    const a=audioRef.current;if(!a)return;
    const now=a.ctx.currentTime;
    const gd=GENRES[genre];const fx=gd.fxProfile;
    driveCurve(a.preD,clamp(fx.drive*0.4+drive*0.1,0,0.38));
    a.toneF.frequency.linearRampToValueAtTime(clamp(1800+12000*fx.tone*tone,600,19000),now+0.08);
    a.lDly.delayTime.linearRampToValueAtTime(clamp(0.02+space*0.08,0.01,0.45),now+0.08);
    a.rDly.delayTime.linearRampToValueAtTime(clamp(0.03+space*0.1,0.01,0.45),now+0.08);
    a.fb.gain.linearRampToValueAtTime(clamp(0.06+space*0.2,0.03,0.4),now+0.08);
    a.wet.gain.linearRampToValueAtTime(clamp(space*0.18,0,0.25),now+0.08);
    a.dry.gain.linearRampToValueAtTime(clamp(0.95-space*0.08,0.72,0.97),now+0.08);
    a.chorus.gain.linearRampToValueAtTime(clamp(space*0.08,0,0.14),now+0.12);
    a.revW.gain.linearRampToValueAtTime(clamp(fx.space*space*0.22,0,0.28),now+0.14);
    a.comp.attack.value=clamp(0.006+compress*0.012,0.004,0.03);
    a.comp.release.value=clamp(0.16+space*0.2+compress*0.12,0.12,0.42);
    a.out.gain.linearRampToValueAtTime(master,now+0.06);
    a.comp.threshold.value=clamp(-20-compress*12,-32,-6);
    a.comp.ratio.value=clamp(2+compress*5,1.5,8);
  };
  useEffect(()=>{if(audioRef.current)applyFxNow();},[space,tone,drive,compress,master,genre]);

  // Per-lane gain nodes
  const laneGains=useRef({});
  const getLaneGain=(lane)=>{
    const a=audioRef.current;if(!a)return null;
    if(!laneGains.current[lane]){const g=a.ctx.createGain();g.gain.value=laneVolumeRef.current[lane]??1;g.connect(a.bus);laneGains.current[lane]=g;}
    return laneGains.current[lane];
  };
  useEffect(()=>{
    const a=audioRef.current;if(!a)return;
    Object.entries(laneVolume).forEach(([lane,val])=>{
      const g=getLaneGain(lane);if(!g)return;
      try{g.gain.cancelScheduledValues(a.ctx.currentTime);g.gain.setTargetAtTime(clamp(val,0,1.2),a.ctx.currentTime,0.02);}catch{g.gain.value=clamp(val,0,1.2);}
    });
  },[laneVolume,isReady]);

  const ss=(n,t)=>{try{n.start(t);}catch{}};
  const st=(n,t)=>{try{n.stop(t);}catch{}};
  const gc=(src,nodes,ms)=>{const fn=()=>[src,...nodes].forEach(n=>{try{n.disconnect();}catch{}});src.onended=fn;setTimeout(fn,ms);};
  const activeNodes=useRef(0);
  const nodeGuard=()=>activeNodes.current<90;
  const trackNode=ms=>{activeNodes.current++;setTimeout(()=>{activeNodes.current=Math.max(0,activeNodes.current-1);},ms+80);};

  const flashLane=useCallback((lane,level=1)=>{
    setLaneVU(p=>({...p,[lane]:Math.min(1,level)}));
    if(vuTimers.current[lane])clearInterval(vuTimers.current[lane]);
    vuTimers.current[lane]=setInterval(()=>setLaneVU(p=>{const nv=Math.max(0,p[lane]-0.2);if(nv<=0)clearInterval(vuTimers.current[lane]);return{...p,[lane]:nv};}),55);
  },[]);

  const noiseBuffer=(len=0.22,amt=1,color='white')=>{
    const a=audioRef.current;const sr=a.ctx.sampleRate;
    const b=a.ctx.createBuffer(1,Math.floor(sr*len),sr);const d=b.getChannelData(0);
    if(color==='white'){for(let i=0;i<d.length;i++)d[i]=(rnd()*2-1)*amt;return b;}
    let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0;
    for(let i=0;i<d.length;i++){
      const w=rnd()*2-1;
      if(color==='pink'){b0=0.99886*b0+w*0.0555179;b1=0.99332*b1+w*0.0750759;b2=0.969*b2+w*0.153852;b3=0.8665*b3+w*0.310486;b4=0.55*b4+w*0.532952;b5=-0.7616*b5-w*0.016898;d[i]=(b0+b1+b2+b3+b4+b5+w*0.5362)*amt*0.11;}
      else{b0=0.99*b0+w*0.01;d[i]=b0*amt*3;}
    }
    return b;
  };

  const stepSec=()=>(60/bpmRef.current)/4;
  const laneHash=(lane,step,bar=0,extra=0)=>{
    const base=(lane.charCodeAt(0)*131+lane.length*17+step*37+bar*53+extra*97)%997;
    return (Math.sin(base*12.9898)*43758.5453)%1;
  };
  const humanizeEvent=(lane,step,bar,accent=1)=>{
    const laneScale=lane==='hat'?1.35:lane==='snare'?1.1:lane==='kick'?0.72:lane==='bass'?0.95:0.9;
    const jitter=((laneHash(lane,step,bar,1)+laneHash(lane,step,bar,2))*0.5-0.5)*humanizeRef.current*0.03*laneScale;
    const velShape=1+((laneHash(lane,step,bar,3)-0.5)*0.22*laneScale);
    const toneShift=(laneHash(lane,step,bar,4)-0.5)*0.22;
    const decayShift=(laneHash(lane,step,bar,5)-0.5)*0.18;
    return {
      jitter,
      accent:clamp(accent*velShape,0.08,1.18),
      toneShift,
      decayShift,
      variant:laneHash(lane,step,bar,6)>0.5?1:0,
    };
  };
  const drumRuntimeVariation=(lane,step,bar)=>{
    const pos=step%16;
    const every2=bar%2===1;
    const every4=bar%4===3;
    const every8=bar%8===7;
    const out={extra:false,ghost:false,accentMul:1,openBias:0,variantBias:0};
    if(lane==='hat'){
      if(every2&&(pos===7||pos===15))out.accentMul=1.08;
      if(every4&&(pos===11||pos===13))out.extra=true;
      if(every8&&pos>=12)out.openBias=0.08+(pos-12)*0.025;
      if((bar+pos)%3===0)out.variantBias=0.18;
      if(genre==='house' && (pos===3||pos===11))out.accentMul*=1.08;
      if(genre==='acid' && (pos===5||pos===13))out.openBias+=0.04;
      if(genre==='dnb' && (pos===2||pos===10||pos===14))out.extra=true;
      if(genre==='cinematic' && (pos===12||pos===15))out.openBias+=0.06;
      if(genre==='ambient' && (pos===6||pos===14))out.openBias+=0.08;
      if(genre==='industrial')out.variantBias+=0.08;
    } else if(lane==='snare'){
      if(every2&&(pos===4||pos===12))out.ghost=true;
      if(every4&&pos===15)out.extra=true;
      if(every8&&(pos===14||pos===15))out.accentMul=1.12;
      if(pos===12)out.variantBias=0.22;
      if(genre==='dnb' && (pos===10||pos===14))out.ghost=true;
      if(genre==='house' && pos===12)out.accentMul*=1.06;
      if(genre==='cinematic' && (pos===12||pos===15))out.accentMul*=1.08;
      if(genre==='industrial' && (pos===15||pos===7))out.extra=true;
    } else if(lane==='kick'){
      if(every2&&(pos===0||pos===8))out.accentMul=1.05;
      if(every4&&pos===14)out.extra=true;
      if(every8&&pos>=12)out.accentMul=1.08;
      if(pos===0||pos===14)out.variantBias=0.16;
      if(genre==='techno' && (pos===10||pos===15))out.extra=out.extra||rnd()<0.22;
      if(genre==='house' && pos===10)out.accentMul*=1.04;
      if(genre==='dnb' && pos===6)out.extra=out.extra||rnd()<0.18;
      if(genre==='cinematic' && pos===12)out.accentMul*=1.06;
      if(genre==='industrial')out.variantBias+=0.1;
    }
    return out;
  };
  const duckMixFromKick=(accent,t)=>{
    const bassGain=laneGains.current.bass;
    const synthGain=laneGains.current.synth;
    const duckAmt=clamp(0.84-(accent*0.12+compress*0.05),0.66,0.9);
    [['bass',bassGain],['synth',synthGain]].forEach(([lane,g],idx)=>{
      if(!g)return;
      const release=idx===0?0.12:0.18;
      const base=clamp(laneVolumeRef.current[lane]??1,0.001,1.2);
      try{
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(Math.max(0.001,g.gain.value||base),t);
        g.gain.linearRampToValueAtTime(Math.max(0.001,base*duckAmt),t+0.008);
        g.gain.exponentialRampToValueAtTime(Math.max(0.001,base),t+release);
      }catch{}
    });
  };

  // ─── DRUM SYNTHESIS ────────────────────────────────────────────────────────
  const playKick=(accent,t,variation={})=>{
    if(!nodeGuard())return;
    const a=audioRef.current;const gd=GENRES[genre];
    const charCfg=getCharacterConfig(soundCharacterRef.current);
    const energy=compositionEnergyRef.current;
    const kickTone=clamp((drumPresetCfg.kickTone??0.6)+charCfg.toneBias*0.5+(variation.toneShift||0)+(variation.variantBias||0)+energy*0.04,0.2,1);
    const kf=gd.kickFreq||90,ke=gd.kickEnd||35;
    const startFreq=clamp(kf*(0.92+kickTone*0.4),45,140);
    const endFreq=clamp(ke*(0.8+kickTone*0.45),20,70);
    const et=0.06+drumDecay*0.14+(1-kickTone)*0.03+Math.max(-0.015,(variation.decayShift||0)*0.03),dt=0.13+drumDecay*0.24+(1-kickTone)*0.04+Math.max(-0.03,(variation.decayShift||0)*0.05);
    const body=a.ctx.createOscillator(),bG=a.ctx.createGain();
    const punch=a.ctx.createOscillator(),pG=a.ctx.createGain();
    const sub=a.ctx.createOscillator(),sG=a.ctx.createGain();
    const click=a.ctx.createBufferSource(),cG=a.ctx.createGain();
    const mG=a.ctx.createGain(),sh=a.ctx.createWaveShaper(),bodyF=a.ctx.createBiquadFilter();
    body.type=(variation.variant? (kickTone>0.68?'triangle':'sine') : (kickTone>0.8?'triangle':'sine'));
    body.frequency.setValueAtTime(startFreq,t);body.frequency.exponentialRampToValueAtTime(Math.max(20,endFreq),t+et);
    punch.type=variation.variant?(kickTone>0.56?'square':'triangle'):(kickTone>0.72?'square':'triangle');
    punch.frequency.setValueAtTime(startFreq*1.9,t);punch.frequency.exponentialRampToValueAtTime(Math.max(30,endFreq*1.4),t+Math.max(0.018,et*0.45));
    sub.type='sine';sub.frequency.setValueAtTime(startFreq*0.5,t);sub.frequency.exponentialRampToValueAtTime(Math.max(18,endFreq*0.5),t+et*1.05);
    const cb=a.ctx.createBuffer(1,Math.floor(a.ctx.sampleRate*0.0045),a.ctx.sampleRate);
    const cd=cb.getChannelData(0);for(let i=0;i<cd.length;i++)cd[i]=(rnd()*2-1)*(1-i/cd.length);
    click.buffer=cb;bodyF.type='lowpass';bodyF.frequency.value=clamp(500+kickTone*1800+(tone+charCfg.toneBias)*400+energy*160,280,3600);driveCurve(sh,0.08+(noiseMix+charCfg.noiseBias)*0.08+(drive+charCfg.driveBias)*0.05+kickTone*0.08+energy*0.02);
    bG.gain.setValueAtTime(0,t);bG.gain.linearRampToValueAtTime((0.66+kickTone*0.22)*accent,t+0.0012);bG.gain.exponentialRampToValueAtTime(0.001,t+dt);
    pG.gain.setValueAtTime(0,t);pG.gain.linearRampToValueAtTime((0.08+kickTone*0.18)*accent,t+0.0008);pG.gain.exponentialRampToValueAtTime(0.001,t+Math.max(0.022,dt*0.28));
    sG.gain.setValueAtTime(0,t);sG.gain.linearRampToValueAtTime((0.26+bassSubAmt*0.42)*(1-kickTone*0.2)*accent,t+0.001);sG.gain.exponentialRampToValueAtTime(0.001,t+dt*1.25);
    cG.gain.setValueAtTime(0,t);cG.gain.linearRampToValueAtTime((0.1+kickTone*0.26+noiseMix*0.1)*accent,t+0.0005);cG.gain.exponentialRampToValueAtTime(0.001,t+0.0048+kickTone*0.003);
    body.connect(bodyF);bodyF.connect(sh);sh.connect(bG);punch.connect(pG);sub.connect(sG);click.connect(cG);
    bG.connect(mG);pG.connect(mG);sG.connect(mG);cG.connect(mG);
    const dest=getLaneGain('kick')||a.bus;mG.connect(dest);
    duckMixFromKick(accent,t);
    const dur=(dt+0.12)*1000+220;trackNode(dur);
    gc(body,[bodyF,punch,sub,click,bG,pG,sG,cG,mG,sh],dur);
    ss(body,t);ss(punch,t);ss(sub,t);ss(click,t);st(body,t+dt+0.06);st(punch,t+dt*0.4+0.03);st(sub,t+dt+0.1);st(click,t+0.01);
  };

  const playSnare=(accent,t,variation={})=>{
    if(!nodeGuard())return;
    const a=audioRef.current;const gd=GENRES[genre];
    const charCfg=getCharacterConfig(soundCharacterRef.current);
    const energy=compositionEnergyRef.current;
    const snareTone=clamp((drumPresetCfg.snareTone??0.6)+charCfg.toneBias*0.45+(variation.toneShift||0)+(variation.variantBias||0)+energy*0.03,0.18,1);
    const nb=noiseBuffer(0.16+drumDecay*0.08+Math.max(-0.03,(variation.decayShift||0)*0.04),0.18+noiseMix*0.46+(variation.ghost?0.03:0),gd.noiseColor||'white');
    const src=a.ctx.createBufferSource(),fil=a.ctx.createBiquadFilter(),bp=a.ctx.createBiquadFilter(),snap=a.ctx.createBiquadFilter(),g=a.ctx.createGain();
    const osc=a.ctx.createOscillator(),og=a.ctx.createGain();
    const snapNoise=a.ctx.createBufferSource(),snapG=a.ctx.createGain();
    const snapBuf=noiseBuffer(0.018+noiseMix*0.01,0.46,'white');
    src.buffer=nb; snapNoise.buffer=snapBuf;
    fil.type='bandpass';fil.frequency.value=1200+snareTone*1400+noiseMix*300;fil.Q.value=0.8+compress*0.5+(variation.variant?0.25:0);
    bp.type='highpass';bp.frequency.value=clamp(180+snareTone*260,120,520);
    snap.type='bandpass';snap.frequency.value=clamp(2400+snareTone*1800+(variation.variant?320:0),1800,5200);snap.Q.value=1.1+(variation.ghost?0.2:0.5);
    osc.type=snareTone>0.64?'triangle':'sine';osc.frequency.value=clamp(150+snareTone*110,140,320);
    og.gain.setValueAtTime(0,t);og.gain.linearRampToValueAtTime((0.06+snareTone*0.2)*(variation.ghost?0.55:1)*accent,t+0.001);og.gain.exponentialRampToValueAtTime(0.001,t+0.045+drumDecay*0.08);
    snapG.gain.setValueAtTime(0,t);snapG.gain.linearRampToValueAtTime((0.08+snareTone*0.12+energy*0.04)*(variation.ghost?0.4:1)*accent,t+0.0007);snapG.gain.exponentialRampToValueAtTime(0.001,t+0.022+drumDecay*0.02);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime((0.34+snareTone*0.24)*(variation.ghost?0.52:1)*accent,t+0.002);g.gain.exponentialRampToValueAtTime(0.001,t+0.05+drumDecay*0.13);
    src.connect(fil);fil.connect(bp);bp.connect(g);osc.connect(og);og.connect(g);snapNoise.connect(snap);snap.connect(snapG);snapG.connect(g);
    const dest=getLaneGain('snare')||a.bus;g.connect(dest);
    gc(src,[fil,bp,snap,g,osc,og,snapNoise,snapG],520);ss(src,t);ss(osc,t);ss(snapNoise,t);st(src,t+0.2);st(osc,t+0.08+drumDecay*0.06);st(snapNoise,t+0.03);
  };

  const playHat=(accent,t,open=false,variation={})=>{
    if(!nodeGuard())return;
    const a=audioRef.current;const gd=GENRES[genre];
    const charCfg=getCharacterConfig(soundCharacterRef.current);
    const energy=compositionEnergyRef.current;
    const hatTone=clamp((drumPresetCfg.hatTone??0.8)+charCfg.toneBias*0.55+(variation.toneShift||0)+(variation.variantBias||0)+energy*0.02,0.22,1);
    const nb=noiseBuffer(open?0.26+drumDecay*0.08+Math.max(-0.02,(variation.decayShift||0)*0.04):0.08+drumDecay*0.04+Math.max(-0.01,(variation.decayShift||0)*0.015),0.14+noiseMix*0.32+(variation.variant?0.02:0),gd.noiseColor||'white');
    const src=a.ctx.createBufferSource(),hp=a.ctx.createBiquadFilter(),bp=a.ctx.createBiquadFilter(),air=a.ctx.createBiquadFilter(),g=a.ctx.createGain();
    src.buffer=nb;hp.type='highpass';hp.frequency.value=open?clamp(5200+hatTone*2200,4200,9200):clamp(6800+hatTone*2400,5800,12000);
    bp.type='bandpass';bp.frequency.value=open?clamp(7600+hatTone*2600+(variation.variant?260:-120),6200,12000):clamp(9000+hatTone*2200+(variation.variant?-320:180),7600,14000);bp.Q.value=open?(variation.variant?0.75:0.9):(variation.variant?1.1:1.4);
    air.type='highshelf';air.frequency.value=clamp(7000+hatTone*3200,6200,15000);air.gain.value=variation.variant?2.8:1.8+energy*1.2;
    const decay=open?0.05+drumDecay*0.22+hatTone*0.02:0.006+drumDecay*0.032+(1-hatTone)*0.01;
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime((0.18+hatTone*0.18)*accent,t+0.0009);g.gain.exponentialRampToValueAtTime(0.001,t+decay);
    src.connect(hp);hp.connect(bp);bp.connect(air);air.connect(g);const dest=getLaneGain('hat')||a.bus;g.connect(dest);
    gc(src,[hp,bp,air,g],650);ss(src,t);st(src,t+(open?0.35:0.15));
  };


  const getVoiceNotes=(baseNote,lane='synth')=>{
    const mode=MODES[modeName]||MODES.minor;
    const pool=lane==='bass'?mode.b:mode.s;
    const idx=pool.indexOf(baseNote);
    if(lane==='bass'){
      if(!bassStack)return [baseNote];
      const fifth=idx>-1?pool[Math.min(idx+4,pool.length-1)]:transposeNote(baseNote,7);
      const octave=idx>-1?pool[Math.min(idx+7,pool.length-1)]:transposeNote(baseNote,12);
      const notes=[baseNote,fifth];
      if((compositionRef.current?.narrativeProfile?.polyDepth||3)>3 && currentSectionRef.current==='drop')notes.push(octave);
      return [...new Set(notes.filter(Boolean))];
    }
    if(Array.isArray(baseNote))return baseNote;
    if(!polySynth)return [baseNote];
    const profile=compositionRef.current?.narrativeProfile||getGenreNarrativeProfile(genre);
    const forcedStyle=compositionRef.current?.sectionPlans?.[currentSectionRef.current||'groove']?.chordStyle;
    const style=forcedStyle||chooseChordStyle(currentSectionRef.current||'groove',genre,synthCurveRef.current||'balanced',profile);
    const voicing=getSynthChordVoicing(idx===-1?baseNote:pool[idx],pool,currentSectionRef.current||'groove',style,null,profile);
    return [...new Set((voicing&&voicing.length?voicing:[baseNote,transposeNote(baseNote,4),transposeNote(baseNote,7)]).filter(Boolean))];
  };

  // ─── BASS SYNTHESIS ────────────────────────────────────────────────────────
  const playBassVoice=(note,accent,t,lenSteps=1)=>{
    if(!nodeGuard())return;
    const a=audioRef.current;
    const f=NOTE_FREQ[note]||110;
    const dur=clamp(stepSec()*lenSteps*0.92,0.04,6);
    const atk=Math.min(0.008,dur*0.05);
    const rel=Math.max(0.04,dur*0.88);
    const mode=bassPresetCfg.bassMode||GENRES[genre].bassMode||'sub';
    const charCfg=getCharacterConfig(soundCharacterRef.current);
    const energy=compositionEnergyRef.current;
    const g=a.ctx.createGain(),fil=a.ctx.createBiquadFilter();
    fil.type='lowpass';fil.frequency.setValueAtTime(60+(bassFilter+charCfg.bassFilterBias)*3000+(tone+charCfg.toneBias)*500+bassPresetCfg.bassPunch*500+energy*180,t);fil.frequency.linearRampToValueAtTime(clamp(110+(bassFilter+charCfg.bassFilterBias)*3600+(bassPresetCfg.bassMotion*540)+(tone+charCfg.toneBias)*380+energy*260,90,4200),t+Math.min(0.16,dur*0.34));fil.Q.value=0.45+compress*2.6+bassPresetCfg.bassMotion*1.2+energy*0.35;
    const bassPeak=0.46+bassPresetCfg.bassPunch*0.22;
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(bassPeak*accent,t+atk);g.gain.setValueAtTime(bassPeak*accent,t+rel*(0.22+bassPresetCfg.bassPunch*0.18));g.gain.linearRampToValueAtTime((0.18+bassPresetCfg.bassPunch*0.08)*accent,t+rel*(0.56+bassPresetCfg.bassMotion*0.08));g.gain.exponentialRampToValueAtTime(0.0001,t+rel);
    const cleanMs=(rel+0.3)*1000;

    if(mode==='fm'||mode==='bit'){
      const idx=fmIdxRef.current*(mode==='bit'?3:1.5);
      const car=a.ctx.createOscillator(),mod=a.ctx.createOscillator(),mg=a.ctx.createGain();
      car.type='sine';car.frequency.value=f;mod.type='sine';mod.frequency.value=f*(mode==='fm'?2:3.2+bassPresetCfg.bassMotion*0.4);mg.gain.value=f*idx*(0.75+bassPresetCfg.bassPunch*0.35);
      const sub=a.ctx.createOscillator(),sg=a.ctx.createGain();
      sub.type='sine';sub.frequency.value=f*0.5;sg.gain.value=bassSubAmt*0.4;
      mod.connect(mg);mg.connect(car.frequency);car.connect(fil);sub.connect(sg);sg.connect(fil);fil.connect(g);
      const dest=getLaneGain('bass')||a.bus;g.connect(dest);trackNode(cleanMs);
      gc(car,[mod,mg,sub,sg,fil,g],cleanMs);
      ss(car,t);ss(mod,t);ss(sub,t);st(car,t+rel+0.05);st(mod,t+rel+0.05);st(sub,t+rel+0.05);
    } else if(mode==='fold'||mode==='wet'){
      const car=a.ctx.createOscillator(),ring=a.ctx.createOscillator(),rm=a.ctx.createGain();
      car.type='sawtooth';car.frequency.value=f;ring.type='sine';ring.frequency.value=f*(mode==='fold'?1.35+bassPresetCfg.bassMotion*0.4:0.7+bassPresetCfg.bassMotion*0.2);
      rm.gain.value=0.5;const rg=a.ctx.createGain();rg.gain.value=0;ring.connect(rg);rg.connect(rm.gain);
      car.connect(rm);rm.connect(fil);
      const sub=a.ctx.createOscillator(),sg=a.ctx.createGain();
      sub.type='sine';sub.frequency.value=f*0.5;sg.gain.value=bassSubAmt*0.5;
      sub.connect(sg);sg.connect(fil);fil.connect(g);
      const dest=getLaneGain('bass')||a.bus;g.connect(dest);trackNode(cleanMs);
      gc(car,[ring,rm,rg,sub,sg,fil,g],cleanMs);
      ss(car,t);ss(ring,t);ss(sub,t);st(car,t+rel+0.05);st(ring,t+rel+0.05);st(sub,t+rel+0.05);
    } else if(mode==='harmonic'){
      const o1=a.ctx.createOscillator(),o2=a.ctx.createOscillator(),o3=a.ctx.createOscillator();
      const mix=a.ctx.createGain(),bp=a.ctx.createBiquadFilter(),sat=a.ctx.createWaveShaper(),motion=a.ctx.createOscillator(),mg=a.ctx.createGain();
      o1.type='triangle';o2.type='square';o3.type='sine';
      o1.frequency.value=f;o2.frequency.value=f*2;o3.frequency.value=f*1.5;
      mix.gain.value=0.26;bp.type='bandpass';bp.frequency.value=220+(bassFilter+charCfg.bassFilterBias)*1800+(tone+charCfg.toneBias)*200;bp.Q.value=0.7+bassPresetCfg.bassPunch*2.1;
      driveCurve(sat,clamp(0.16+drive*0.18+bassPresetCfg.bassPunch*0.1,0.08,0.46));
      motion.frequency.value=0.18+bassPresetCfg.bassMotion*0.66;mg.gain.value=80+bassPresetCfg.bassMotion*180;
      motion.connect(mg);mg.connect(bp.frequency);
      o1.connect(mix);o2.connect(mix);o3.connect(mix);mix.connect(bp);bp.connect(sat);sat.connect(fil);
      const sub=a.ctx.createOscillator(),sg=a.ctx.createGain();sub.type='sine';sub.frequency.value=f*0.5;sg.gain.value=bassSubAmt*0.36;sub.connect(sg);sg.connect(fil);
      fil.connect(g);
      const dest=getLaneGain('bass')||a.bus;g.connect(dest);trackNode(cleanMs);
      gc(o1,[o2,o3,sub,sg,mix,bp,sat,motion,mg,fil,g],cleanMs);
      ss(o1,t);ss(o2,t);ss(o3,t);ss(sub,t);ss(motion,t);st(o1,t+rel+0.06);st(o2,t+rel+0.06);st(o3,t+rel+0.06);st(sub,t+rel+0.08);st(motion,t+rel+0.06);
    } else if(mode==='reese'){
      const det=Math.max(0.008,bassPresetCfg.bassDetune??0.018);
      const o1=a.ctx.createOscillator(),o2=a.ctx.createOscillator(),sub=a.ctx.createOscillator();
      const width=a.ctx.createGain(),sg=a.ctx.createGain();
      const mover=a.ctx.createOscillator(),mg=a.ctx.createGain();
      o1.type='sawtooth';o2.type='sawtooth';sub.type='sine';
      o1.frequency.value=f*(1-det);o2.frequency.value=f*(1+det);sub.frequency.value=f*0.5;
      width.gain.value=0.46;sg.gain.value=bassSubAmt*0.46;
      mover.frequency.value=0.12+bassPresetCfg.bassMotion*0.8;
      mg.gain.value=80+bassPresetCfg.bassMotion*260+bassPresetCfg.bassPunch*60;
      mover.connect(mg);mg.connect(fil.frequency);
      o1.connect(width);o2.connect(width);sub.connect(sg);width.connect(fil);sg.connect(fil);fil.connect(g);
      const dest=getLaneGain('bass')||a.bus;g.connect(dest);trackNode(cleanMs);
      gc(o1,[o2,sub,width,sg,mover,mg,fil,g],cleanMs);
      ss(o1,t);ss(o2,t);ss(sub,t);ss(mover,t);st(o1,t+rel+0.08);st(o2,t+rel+0.08);st(sub,t+rel+0.1);st(mover,t+rel+0.08);
    } else if(mode==='pluck'){
      const pluckRel=Math.max(0.09,rel*0.48);
      const o1=a.ctx.createOscillator(),o2=a.ctx.createOscillator();
      const bite=a.ctx.createBiquadFilter(),sg=a.ctx.createGain();
      o1.type='square';o2.type='triangle';
      o1.frequency.value=f;o2.frequency.value=f*(1+(bassPresetCfg.bassDetune??0.006));
      bite.type='lowpass';bite.frequency.setValueAtTime(clamp(260+(bassFilter+charCfg.bassFilterBias)*4200+(tone+charCfg.toneBias)*700,180,4800),t);
      bite.frequency.exponentialRampToValueAtTime(clamp(90+(bassFilter+charCfg.bassFilterBias)*900,80,1800),t+pluckRel*0.6);
      bite.Q.value=0.9+bassPresetCfg.bassPunch*2.2;
      sg.gain.value=bassSubAmt*0.22;
      g.gain.cancelScheduledValues(t);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime((0.54+bassPresetCfg.bassPunch*0.24)*accent,t+0.002);g.gain.exponentialRampToValueAtTime(0.0001,t+pluckRel);
      o1.connect(bite);o2.connect(bite);bite.connect(g);
      const sub=a.ctx.createOscillator();sub.type='sine';sub.frequency.value=f*0.5;sub.connect(sg);sg.connect(bite);
      const dest=getLaneGain('bass')||a.bus;g.connect(dest);trackNode(cleanMs);
      gc(o1,[o2,sub,bite,sg,fil,g],cleanMs);
      ss(o1,t);ss(o2,t);ss(sub,t);st(o1,t+pluckRel+0.03);st(o2,t+pluckRel+0.03);st(sub,t+pluckRel+0.05);
    } else {
      const o1=a.ctx.createOscillator(),o2=a.ctx.createOscillator();
      const types={sub:'sine',grit:'sawtooth',drone:'sawtooth',saw:'sawtooth',pulse:'square'};
      o1.type=types[mode]||'sawtooth';o2.type=mode==='pulse'?'square':'sine';
      o1.frequency.value=f;o2.frequency.value=f*(1+(bassPresetCfg.bassDetune??0.005));
      const sg=a.ctx.createGain();sg.gain.value=bassSubAmt*(mode==='sub'?0.85:mode==='saw'?0.42:0.3);
      const lfo=a.ctx.createOscillator(),lg=a.ctx.createGain();
      lfo.frequency.value=0.35+bassPresetCfg.bassMotion*0.9;lg.gain.value=mode==='drone'?18+bassPresetCfg.bassMotion*28:mode==='saw'?10+bassPresetCfg.bassMotion*18:4+bassPresetCfg.bassMotion*10;
      lfo.connect(lg);lg.connect(fil.frequency);
      o1.connect(fil);o2.connect(sg);sg.connect(fil);fil.connect(g);
      const dest=getLaneGain('bass')||a.bus;g.connect(dest);trackNode(cleanMs);
      gc(o1,[o2,lfo,sg,fil,g,lg],cleanMs);
      ss(o1,t);ss(o2,t);ss(lfo,t);st(o1,t+rel+0.05);st(o2,t+rel+0.05);st(lfo,t+rel+0.05);
    }
    if(midiRef.current){const out=[...midiRef.current.outputs.values()][0];if(out){const v=Math.round(clamp(accent,0,1)*127);out.send([0x93,NOTE_MIDI[note]||48,v]);setTimeout(()=>out.send([0x83,NOTE_MIDI[note]||48,0]),rel*1000);}}
  };
  const playBass=(note,accent,t,lenSteps=1)=>{
    const notes=Array.isArray(note)?note:getVoiceNotes(note,'bass');
    const voiceAccent=accent/Math.sqrt(Math.max(1,notes.length));
    notes.forEach((voice,idx)=>playBassVoice(voice,voiceAccent,t+idx*0.002,lenSteps));
    setActiveNotes(p=>({...p,bass:notes.join(' · ')}));
  };

  // ─── SYNTH SYNTHESIS — extended with richer voices ───────────────────────
  const playSynthVoice=(note,accent,t,lenSteps=1)=>{
    if(!nodeGuard())return;
    const a=audioRef.current;
    const f=NOTE_FREQ[note]||440;
    const baseDur=stepSec()*lenSteps*0.92;
    const mode=synthPresetCfg.synthMode||GENRES[genre].synthMode||'lead';
    const charCfg=getCharacterConfig(soundCharacterRef.current);
    const energy=compositionEnergyRef.current;
    const synthDetune=synthPresetCfg.synthDetune??0.008;
    const synthMotion=synthPresetCfg.synthMotion??0.3;
    const synthPunch=synthPresetCfg.synthPunch??0.5;
    const curve=synthCurveRef.current||'balanced';
    const holdBoost=1+synthHoldRef.current*(curve==='bloom'?1.35:curve==='soft'?1.12:curve==='snappy'?0.35:curve==='glass'?0.82:0.9);
    const dur=clamp(baseDur*holdBoost,0.05,10);
    const cleanMs=(dur+1.5)*1000;

    if(mode==='glass'||mode==='bell'){
      const atk=curve==='soft'?0.003:0.001,rel=Math.max(curve==='snappy'?0.22:0.3,dur*(curve==='bloom'?1.55:1.2)+synthFilter*(curve==='glass'?1.6:2));
      const nb=noiseBuffer(0.04,1,'white');
      const src=a.ctx.createBufferSource();src.buffer=nb;
      const dly=a.ctx.createDelay(0.05);dly.delayTime.value=1/f;
      const fbk=a.ctx.createGain();fbk.gain.value=0.94-synthFilter*0.12+synthMotion*0.04;
      const lpf=a.ctx.createBiquadFilter();lpf.type='lowpass';lpf.frequency.value=2000+synthFilter*6000;
      const amp=a.ctx.createGain();
      amp.gain.setValueAtTime(0,t);amp.gain.linearRampToValueAtTime((0.42+synthPunch*0.18)*accent,t+atk);amp.gain.exponentialRampToValueAtTime(0.001,t+rel);
      src.connect(dly);dly.connect(lpf);lpf.connect(fbk);fbk.connect(dly);lpf.connect(amp);
      const dest=getLaneGain('synth')||a.bus;amp.connect(dest);trackNode(cleanMs);
      gc(src,[dly,lpf,fbk,amp],cleanMs);
      ss(src,t);st(src,t+0.04);
      return;
    }

    if(mode==='pad'||mode==='choir'||mode==='mist'){
      const atk=0.06+dur*0.08,rel=Math.max(atk+0.1,dur*0.9+space*0.5);
      const o1=a.ctx.createOscillator(),o2=a.ctx.createOscillator(),o3=a.ctx.createOscillator();
      o1.type='sawtooth';o2.type='sawtooth';o3.type='sine';
      o1.frequency.value=f;o2.frequency.value=f*(1+synthDetune);o3.frequency.value=f*(1-synthDetune*0.45);
      const mix=a.ctx.createGain();mix.gain.value=0.3;
      const hp=a.ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=120+(1-synthFilter)*80+Math.max(0,-charCfg.synthFilterBias*120);
      const fil=a.ctx.createBiquadFilter();fil.type='lowpass';
      fil.frequency.setValueAtTime(300+(synthFilter+charCfg.synthFilterBias)*2000+energy*120,t);
      fil.frequency.linearRampToValueAtTime(800+(synthFilter+charCfg.synthFilterBias)*5000+energy*260,t+atk*2);
      fil.Q.value=0.3+compress*1.4+synthMotion*0.8;
      const amp=a.ctx.createGain();
      amp.gain.setValueAtTime(0,t);amp.gain.linearRampToValueAtTime((0.28+synthPunch*0.14)*accent,t+atk);
      amp.gain.setValueAtTime((0.28+synthPunch*0.14)*accent,t+Math.max(atk+0.01,dur*(0.54+synthMotion*0.14)));
      amp.gain.exponentialRampToValueAtTime(0.001,t+rel);
      o1.connect(mix);o2.connect(mix);o3.connect(mix);mix.connect(hp);hp.connect(fil);fil.connect(amp);
      const dest=getLaneGain('synth')||a.bus;amp.connect(dest);trackNode(cleanMs);
      gc(o1,[o2,o3,mix,hp,fil,amp],cleanMs);
      ss(o1,t);ss(o2,t);ss(o3,t);st(o1,t+rel+0.1);st(o2,t+rel+0.1);st(o3,t+rel+0.1);
      return;
    }

    if(mode==='organ'||mode==='air'){
      const atk=0.005,rel=Math.max(0.05,dur*0.95);
      const c1=a.ctx.createOscillator(),c2=a.ctx.createOscillator();
      const m1=a.ctx.createOscillator(),m2=a.ctx.createOscillator();
      const mg1=a.ctx.createGain(),mg2=a.ctx.createGain();
      c1.type='sine';c2.type='sine';m1.type='sine';m2.type='sine';
      c1.frequency.value=f;c2.frequency.value=f*2;m1.frequency.value=f*1;m2.frequency.value=f*3;
      mg1.gain.value=f*fmIdxRef.current*(0.55+synthPunch*0.45);mg2.gain.value=f*fmIdxRef.current*(0.24+synthMotion*0.22);
      m1.connect(mg1);mg1.connect(c1.frequency);
      m2.connect(mg2);mg2.connect(c2.frequency);
      const mix=a.ctx.createGain();mix.gain.value=0.42;
      const hp=a.ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=150+(1-synthFilter)*90;
      const lp=a.ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=1800+synthFilter*5000+(tone+charCfg.toneBias)*700;lp.Q.value=0.2+compress*0.4;
      const amp=a.ctx.createGain();
      amp.gain.setValueAtTime(0,t);amp.gain.linearRampToValueAtTime((0.3+synthPunch*0.16)*accent,t+atk);
      amp.gain.setValueAtTime((0.3+synthPunch*0.16)*accent,t+Math.max(atk+0.01,dur*(0.72+synthMotion*0.16)));
      amp.gain.exponentialRampToValueAtTime(0.001,t+rel);
      c1.connect(mix);c2.connect(mix);mix.connect(hp);hp.connect(lp);lp.connect(amp);
      const dest=getLaneGain('synth')||a.bus;amp.connect(dest);trackNode(cleanMs);
      gc(c1,[c2,m1,m2,mg1,mg2,mix,hp,lp,amp],cleanMs);
      ss(c1,t);ss(c2,t);ss(m1,t);ss(m2,t);st(c1,t+rel+0.1);st(c2,t+rel+0.1);st(m1,t+rel+0.1);st(m2,t+rel+0.1);
      return;
    }

    if(mode==='brass'||mode==='shimmer'){
      const isShimmer=mode==='shimmer';
      const atk=isShimmer?0.04:0.01;
      const rel=Math.max(isShimmer?0.5:0.22,dur*(isShimmer?1.08:0.72)+space*(isShimmer?0.42:0.12));
      const mix=a.ctx.createGain();mix.gain.value=isShimmer?0.18:0.24;
      const hp=a.ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=isShimmer?180:140;
      const fil=a.ctx.createBiquadFilter();fil.type=isShimmer?'lowpass':'bandpass';
      fil.frequency.setValueAtTime(clamp((isShimmer?1200:700)+(synthFilter+charCfg.synthFilterBias)*5200+(tone+charCfg.toneBias)*700,240,9600),t);
      fil.Q.value=isShimmer?0.45:1.2+synthPunch*0.8;
      const amp=a.ctx.createGain();
      amp.gain.setValueAtTime(0,t);amp.gain.linearRampToValueAtTime((isShimmer?0.2:0.26+synthPunch*0.16)*accent,t+atk);
      amp.gain.setValueAtTime((isShimmer?0.16:0.22+synthPunch*0.14)*accent,t+Math.max(atk+0.02,dur*(isShimmer?0.68:0.42)));
      amp.gain.exponentialRampToValueAtTime(0.001,t+rel);
      const o1=a.ctx.createOscillator(),o2=a.ctx.createOscillator(),o3=a.ctx.createOscillator();
      o1.type=isShimmer?'triangle':'sawtooth';o2.type='sawtooth';o3.type=isShimmer?'sine':'square';
      o1.frequency.value=f;o2.frequency.value=f*(1+synthDetune*(isShimmer?0.8:0.45));o3.frequency.value=f*(isShimmer?2:0.5);
      const lfo=a.ctx.createOscillator(),lg=a.ctx.createGain();
      lfo.frequency.value=isShimmer?0.28+synthMotion*0.6:4.4+synthMotion*1.2;lg.gain.value=isShimmer?280+synthMotion*420:18+synthMotion*22;
      lfo.connect(lg);lg.connect(fil.frequency);
      o1.connect(mix);o2.connect(mix);o3.connect(mix);mix.connect(hp);hp.connect(fil);
      const sheen=a.ctx.createBiquadFilter();sheen.type='highshelf';sheen.frequency.value=isShimmer?3200:2200;sheen.gain.value=isShimmer?4.5+synthPunch*1.8:1.8+synthPunch*1.2;
      fil.connect(sheen);sheen.connect(amp);
      const dest=getLaneGain('synth')||a.bus;amp.connect(dest);trackNode(cleanMs);
      gc(o1,[o2,o3,lfo,lg,mix,hp,fil,sheen,amp],cleanMs);
      ss(o1,t);ss(o2,t);ss(o3,t);ss(lfo,t);st(o1,t+rel+0.12);st(o2,t+rel+0.12);st(o3,t+rel+0.12);st(lfo,t+rel+0.12);
      return;
    }

    if(mode==='supersaw'||mode==='hybrid'||mode==='pluck'){
      const isPluck=mode==='pluck';
      const isHybrid=mode==='hybrid';
      const atk=isPluck?0.003:(0.01+dur*0.04);
      const rel=isPluck?Math.max(0.12,dur*0.46):Math.max(0.25,dur*(isHybrid?0.8:0.92)+space*0.18);
      const voices=isPluck?2:(isHybrid?3:4);
      const mix=a.ctx.createGain();mix.gain.value=isPluck?0.24:0.18;
      const hp=a.ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=isPluck?180+(1-synthFilter)*110:130+(1-synthFilter)*90;
      const fil=a.ctx.createBiquadFilter();fil.type='lowpass';
      fil.frequency.setValueAtTime(clamp((isPluck?520:420)+(synthFilter+charCfg.synthFilterBias)*5200+(tone+charCfg.toneBias)*900+energy*380,240,9200),t);
      fil.frequency.linearRampToValueAtTime(clamp((isPluck?220:900)+(synthFilter+charCfg.synthFilterBias)*4200+synthMotion*1200+energy*480,180,9800),t+Math.max(0.03,atk*3));
      fil.Q.value=(isPluck?1.2:0.55)+compress*1.8+synthPunch*0.9;
      const amp=a.ctx.createGain();
      amp.gain.setValueAtTime(0,t);amp.gain.linearRampToValueAtTime((isPluck?0.22:0.24+synthPunch*0.16)*accent,t+atk);
      amp.gain.setValueAtTime((isPluck?0.16:0.22+synthPunch*0.14)*accent,t+Math.max(atk+0.01,dur*(isPluck?0.3:0.54)));
      amp.gain.exponentialRampToValueAtTime(0.001,t+rel);
      const detBase=Math.max(0.004,synthDetune)*(isPluck?0.5:1.4);
      const osc=[];
      for(let i=0;i<voices;i++){
        const o=a.ctx.createOscillator();
        o.type=isPluck?'triangle':(i%2===0?'sawtooth':'triangle');
        const spread=(i-(voices-1)/2)*detBase;
        o.frequency.value=f*(1+spread);
        o.connect(mix);osc.push(o);
      }
      if(isHybrid){
        const sine=a.ctx.createOscillator();
        const sg=a.ctx.createGain();
        sine.type='sine';sine.frequency.value=f*2;sg.gain.value=0.12+synthMotion*0.06;sine.connect(sg);sg.connect(mix);osc.push(sine,sg);
      }
      const vib=a.ctx.createOscillator(),vg=a.ctx.createGain();
      vib.frequency.value=isPluck?5.2:4.2+synthMotion*1.1;vg.gain.value=isPluck?1.2:2.8+synthMotion*2.6;
      vib.connect(vg);vg.connect(fil.frequency);
      mix.connect(hp);hp.connect(fil);fil.connect(amp);
      const dest=getLaneGain('synth')||a.bus;amp.connect(dest);trackNode(cleanMs);
      gc(osc[0],[...osc.slice(1),mix,hp,fil,amp,vib,vg],cleanMs);
      osc.filter(node=>node.start).forEach(o=>ss(o,t));ss(vib,t);
      osc.filter(node=>node.stop).forEach(o=>st(o,t+rel+0.12));st(vib,t+rel+0.12);
      return;
    }

    if(mode==='strings'||mode==='star'){
      const atk=0.08+dur*0.06,rel=Math.max(atk+0.1,dur*0.92+space*0.4);
      const o1=a.ctx.createOscillator(),o2=a.ctx.createOscillator();
      const vib=a.ctx.createOscillator(),vg=a.ctx.createGain();
      o1.type='sawtooth';o2.type='sawtooth';
      o1.frequency.value=f;o2.frequency.value=f*(1+synthDetune*0.5);
      vib.frequency.value=4.6+rnd()*0.8+synthMotion*0.9+charCfg.motionBias*0.8;vg.gain.value=1.4+(synthFilter+charCfg.synthFilterBias)*5+synthMotion*2.6+energy*0.8;
      vib.connect(vg);vg.connect(o1.frequency);vg.connect(o2.frequency);
      const hp=a.ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=160+(1-synthFilter)*100;
      const fil=a.ctx.createBiquadFilter();fil.type='lowpass';fil.frequency.value=400+synthFilter*5000;fil.Q.value=0.3;
      const amp=a.ctx.createGain();
      amp.gain.setValueAtTime(0,t);amp.gain.linearRampToValueAtTime((0.26+synthPunch*0.14)*accent,t+atk);
      amp.gain.setValueAtTime((0.26+synthPunch*0.14)*accent,t+Math.max(atk+0.01,dur*(0.62+synthMotion*0.16)));
      amp.gain.exponentialRampToValueAtTime(0.001,t+rel);
      o1.connect(hp);o2.connect(hp);hp.connect(fil);fil.connect(amp);
      const dest=getLaneGain('synth')||a.bus;amp.connect(dest);trackNode(cleanMs);
      gc(o1,[o2,vib,vg,hp,fil,amp],cleanMs);
      ss(o1,t);ss(o2,t);ss(vib,t);st(o1,t+rel+0.1);st(o2,t+rel+0.1);st(vib,t+rel+0.1);
      return;
    }

    const atk=0.005,rel=Math.max(0.05,dur*0.9);
    const o1=a.ctx.createOscillator(),o2=a.ctx.createOscillator();
    const tmap={lead:'square',mist:'sawtooth',choir:'sine',star:'sine',glass:'sine',organ:'sine'};
    o1.type=tmap[mode]||'sawtooth';o2.type='triangle';
    o1.frequency.value=f;o2.frequency.value=f*(1+synthDetune*0.66);
    const vib=a.ctx.createOscillator(),vg=a.ctx.createGain();
    vib.frequency.value=4.8+synthMotion*1.4+charCfg.motionBias*0.9;vg.gain.value=clamp((mode==='lead'?6.5:2.4)+synthPunch*3.2+synthMotion*2+energy*1.2,0,15);
    vib.connect(vg);vg.connect(o1.frequency);
    const hp=a.ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=110+(1-synthFilter)*70;
    const fil=a.ctx.createBiquadFilter();fil.type='lowpass';fil.frequency.value=200+(synthFilter+charCfg.synthFilterBias)*7000+(tone+charCfg.toneBias)*1200+energy*260;fil.Q.value=0.45+compress*2.6+synthPunch*0.8+energy*0.25;
    const amp=a.ctx.createGain();
    amp.gain.setValueAtTime(0,t);amp.gain.linearRampToValueAtTime((0.28+synthPunch*0.18)*accent,t+atk);
    amp.gain.setValueAtTime((0.28+synthPunch*0.18)*accent,t+Math.max(atk+0.01,dur*(0.58+synthMotion*0.14)));
    amp.gain.exponentialRampToValueAtTime(0.001,t+rel);
    const mix=a.ctx.createGain();mix.gain.value=0.5;
    const sheen=a.ctx.createBiquadFilter();sheen.type='highshelf';sheen.frequency.value=clamp(2600+(tone+charCfg.toneBias)*1800+synthMotion*900,1800,7200);sheen.gain.value=clamp((synthPunch-0.45)*6+energy*2.4,-2,5.5);
    o1.connect(mix);o2.connect(mix);mix.connect(hp);hp.connect(fil);fil.connect(sheen);sheen.connect(amp);
    const dest=getLaneGain('synth')||a.bus;amp.connect(dest);trackNode(cleanMs);
    gc(o1,[o2,vib,vg,mix,hp,fil,sheen,amp],cleanMs);
    ss(o1,t);ss(o2,t);ss(vib,t);st(o1,t+rel+0.1);st(o2,t+rel+0.1);st(vib,t+rel+0.1);
    if(midiRef.current){const out=[...midiRef.current.outputs.values()][0];if(out){const v=Math.round(clamp(accent,0,1)*127);out.send([0x94,NOTE_MIDI[note]||60,v]);setTimeout(()=>out.send([0x84,NOTE_MIDI[note]||60,0]),rel*1000);}}
  };
  const playSynth=(note,accent,t,lenSteps=1)=>{
    const notes=Array.isArray(note)?note:getVoiceNotes(note,'synth');
    const voiceAccent=accent/Math.sqrt(Math.max(1,notes.length));
    notes.forEach((voice,idx)=>playSynthVoice(voice,voiceAccent,t+idx*0.003,lenSteps));
    setActiveNotes(p=>({...p,synth:notes.join(' · ')}));
  };

  // ─── SCHEDULER ────────────────────────────────────────────────────────────
  const scheduleNote=(si,t)=>{
    const lp=patternsRef.current,ll=laneLenRef.current;
    if(si%16===0)transportBarRef.current+=1;
    const transportBar=transportBarRef.current;
    const accent=si%4===0?1:0.85;
    const charCfg=getCharacterConfig(soundCharacterRef.current);
    const runtimeEnergy=clamp(compositionEnergyRef.current*(0.94+((transportBar%4)/3)*0.08),0.1,1.1);
    for(const lane of['kick','snare','hat','bass','synth']){
      const len=ll[lane]||16;
      const li=si%len;
      const sd=lp[lane][li];
      const runtimeVar=lane==='kick'||lane==='snare'||lane==='hat'?drumRuntimeVariation(lane,si,transportBar):null;
      const shouldGhost=lane==='snare' && runtimeVar?.ghost && !sd?.on;
      const shouldExtra=runtimeVar?.extra && (lane==='hat'||lane==='snare'||lane==='kick');
      if((!sd||!sd.on) && !shouldGhost && !shouldExtra)continue;
      if(sd?.tied)continue;
      const laneProb=clamp(laneProbabilityRef.current[lane]??1,0,1);
      if((sd?.p<1&&rnd()>sd.p || laneProb<1&&rnd()>laneProb) && !shouldGhost && !shouldExtra)continue;
      const ga=grooveAccent(grooveProfileRef.current,lane,li,grooveRef.current);
      const laneEnergyBoost=lane==='kick'?0.04:lane==='bass'?0.03:lane==='synth'?0.02:0.01;
      const baseAccent=clamp(accent*ga*((sd?.v)||1)*(runtimeVar?.accentMul||1)*(0.96+runtimeEnergy*laneEnergyBoost+charCfg.accentBias),0.08,1.15);
      const hum=humanizeEvent(lane,si,transportBar,baseAccent);
      const noteT=t+Math.max(0,hum.jitter);
      const fa=hum.accent;
      if(lane==='kick'){
        if(sd?.on || shouldExtra)playKick(shouldExtra&&!sd?.on?fa*0.72:fa,noteT,{...hum,...runtimeVar,variant:hum.variant||((runtimeVar?.variantBias||0)>0.16?1:0)});
      }
      else if(lane==='snare'){
        if(sd?.on || shouldGhost || shouldExtra)playSnare(shouldGhost&&!sd?.on?fa*0.62:(shouldExtra&&!sd?.on?fa*0.78:fa),noteT,{...hum,...runtimeVar,ghost:shouldGhost&&!sd?.on,variant:hum.variant||((runtimeVar?.variantBias||0)>0.18?1:0)});
      }
      else if(lane==='hat'){
        const openBase=(li%16===7||li%16===15||si%32===0);
        const openChance=clamp((drumPresetCfg.hatOpenChance??0.12)+(runtimeVar?.openBias||0),0.04,0.42);
        const isOpen=openBase&&rnd()<openChance;
        if(sd?.on || shouldExtra)playHat(shouldExtra&&!sd?.on?fa*0.7:fa,noteT,isOpen,{...hum,...runtimeVar,variant:hum.variant||((runtimeVar?.variantBias||0)>0.14?1:0)});
      }
      else if(lane==='bass')playBass(bassRef.current[li]||'C2',fa,noteT,sd?.l||1);
      else if(lane==='synth')playSynth(synthRef.current[li]||'C4',fa,noteT,sd?.l||1);
      const delay=Math.max(0,(noteT-audioRef.current.ctx.currentTime)*1000);
      setTimeout(()=>flashLane(lane,fa),delay);
    }
    // Song arc + bar-synced autopilot
    if(si===0){
      const activeArc=songActiveRef.current&&arcRef.current.length?arcRef.current:[currentSectionRef.current];
      const activeSectionName=songActiveRef.current?(activeArc[arcIdxRef.current]||currentSectionRef.current):currentSectionRef.current;
      const activeSection=SECTIONS[activeSectionName]||SECTIONS.groove;
      const phraseLength=Math.max(1,activeSection.bars||4);
      const phraseBar=Math.min(phraseLength,barCountRef.current+1);
      runAutopilotBar(phraseBar,phraseLength);
      if(songActiveRef.current){
        barCountRef.current++;
        if(barCountRef.current>=phraseLength){
          barCountRef.current=0;
          const nextIdx=(arcIdxRef.current+1)%activeArc.length;
          arcIdxRef.current=nextIdx;
          setArcIdx(nextIdx);
          const nextSec=activeArc[nextIdx];
          setCurrentSectionName(nextSec);currentSectionRef.current=nextSec;
          regenerateSection(nextSec,false);
        }
      }
    }
  };

  const stepInterval=si=>{
    const ms=(60/bpmRef.current)*1000/4;
    const sw=si%2===1?ms*swingRef.current:-ms*swingRef.current*0.5;
    return Math.max(0.028,(ms+sw)/1000);
  };

  const runScheduler=()=>{
    const a=audioRef.current;if(!a||!isPlayingRef.current)return;
    const now=a.ctx.currentTime;
    while(nextNoteRef.current<now+SCHED){
      const si=stepRef.current;
      scheduleNote(si,nextNoteRef.current);
      const delay=Math.max(0,(nextNoteRef.current-now)*1000);
      setTimeout(()=>{setStep(si);setPage(Math.floor(si/PAGE));},delay);
      nextNoteRef.current+=stepInterval(si);
      stepRef.current=(si+1)%MAX_STEPS;
    }
  };

  // ─── TRANSPORT ────────────────────────────────────────────────────────────
  const startClock=()=>{
    const a=audioRef.current;if(!a)return;
    nextNoteRef.current=a.ctx.currentTime+0.06;
    stepRef.current=0;transportBarRef.current=0;isPlayingRef.current=true;
    schedulerRef.current=setInterval(runScheduler,LOOK);
  };
  const stopClock=()=>{
    if(schedulerRef.current){clearInterval(schedulerRef.current);schedulerRef.current=null;}
    isPlayingRef.current=false;setIsPlaying(false);setStep(0);
  };
  const togglePlay=async()=>{
    await initAudio();if(!audioRef.current)return;
    if(isPlayingRef.current){stopClock();setStatus('Stopped');return;}
    if(audioRef.current.ctx.state==='suspended')await audioRef.current.ctx.resume();
    startClock();setIsPlaying(true);setStatus(`Playing — ${genre} · ${currentSectionName}`);
  };

  // ─── GENERATION ───────────────────────────────────────────────────────────
  const regenerateSection=(sectionName,pushUndo_=true)=>{
    const gd=GENRES[genre];
    const mName=modeName;
    const prog=progressionRef.current;
    const aMode=arpModeRef.current;
    const lb=lastBassRef.current;
    let result=buildSection(genre,sectionName||currentSectionName,mName,prog,aMode,lb,compositionRef.current,compositionCycleRef.current);
    result=preserveLockedLanes(result,patternsRef.current,bassRef.current,synthRef.current,patternAuthorityRef.current);
    compositionCycleRef.current+=1;
    setSoundCharacter(result.soundCharacter||compositionRef.current?.soundCharacter||getGenreSoundCharacter(genre));
    soundCharacterRef.current=result.soundCharacter||compositionRef.current?.soundCharacter||getGenreSoundCharacter(genre);
    setCompositionEnergy(result.macroEnergy||computeMacroEnergy(sectionName||currentSectionName,compositionRef.current,compositionCycleRef.current,0));
    compositionEnergyRef.current=result.macroEnergy||computeMacroEnergy(sectionName||currentSectionName,compositionRef.current,compositionCycleRef.current,0);
    if(pushUndo_)pushUndo();
    setPatterns(result.patterns);
    setBassLine(result.bassLine);
    setSynthLine(result.synthLine);
    setLaneLen(result.laneLen);
    lastBassRef.current=result.lastBass;
    patternsRef.current=result.patterns;
    bassRef.current=result.bassLine;
    synthRef.current=result.synthLine;
    laneLenRef.current=result.laneLen;
    const gp=gd.density>0.65&&gd.chaos>0.4?'bunker':gd.chaos>0.6?'broken':gd.density<0.4?'float':'steady';
    setGrooveProfile(gp);grooveProfileRef.current=gp;
    setStatus(`${genre} · ${sectionName||currentSectionName} · ${mName}`);
  };

  const newGenreSession=(g)=>{
    const gd=GENRES[g];
    const mName=pick(gd.modes);
    const pp=CHORD_PROGS[mName]||CHORD_PROGS.minor;
    const prog=pick(pp);
    const aMode=pick(['up','down','updown','outside']);
    compositionRef.current=createCompositionBlueprint(g,mName,prog,aMode,arcRef.current);
    compositionCycleRef.current=0;
    setSoundCharacter(compositionRef.current.soundCharacter||getGenreSoundCharacter(g));
    soundCharacterRef.current=compositionRef.current.soundCharacter||getGenreSoundCharacter(g);
    setGenre(g);setModeName(mName);setArpMode(aMode);
    progressionRef.current=prog;arpModeRef.current=aMode;
    applyGenreBundleToState(g);
    const nextBpm=Math.round(gd.bpm[0]+rnd()*(gd.bpm[1]-gd.bpm[0]));
    setBpm(nextBpm);
    bpmRef.current=nextBpm;
    setSpace(gd.fxProfile.space);setTone(gd.fxProfile.tone);setDrive(gd.fxProfile.drive*2);
    setNoiseMix(gd.chaos*0.4);setCompress(gd.density*0.4);
    const sec=pick(Object.keys(SECTIONS));
    setCurrentSectionName(sec);currentSectionRef.current=sec;barCountRef.current=0;autopilotBarRef.current=0;
    lastBassRef.current='C2';
    let result=buildSection(g,sec,mName,prog,aMode,'C2',compositionRef.current,compositionCycleRef.current);
    result=preserveLockedLanes(result,patternsRef.current,bassRef.current,synthRef.current,patternAuthorityRef.current);
    compositionCycleRef.current+=1;
    setCompositionEnergy(result.macroEnergy||computeMacroEnergy(sec,compositionRef.current,compositionCycleRef.current,0));
    compositionEnergyRef.current=result.macroEnergy||computeMacroEnergy(sec,compositionRef.current,compositionCycleRef.current,0);
    setPatterns(result.patterns);setBassLine(result.bassLine);setSynthLine(result.synthLine);setLaneLen(result.laneLen);
    patternsRef.current=result.patterns;bassRef.current=result.bassLine;synthRef.current=result.synthLine;laneLenRef.current=result.laneLen;
    lastBassRef.current=result.lastBass;
    const gp=gd.density>0.65&&gd.chaos>0.4?'bunker':gd.chaos>0.6?'broken':gd.density<0.4?'float':'steady';
    setGrooveProfile(gp);grooveProfileRef.current=gp;
    applyFxNow();
    setStatus(`${g} loaded — ${sec} · ${mName}`);
  };

  // Section jump trigger
  const triggerSection=(sec)=>{
    setCurrentSectionName(sec);currentSectionRef.current=sec;barCountRef.current=0;autopilotBarRef.current=0;regenerateSection(sec);
  };

  // Live performance actions
  const perfActions={
    drop:()=>triggerSection('drop'),
    break:()=>triggerSection('break'),
    build:()=>triggerSection('build'),
    groove:()=>triggerSection('groove'),
    tension:()=>triggerSection('tension'),
    fill:()=>triggerSection('fill'),
    intro:()=>triggerSection('intro'),
    outro:()=>triggerSection('outro'),
    reharmonize:()=>{
      const pp=CHORD_PROGS[modeName]||CHORD_PROGS.minor;
      progressionRef.current=pick(pp);
      compositionRef.current=createCompositionBlueprint(genre,modeName,progressionRef.current,arpModeRef.current,arcRef.current);
      compositionCycleRef.current=0;
      regenerateSection(currentSectionName);
      setStatus('Reharmonized');
    },
    mutate:()=>{
      pushUndo();
      const np={...patternsRef.current};
      ['kick','snare','hat','bass','synth'].forEach(ln=>{
        const ll=laneLenRef.current[ln]||16;
        const flips=Math.max(2,Math.floor(ll*0.08));
        np[ln]=np[ln].map(s=>({...s}));
        for(let i=0;i<flips;i++){const pos=Math.floor(rnd()*ll);if(pos%4!==0||ln!=='kick')np[ln][pos].on=!np[ln][pos].on;}
      });
      const safe=mergeProtectedMutation(np,patternsRef.current,patternAuthorityRef.current);
      setPatterns(safe);patternsRef.current=safe;
      setStatus('Pattern mutated');
    },
    thinOut:()=>{
      pushUndo();
      const np={...patternsRef.current};
      ['hat','synth','bass'].forEach(ln=>{
        const ll=laneLenRef.current[ln]||16;
        np[ln]=np[ln].map((s,i)=>({...s,on:s.on&&(i%4===0||rnd()>0.45)}));
      });
      const safe=mergeProtectedMutation(np,patternsRef.current,patternAuthorityRef.current);
      setPatterns(safe);patternsRef.current=safe;
      setStatus('Thinned out');
    },
    thicken:()=>{
      pushUndo();
      const np={...patternsRef.current};
      ['hat','kick'].forEach(ln=>{
        const ll=laneLenRef.current[ln]||16;
        np[ln]=np[ln].map((s,i)=>({...s,on:s.on||(rnd()<0.22),v:s.v||0.65,p:s.p||0.7}));
      });
      const safe=mergeProtectedMutation(np,patternsRef.current,patternAuthorityRef.current);
      setPatterns(safe);patternsRef.current=safe;
      setStatus('Thickened');
    },
    randomizeNotes:()=>{
      // Randomize synth line within current mode's scale
      const mode=MODES[modeName]||MODES.minor;
      const sp=mode.s;
      if(patternAuthorityRef.current.synth==='lock'){setStatus('Synth locked');return;}
      pushUndo();
      setSynthLine(prev=>{const active=patternsRef.current.synth;const n=prev.map((v,i)=>active[i]?.on?pick(sp):v);synthRef.current=n;return n;});
      setStatus('Synth notes randomized');
    },
    randomizeBass:()=>{
      const mode=MODES[modeName]||MODES.minor;
      const bp=mode.b;
      if(patternAuthorityRef.current.bass==='lock'){setStatus('Bass locked');return;}
      pushUndo();
      setBassLine(prev=>{const active=patternsRef.current.bass;const n=prev.map((v,i)=>active[i]?.on?pick(bp):v);bassRef.current=n;return n;});
      setStatus('Bass notes randomized');
    },
    shiftNotesUp:()=>{
      const mode=MODES[modeName]||MODES.minor;
      ['bass','synth'].forEach(lane=>{
        const pool=lane==='bass'?mode.b:mode.s;
        if(lane==='bass')setBassLine(prev=>{const active=patternsRef.current[lane];const n=prev.map((v,i)=>{if(!active[i]?.on)return v;const idx=pool.indexOf(v);return pool[Math.min(idx+1,pool.length-1)];});bassRef.current=n;return n;});
        else setSynthLine(prev=>{const active=patternsRef.current[lane];const n=prev.map((v,i)=>{if(!active[i]?.on)return v;const idx=pool.indexOf(v);return pool[Math.min(idx+1,pool.length-1)];});synthRef.current=n;return n;});
      });
      setStatus('Notes shifted up');
    },
    shiftNotesDown:()=>{
      const mode=MODES[modeName]||MODES.minor;
      ['bass','synth'].forEach(lane=>{
        const pool=lane==='bass'?mode.b:mode.s;
        if(lane==='bass')setBassLine(prev=>{const active=patternsRef.current[lane];const n=prev.map((v,i)=>{if(!active[i]?.on)return v;const idx=pool.indexOf(v);return pool[Math.max(idx-1,0)];});bassRef.current=n;return n;});
        else setSynthLine(prev=>{const active=patternsRef.current[lane];const n=prev.map((v,i)=>{if(!active[i]?.on)return v;const idx=pool.indexOf(v);return pool[Math.max(idx-1,0)];});synthRef.current=n;return n;});
      });
      setStatus('Notes shifted down');
    },
    shiftArp:()=>{
      const modes=['up','down','updown','outside'];
      const next=modes[(modes.indexOf(arpModeRef.current)+1)%modes.length];
      setArpMode(next);arpModeRef.current=next;
      compositionRef.current=createCompositionBlueprint(genre,modeName,progressionRef.current,next);
      compositionCycleRef.current=0;
      regenerateSection(currentSectionName);
      setStatus(`Arp → ${next}`);
    },
    clear:()=>clearPattern(),
  };

  // ─── AUTOPILOT ────────────────────────────────────────────────────────────
  const chooseAutopilotAction=(sectionName,phraseBar=1,phraseLength=4)=>{
    const intensity=clamp(autopilotIntensity,0,1);
    const nearTurn=phraseBar>=phraseLength;
    const midPhrase=phraseBar===Math.max(1,Math.ceil(phraseLength*0.5));
    const weighted=(items)=>{
      const total=items.reduce((sum,[,w])=>sum+w,0);
      let cursor=rnd()*total;
      for(const[item,w]of items){cursor-=w;if(cursor<=0)return item;}
      return items[items.length-1]?.[0]||null;
    };
    const pools={
      intro:[['thinOut',2.4],['regenerate',1.6],['randomizeNotes',1.1],['shiftArp',0.9]],
      build:[['thicken',2.4],['mutate',1.7],['shiftArp',1.3],['reharmonize',0.9]],
      drop:[['mutate',2.1],['thicken',1.9],['randomizeBass',1.25],['regenerate',0.95]],
      groove:[['mutate',1.75],['randomizeBass',1.35],['randomizeNotes',1.15],['reharmonize',0.8]],
      break:[['thinOut',2.2],['randomizeNotes',1.4],['shiftArp',1.0],['regenerate',0.95]],
      tension:[['thicken',1.9],['shiftArp',1.5],['mutate',1.4],['reharmonize',0.95]],
      fill:[['mutate',2.35],['thicken',1.5],['randomizeBass',1.0],['regenerate',0.9]],
      outro:[['thinOut',2.5],['randomizeNotes',0.9],['regenerate',0.8],['shiftArp',0.5]],
    };
    if(!songActiveRef.current && nearTurn && rnd()<0.16+intensity*0.24){
      const map={intro:['build','groove'],build:['drop','tension'],groove:['break','tension','drop'],break:['build','outro'],tension:['drop','fill'],fill:['drop','groove'],drop:['groove','break','outro'],outro:['intro','groove']};
      const target=pick(map[sectionName]||Object.keys(SECTIONS));
      return {kind:'section',target};
    }
    const cadenceBoost=nearTurn?0.55:midPhrase?0.25:0;
    const pool=(pools[sectionName]||pools.groove).map(([name,weight])=>[name,weight+cadenceBoost*(name==='mutate'||name==='thicken'||name==='regenerate'?1:0.4)+(intensity>0.72&&name==='reharmonize'?0.25:0)]);
    if(intensity<0.34 && rnd()<0.34)return null;
    return {kind:'action',target:weighted(pool)};
  };

  const runAutopilotBar=(phraseBar=1,phraseLength=4)=>{
    if(!autopilotRef.current)return;
    if(autopilotActionBudgetRef.current>0){
      autopilotActionBudgetRef.current-=1;
      return;
    }
    const intensity=clamp(autopilotIntensity,0,1);
    autopilotBarRef.current+=1;
    const everyBars=intensity>=0.82?1:intensity>=0.56?2:3;
    if(autopilotBarRef.current<everyBars && phraseBar!==phraseLength)return;
    autopilotBarRef.current=0;
    const decision=chooseAutopilotAction(currentSectionRef.current,phraseBar,phraseLength);
    if(!decision)return;
    if(decision.kind==='section'){
      autopilotActionBudgetRef.current=1;
      triggerSection(decision.target);
      setStatus(`Autopilot → ${decision.target}`);
      return;
    }
    const actionName=decision.target;
    if(actionName==='regenerate')regenerateSection(currentSectionRef.current);
    else if(actionName==='reharmonize')perfActions.reharmonize();
    else if(actionName==='mutate')perfActions.mutate();
    else if(actionName==='thinOut')perfActions.thinOut();
    else if(actionName==='thicken')perfActions.thicken();
    else if(actionName==='randomizeNotes')perfActions.randomizeNotes();
    else if(actionName==='randomizeBass')perfActions.randomizeBass();
    else if(actionName==='shiftArp')perfActions.shiftArp();
    autopilotActionBudgetRef.current=actionName==='reharmonize'?1:0;
    setStatus(`Autopilot → ${actionName.replace(/([A-Z])/g,' $1').toLowerCase()}`);
  };

  useEffect(()=>{
    if(!autopilotStatusBootRef.current){
      autopilotStatusBootRef.current=true;
      if(!autopilot)return;
    }
    autopilotBarRef.current=0;
    autopilotActionBudgetRef.current=0;
    setStatus(autopilot?'Autopilot engaged':'Autopilot off');
  },[autopilot]);

  // ─── SONG ARC ─────────────────────────────────────────────────────────────
  const armSongArc=(index,announce=true)=>{
    const safeIndex=clamp(index,0,SONG_ARCS.length-1);
    const nextArc=[...(SONG_ARCS[safeIndex]||SONG_ARCS[0])];
    setSelectedArcIdx(safeIndex);selectedArcIdxRef.current=safeIndex;
    setSongArc(nextArc);arcRef.current=nextArc;
    setArcIdx(0);arcIdxRef.current=0;
    barCountRef.current=0;
    if(announce)setStatus(`Arc armed — ${SONG_ARC_NAMES[safeIndex]||`Preset ${safeIndex+1}`}`);
  };
  const startSongArc=(presetIndex=selectedArcIdxRef.current)=>{
    const safeIndex=clamp(presetIndex,0,SONG_ARCS.length-1);
    const selectedArc=[...(SONG_ARCS[safeIndex]||SONG_ARCS[0])];
    const song=buildSong(genre,selectedArc);
    compositionRef.current=song.composition;
    compositionCycleRef.current=0;
    progressionRef.current=song.progression;
    arpModeRef.current=song.arpeMode;
    setModeName(song.modeName);
    setArpMode(song.arpeMode);
    setBpm(song.bpm);bpmRef.current=song.bpm;
    setSelectedArcIdx(safeIndex);selectedArcIdxRef.current=safeIndex;
    setSongArc(song.arc);arcRef.current=song.arc;
    setArcIdx(0);arcIdxRef.current=0;
    barCountRef.current=0;
    setSongActive(true);songActiveRef.current=true;
    setCurrentSectionName(song.arc[0]);currentSectionRef.current=song.arc[0];
    setTimeout(()=>regenerateSection(song.arc[0]),0);
    setStatus(`Song arc started — ${SONG_ARC_NAMES[safeIndex]||`Preset ${safeIndex+1}`}`);
  };
  const stopSongArc=()=>{
    setSongActive(false);songActiveRef.current=false;
    barCountRef.current=0;
    setStatus('Song arc stopped');
  };

  // ─── UNDO/REDO ────────────────────────────────────────────────────────────
  const captureEditSnapshot=()=>({
    patterns:{
      kick:patternsRef.current.kick.map(s=>({...s})),
      snare:patternsRef.current.snare.map(s=>({...s})),
      hat:patternsRef.current.hat.map(s=>({...s})),
      bass:patternsRef.current.bass.map(s=>({...s})),
      synth:patternsRef.current.synth.map(s=>({...s})),
    },
    bassLine:[...bassRef.current],
    synthLine:[...synthRef.current],
    laneLen:{...laneLenRef.current},
  });
  const restoreEditSnapshot=snap=>{
    if(!snap)return;
    setPatterns(snap.patterns);setBassLine(snap.bassLine);setSynthLine(snap.synthLine);
    if(snap.laneLen){setLaneLen(snap.laneLen);laneLenRef.current=snap.laneLen;}
    patternsRef.current=snap.patterns;bassRef.current=snap.bassLine;synthRef.current=snap.synthLine;
  };
  const clearHistory=()=>{undoStack.current=[];redoStack.current=[];setUndoLen(0);setRedoLen(0);};
  const pushUndo=()=>{
    const snap=captureEditSnapshot();
    undoStack.current=[snap,...undoStack.current.slice(0,UNDO-1)];
    redoStack.current=[];
    setUndoLen(undoStack.current.length);
    setRedoLen(0);
  };
  const undo=()=>{
    if(!undoStack.current.length)return;
    const current=captureEditSnapshot();
    const snap=undoStack.current.shift();
    redoStack.current=[current,...redoStack.current.slice(0,REDO-1)];
    setUndoLen(undoStack.current.length);
    setRedoLen(redoStack.current.length);
    restoreEditSnapshot(snap);
    setStatus('Undo');
  };
  const redo=()=>{
    if(!redoStack.current.length)return;
    const current=captureEditSnapshot();
    const snap=redoStack.current.shift();
    undoStack.current=[current,...undoStack.current.slice(0,UNDO-1)];
    setRedoLen(redoStack.current.length);
    setUndoLen(undoStack.current.length);
    restoreEditSnapshot(snap);
    setStatus('Redo');
  };

  // ─── SAVE/LOAD ────────────────────────────────────────────────────────────
  const serialize=()=>({
    v:SESSION_PAYLOAD_VERSION,genre,modeName,bpm,currentSectionName,grooveProfile,arpMode:arpModeRef.current,progression:progressionRef.current,
    space,tone,noiseMix,drive,compress,bassFilter,synthFilter,drumDecay,bassSubAmt,fmIdx,
    master,swing,humanize,grooveAmt,projectName,polySynth,bassStack,bassPreset,synthPreset,drumPreset,performancePreset,soundCharacter,compositionEnergy,patternAuthority,laneVolume,laneProbability,synthChordChance,synthHold,synthCurve,genreFamily:compositionRef.current?.genreFamily||getGenreFamilyProfile(genre),
    selectedArcIdx:selectedArcIdxRef.current,songArc:arcRef.current,arcIdx:arcIdxRef.current,
    patterns,bassLine,synthLine,laneLen,
  });
  const applySnap=(snap)=>{
    if(!snap)return;
    const snapVersion=Number(snap.v||0);
    if(!Number.isFinite(snapVersion) || snapVersion<2 || snapVersion>SESSION_PAYLOAD_VERSION)return;
    stopClock();
    setSongActive(false);songActiveRef.current=false;
    setGenre(snap.genre||'techno');setModeName(snap.modeName||'minor');setBpm(snap.bpm||128);bpmRef.current=snap.bpm||128;
    progressionRef.current=snap.progression||progressionRef.current;
    const restoredSection=snap.currentSectionName||'groove';
    setCurrentSectionName(restoredSection);currentSectionRef.current=restoredSection;setGrooveProfile(snap.grooveProfile||'steady');grooveProfileRef.current=snap.grooveProfile||'steady';
    setArpMode(snap.arpMode||'up');arpModeRef.current=snap.arpMode||'up';
    compositionRef.current=createCompositionBlueprint(snap.genre||'techno',snap.modeName||'minor',progressionRef.current,arpModeRef.current,arcRef.current);
    compositionRef.current.soundCharacter=snap.soundCharacter||compositionRef.current.soundCharacter||getGenreSoundCharacter(snap.genre||'techno');
    compositionRef.current.genreFamily=snap.genreFamily||compositionRef.current.genreFamily||getGenreFamilyProfile(snap.genre||'techno');
    compositionCycleRef.current=0;
    setSpace(snap.space??0.3);setTone(snap.tone??0.7);setNoiseMix(snap.noiseMix??0.2);setDrive(snap.drive??0.1);
    setCompress(snap.compress??0.3);setBassFilter(snap.bassFilter??0.55);setSynthFilter(snap.synthFilter??0.65);
    setDrumDecay(snap.drumDecay??0.5);setBassSubAmt(snap.bassSubAmt??0.5);setFmIdx(snap.fmIdx??0.6);fmIdxRef.current=snap.fmIdx??0.6;
    setMaster(snap.master??0.85);setSwing(snap.swing??0.03);swingRef.current=snap.swing??0.03;setHumanize(snap.humanize??0.012);humanizeRef.current=snap.humanize??0.012;setGrooveAmt(snap.grooveAmt??0.65);grooveRef.current=snap.grooveAmt??0.65;
    setPolySynth(snap.polySynth??true);setBassStack(snap.bassStack??true);setBassPreset(snap.bassPreset??'sub_floor');setSynthPreset(snap.synthPreset??'velvet_pad');setDrumPreset(snap.drumPreset??'tight_punch');setPerformancePreset(snap.performancePreset??'club_night');setSoundCharacter(snap.soundCharacter??compositionRef.current.soundCharacter??getGenreSoundCharacter(snap.genre||'techno'));soundCharacterRef.current=snap.soundCharacter??compositionRef.current.soundCharacter??getGenreSoundCharacter(snap.genre||'techno');setCompositionEnergy(snap.compositionEnergy??0.68);compositionEnergyRef.current=snap.compositionEnergy??0.68;const nextAuthority={...defaultPatternAuthority(),...(snap.patternAuthority||{})};setPatternAuthority(nextAuthority);patternAuthorityRef.current=nextAuthority;const nextLaneVolume={...defaultLaneVolume(),...(snap.laneVolume||{})};setLaneVolume(nextLaneVolume);laneVolumeRef.current=nextLaneVolume;const nextLaneProbability={...defaultLaneProbability(),...(snap.laneProbability||{})};setLaneProbability(nextLaneProbability);laneProbabilityRef.current=nextLaneProbability;const nextSynthChordChance=snap.synthChordChance??0.34;setSynthChordChance(nextSynthChordChance);synthChordChanceRef.current=nextSynthChordChance;const nextSynthHold=snap.synthHold??0.56;setSynthHold(nextSynthHold);synthHoldRef.current=nextSynthHold;const nextSynthCurve=SYNTH_CURVES.includes(snap.synthCurve)?snap.synthCurve:'balanced';setSynthCurve(nextSynthCurve);synthCurveRef.current=nextSynthCurve;
    if(snap.projectName)setProjectName(snap.projectName);
    const restoredArc=Array.isArray(snap.songArc)&&snap.songArc.length?snap.songArc:[...(SONG_ARCS[snap.selectedArcIdx||0]||SONG_ARCS[0])];
    const restoredArcIndex=clamp(snap.selectedArcIdx||0,0,SONG_ARCS.length-1);
    setSelectedArcIdx(restoredArcIndex);selectedArcIdxRef.current=restoredArcIndex;
    setSongArc(restoredArc);arcRef.current=restoredArc;setArcIdx(clamp(snap.arcIdx||0,0,Math.max(0,restoredArc.length-1)));arcIdxRef.current=clamp(snap.arcIdx||0,0,Math.max(0,restoredArc.length-1));
    if(snap.patterns){setPatterns(snap.patterns);patternsRef.current=snap.patterns;}
    if(snap.bassLine){setBassLine(snap.bassLine);bassRef.current=snap.bassLine;}
    if(snap.synthLine){setSynthLine(snap.synthLine);synthRef.current=snap.synthLine;}
    if(snap.laneLen){setLaneLen(snap.laneLen);laneLenRef.current=snap.laneLen;}
    autopilotBarRef.current=0;autopilotActionBudgetRef.current=0;
    clearHistory();
    setStatus('Scene loaded');
  };
  const saveScene=slot=>{
    const now=new Date();
    const stamp=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    setSavedScenes(p=>p.map((v,i)=>i===slot?{...serialize(),label:`${genre.toUpperCase()} · ${currentSectionRef.current.toUpperCase()} · ${stamp}`}:v));
    setStatus(`Scene ${slot+1} saved`);
  };
  const loadScene=slot=>{if(savedScenes[slot])applySnap(savedScenes[slot]);};
  const exportJSON=()=>{
    const payload={
      version:SESSION_PAYLOAD_VERSION,
      exportedAt:new Date().toISOString(),
      snapshot:serialize(),
      savedScenes,
    };
    const b=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=`${projectName.replace(/\s+/g,'-').toLowerCase()}-session.json`;a.click();setTimeout(()=>URL.revokeObjectURL(u),500);setStatus('Session exported');
  };
  const importRef=useRef(null);
  const normalizeSessionPayload=payload=>{
    if(payload?.snapshot)return{snapshot:payload.snapshot,savedScenes:Array.isArray(payload.savedScenes)?payload.savedScenes.slice(0,6):null};
    return{snapshot:payload,savedScenes:null};
  };
  const importJSON=async e=>{
    const f=e.target.files?.[0];
    if(!f)return;
    try{
      const t=await f.text();
      const parsed=JSON.parse(t);
      const {snapshot,savedScenes:sceneBank}=normalizeSessionPayload(parsed);
      if(Array.isArray(sceneBank))setSavedScenes(Array.from({length:6},(_,i)=>sceneBank[i]||null));
      applySnap(snapshot);
      setStatus(sceneBank?'Session imported':'Project imported');
    }catch{
      setStatus('Import failed');
    }finally{
      e.target.value='';
    }
  };

  useEffect(()=>()=>{
    if(persistTimerRef.current)clearTimeout(persistTimerRef.current);
    recordingUrlSetRef.current.forEach(url=>{try{URL.revokeObjectURL(url);}catch{}});
    recordingUrlSetRef.current.clear();
  },[]);

  useEffect(()=>{
    if(!didHydrateRef.current||typeof window==='undefined')return;
    if(persistTimerRef.current)clearTimeout(persistTimerRef.current);
    persistTimerRef.current=setTimeout(()=>{
      try{
        window.localStorage.setItem(SESSION_STORAGE_KEY,JSON.stringify({
          v:SESSION_PAYLOAD_VERSION,
          snapshot:serialize(),
          savedScenes,
        }));
      }catch{}
    },180);
    return()=>{if(persistTimerRef.current)clearTimeout(persistTimerRef.current);};
  },[genre,modeName,bpm,currentSectionName,grooveProfile,space,tone,noiseMix,drive,compress,bassFilter,synthFilter,drumDecay,bassSubAmt,fmIdx,master,swing,humanize,grooveAmt,projectName,polySynth,bassStack,bassPreset,synthPreset,drumPreset,performancePreset,soundCharacter,compositionEnergy,patternAuthority,laneVolume,laneProbability,synthChordChance,synthHold,synthCurve,patterns,bassLine,synthLine,laneLen,savedScenes]);

  // ─── RECORDING ────────────────────────────────────────────────────────────
  const startRec=async()=>{
    await initAudio();const a=audioRef.current;if(!a||recState==='recording')return;
    const mimes=['audio/webm;codecs=opus','audio/webm','audio/mp4'];
    const mime=mimes.find(m=>MediaRecorder.isTypeSupported?.(m))||'';
    chunksRef.current=[];
    const rec=mime?new MediaRecorder(a.dest.stream,{mimeType:mime}):new MediaRecorder(a.dest.stream);
    recorderRef.current=rec;
    rec.ondataavailable=e=>{if(e.data?.size>0)chunksRef.current.push(e.data);};
    rec.onstop=()=>{
      const ft=mime||rec.mimeType||'audio/webm';const ext=ft.includes('mp4')?'m4a':'webm';
      const blob=new Blob(chunksRef.current,{type:ft});
      const url=URL.createObjectURL(blob);
      recordingUrlSetRef.current.add(url);
      setRecordings(prev=>{
        const takeIndex=prev.length+1;
        const next=[{url,name:`${projectName.replace(/\s+/g,'-')}-take-${takeIndex}.${ext}`,time:new Date().toLocaleTimeString()},...prev].slice(0,8);
        prev.slice(7).forEach(r=>safeRevokeUrl(r.url));
        return next;
      });
      setRecState('idle');setStatus('Take saved');
    };
    rec.start();setRecState('recording');setStatus('● REC');
  };
  const stopRec=()=>{if(recorderRef.current&&recState==='recording'){recorderRef.current.stop();setRecState('stopping');}};

  // ─── TAP TEMPO ────────────────────────────────────────────────────────────
  const tapTempo=()=>{
    const now=Date.now();
    setTapTimes(prev=>{
      const next=[...prev.filter(t=>now-t<3000),now];
      if(next.length>=2){const intervals=next.slice(1).map((t,i)=>t-next[i]);const avg=intervals.reduce((a,b)=>a+b,0)/intervals.length;const nb=clamp(Math.round(60000/avg),40,250);setBpm(nb);bpmRef.current=nb;setStatus(`TAP → ${nb} BPM`);}
      return next.slice(-6);
    });
  };

  const applyPartialPreset=(preset)=>{
    if(!preset)return;
    const targetGenre=preset.genre&&preset.genre!==genre?preset.genre:genre;
    if(preset.genre&&preset.genre!==genre)newGenreSession(preset.genre);
    if(preset.bassMode){
      const next={...GENRES[targetGenre],bassMode:preset.bassMode};
      GENRES[targetGenre]=next;
    }
    if(preset.synthMode){
      const next={...GENRES[targetGenre],synthMode:preset.synthMode};
      GENRES[targetGenre]=next;
    }
    if(preset.space!==undefined)setSpace(preset.space);
    if(preset.tone!==undefined)setTone(preset.tone);
    if(preset.drive!==undefined)setDrive(preset.drive);
    if(preset.compress!==undefined)setCompress(preset.compress);
    if(preset.noiseMix!==undefined)setNoiseMix(preset.noiseMix);
    if(preset.drumDecay!==undefined)setDrumDecay(preset.drumDecay);
    if(preset.bassFilter!==undefined)setBassFilter(preset.bassFilter);
    if(preset.synthFilter!==undefined)setSynthFilter(preset.synthFilter);
    if(preset.bassSubAmt!==undefined)setBassSubAmt(preset.bassSubAmt);
    if(preset.fmIdx!==undefined){setFmIdx(preset.fmIdx);fmIdxRef.current=preset.fmIdx;}
    if(preset.polySynth!==undefined)setPolySynth(preset.polySynth);
    if(preset.bassStack!==undefined)setBassStack(preset.bassStack);
    if(preset.grooveAmt!==undefined){setGrooveAmt(preset.grooveAmt);grooveRef.current=preset.grooveAmt;}
    if(preset.swing!==undefined){setSwing(preset.swing);swingRef.current=preset.swing;}
  };

  const applyBassPreset=(key)=>{
    const preset=SOUND_PRESETS.bass[key];
    if(!preset)return;
    setBassPreset(key);
    applyPartialPreset({...preset});
    setStatus(`Bass preset — ${preset.label}`);
  };
  const applySynthPreset=(key)=>{
    const preset=SOUND_PRESETS.synth[key];
    if(!preset)return;
    setSynthPreset(key);
    applyPartialPreset({...preset});
    setStatus(`Synth preset — ${preset.label}`);
  };
  const applyDrumPreset=(key)=>{
    const preset=SOUND_PRESETS.drum[key];
    if(!preset)return;
    setDrumPreset(key);
    applyPartialPreset({...preset});
    setStatus(`Drum preset — ${preset.label}`);
  };
  const applyPerformancePreset=(key)=>{
    const preset=SOUND_PRESETS.performance[key];
    if(!preset)return;
    setPerformancePreset(key);
    applyPartialPreset({...preset});
    setStatus(`Performance preset — ${preset.label}`);
  };

  const clearPattern=()=>{
    pushUndo();
    const mode=MODES[modeName]||MODES.minor;
    const empty={kick:mkSteps(),snare:mkSteps(),hat:mkSteps(),bass:mkSteps(),synth:mkSteps()};
    setPatterns(empty);patternsRef.current=empty;
    const newBass=mkNotes(mode.b[0]||'C2');
    const newSynth=mkNotes(mode.s[0]||'C4');
    setBassLine(newBass);bassRef.current=newBass;
    setSynthLine(newSynth);synthRef.current=newSynth;
    setStatus('Pattern cleared');
  };

  // ─── STEP EDIT ────────────────────────────────────────────────────────────
  const toggleCell=(lane,idx)=>{
    pushUndo();
    setAuthorityForLane(lane,'lock');
    setPatterns(p=>{const n={...p,[lane]:p[lane].map((s,i)=>i===idx?{...s,on:!s.on}:s)};patternsRef.current=n;return n;});
    setStatus(`${laneAuthorityKey(lane).toUpperCase()} locked to your pattern`);
  };
  const setNote=(lane,idx,note)=>{
    pushUndo();
    setAuthorityForLane(lane,'lock');
    if(lane==='bass')setBassLine(p=>{const n=[...p];n[idx]=note;bassRef.current=n;return n;});
    else setSynthLine(p=>{const n=[...p];n[idx]=note;synthRef.current=n;return n;});
    setStatus(`${lane.toUpperCase()} locked to your notes`);
  };

  // ─── MIDI ─────────────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!navigator.requestMIDIAccess)return;
    navigator.requestMIDIAccess().then(m=>{midiRef.current=m;setMidiOk(true);}).catch(()=>{});
  },[]);

  // ─── KEYBOARD SHORTCUTS ───────────────────────────────────────────────────
  useEffect(()=>{
    const onKey=e=>{
      if(e.target.tagName==='INPUT')return;
      if(e.code==='Space'){e.preventDefault();togglePlay();}
      else if(e.code==='KeyA')perfActions.drop();
      else if(e.code==='KeyS')perfActions.break();
      else if(e.code==='KeyD')perfActions.build();
      else if(e.code==='KeyF')perfActions.groove();
      else if(e.code==='KeyG')perfActions.tension();
      else if(e.code==='KeyH')perfActions.fill();
      else if(e.code==='KeyM')perfActions.mutate();
      else if(e.code==='KeyR')regenerateSection(currentSectionName);
      else if(e.code==='KeyP')setAutopilot(v=>!v);
      else if((e.code==='KeyZ'&&(e.metaKey||e.ctrlKey)&&e.shiftKey)|| (e.code==='KeyY'&&(e.metaKey||e.ctrlKey))){e.preventDefault();redo();}
      else if(e.code==='KeyZ'&&(e.metaKey||e.ctrlKey)){e.preventDefault();undo();}
      else if(e.code==='KeyT')tapTempo();
      else if(e.code==='Escape')panicEngine();
    };
    window.addEventListener('keydown',onKey);
    return()=>window.removeEventListener('keydown',onKey);
  },[currentSectionName,genre]);

  // ─── VISUALIZER ───────────────────────────────────────────────────────────
  const vizRef=useRef(null);
  useEffect(()=>{
    let rafId;
    const draw=()=>{
      rafId=requestAnimationFrame(draw);
      const an=analyserRef.current;if(!an||!vizRef.current)return;
      const data=new Uint8Array(an.frequencyBinCount);
      an.getByteFrequencyData(data);setVizData(data);
      const canvas=vizRef.current;const ctx=canvas.getContext('2d');
      const W=canvas.width,H=canvas.height;
      ctx.clearRect(0,0,W,H);
      const gc=GENRE_CLR[genre]||'#ff4444';
      const barW=W/data.length;
      for(let i=0;i<data.length;i++){
        const v=(data[i]/255)*H;
        const alpha=0.3+v/H*0.7;
        ctx.fillStyle=`${gc}${Math.round(alpha*255).toString(16).padStart(2,'0')}`;
        ctx.fillRect(i*barW,H-v,barW-0.5,v);
      }
    };
    draw();
    return()=>cancelAnimationFrame(rafId);
  },[genre]);

  // ─── INIT ─────────────────────────────────────────────────────────────────
  useEffect(()=>{
    let restored=false;
    if(typeof window!=='undefined'){
      try{
        const raw=window.localStorage.getItem(SESSION_STORAGE_KEY);
        if(raw){
          const parsed=JSON.parse(raw);
          const {snapshot,savedScenes:sceneBank}=normalizeSessionPayload(parsed);
          if(Array.isArray(sceneBank))setSavedScenes(Array.from({length:6},(_,i)=>sceneBank[i]||null));
          if(snapshot?.v) {
            applySnap(snapshot);
            restored=true;
            setStatus('Last session restored');
          }
        }
      }catch{}
    }
    if(!restored){
      newGenreSession('techno');
    }
    didHydrateRef.current=true;
  },[]);

  // ─── RENDER HELPERS ───────────────────────────────────────────────────────
  const gc_=GENRE_CLR[genre]||'#ff4444';
  const visibleSteps=Array.from({length:PAGE},(_,i)=>page*PAGE+i);
  const [viewportWidth,setViewportWidth]=useState(typeof window!=='undefined'?window.innerWidth:1280);
  useEffect(()=>{
    const onResize=()=>setViewportWidth(window.innerWidth);
    window.addEventListener('resize',onResize);
    return()=>window.removeEventListener('resize',onResize);
  },[]);
  const isCompact=viewportWidth<1180;
  const isPhone=viewportWidth<820;

  // ─── UI ───────────────────────────────────────────────────────────────────
  return(
    <div style={{
      width:'100vw',height:'100dvh',background:'#060608',color:'#e8e8e8',
      fontFamily:"'Space Mono',monospace",display:'flex',flexDirection:'column',
      overflow:'hidden',userSelect:'none',position:'relative',
      boxSizing:'border-box',minWidth:0,
    }}>

      {/* ── SCANLINE OVERLAY ── */}
      <div style={{position:'fixed',inset:0,backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.08) 2px,rgba(0,0,0,0.08) 4px)',pointerEvents:'none',zIndex:999}}/>

      {/* ── TOP BAR ── */}
      <div style={{display:'flex',alignItems:'center',flexWrap:'wrap',gap:6,padding:isPhone?'8px':'6px 10px',borderBottom:'1px solid rgba(255,255,255,0.06)',flexShrink:0,minHeight:36,background:'rgba(0,0,0,0.4)',overflow:'hidden'}}>
        {/* Logo */}
        <div style={{fontSize:9,fontWeight:700,letterSpacing:'0.22em',color:gc_,borderRadius:3,padding:'2px 6px',border:`1px solid ${gc_}44`,whiteSpace:'nowrap'}}>
          CESIRA V2
        </div>

        {/* Project name */}
        <input value={projectName} onChange={e=>setProjectName(e.target.value)}
          style={{background:'transparent',border:'none',outline:'none',color:'rgba(255,255,255,0.96)',fontSize:8.5,fontFamily:'Space Mono,monospace',letterSpacing:'0.08em',width:isPhone?'100%':110,flex:isPhone?1:'0 0 auto',minWidth:isPhone?160:110}}/>

        {/* Genre selector */}
        <div style={{display:'flex',gap:2,flexShrink:0,flexWrap:'wrap',maxWidth:isPhone?'100%':'none'}}>
          {GENRE_NAMES.map(g=>(
            <button key={g} onClick={()=>newGenreSession(g)} style={{
              padding:'2px 5px',borderRadius:2,border:`1px solid ${genre===g?GENRE_CLR[g]:'rgba(255,255,255,0.07)'}`,
              background:genre===g?`${GENRE_CLR[g]}18`:'transparent',
              color:genre===g?GENRE_CLR[g]:'rgba(255,255,255,0.93)',
              fontSize:7.75,fontWeight:700,cursor:'pointer',letterSpacing:'0.1em',
              fontFamily:'Space Mono,monospace',textTransform:'uppercase',
              transition:'all 0.1s',
            }}>{g}</button>
          ))}
        </div>

        <div style={{flex:1}}/>

        {/* Visualizer */}
        {!isPhone&&<canvas ref={vizRef} width={96} height={18} style={{opacity:0.65,borderRadius:2}}/>}

        {/* BPM — proper control with +/- and slider */}
        <div style={{display:'flex',alignItems:'center',gap:2,background:'rgba(255,255,255,0.05)',borderRadius:4,padding:'2px 4px',border:'1px solid rgba(255,255,255,0.1)'}}>
          <button onClick={()=>{const v=clamp(bpm-5,40,250);setBpm(v);bpmRef.current=v;}} style={{width:16,height:16,borderRadius:2,border:'none',background:'rgba(255,255,255,0.08)',color:'rgba(255,255,255,0.6)',fontSize:10,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Space Mono,monospace',lineHeight:1,flexShrink:0}}>−</button>
          <button onClick={()=>{const v=clamp(bpm-1,40,250);setBpm(v);bpmRef.current=v;}} style={{width:14,height:16,borderRadius:2,border:'none',background:'rgba(255,255,255,0.05)',color:'rgba(255,255,255,0.97)',fontSize:8.5,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Space Mono,monospace',lineHeight:1,flexShrink:0}}>‹</button>
          <div style={{textAlign:'center',minWidth:32}}>
            <div style={{fontSize:13,fontWeight:700,color:gc_,fontFamily:'Space Mono,monospace',lineHeight:1}}>{bpm}</div>
            <div style={{fontSize:6.25,color:'rgba(255,255,255,0.94)',letterSpacing:'0.1em'}}>BPM</div>
          </div>
          <button onClick={()=>{const v=clamp(bpm+1,40,250);setBpm(v);bpmRef.current=v;}} style={{width:14,height:16,borderRadius:2,border:'none',background:'rgba(255,255,255,0.05)',color:'rgba(255,255,255,0.97)',fontSize:8.5,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Space Mono,monospace',lineHeight:1,flexShrink:0}}>›</button>
          <button onClick={()=>{const v=clamp(bpm+5,40,250);setBpm(v);bpmRef.current=v;}} style={{width:16,height:16,borderRadius:2,border:'none',background:'rgba(255,255,255,0.08)',color:'rgba(255,255,255,0.6)',fontSize:10,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Space Mono,monospace',lineHeight:1,flexShrink:0}}>+</button>
          <button onClick={tapTempo} style={{padding:'1px 5px',borderRadius:2,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.04)',color:'rgba(255,255,255,0.97)',fontSize:7.25,cursor:'pointer',fontFamily:'Space Mono,monospace',marginLeft:2}}>TAP</button>
        </div>

        <div style={{display:'flex',alignItems:'center',gap:4,flexWrap:'wrap'}}>
          <button onClick={()=>setPolySynth(v=>!v)} style={{padding:'4px 7px',borderRadius:3,border:`1px solid ${polySynth?gc_:'rgba(255,255,255,0.1)'}`,background:polySynth?`${gc_}18`:'rgba(255,255,255,0.03)',color:polySynth?gc_:'rgba(255,255,255,0.96)',fontSize:7.75,fontWeight:700,cursor:'pointer',fontFamily:'Space Mono,monospace'}}>SYNTH POLY</button>
          <button onClick={()=>setBassStack(v=>!v)} style={{padding:'4px 7px',borderRadius:3,border:`1px solid ${bassStack?'#22d3ee':'rgba(255,255,255,0.1)'}`,background:bassStack?'rgba(34,211,238,0.12)':'rgba(255,255,255,0.03)',color:bassStack?'#22d3ee':'rgba(255,255,255,0.96)',fontSize:7.75,fontWeight:700,cursor:'pointer',fontFamily:'Space Mono,monospace'}}>BASS STACK</button>
          <button onClick={clearPattern} style={{padding:'4px 8px',borderRadius:3,border:'1px solid rgba(255,80,80,0.35)',background:'rgba(255,80,80,0.08)',color:'#ff8a8a',fontSize:7.75,fontWeight:700,cursor:'pointer',fontFamily:'Space Mono,monospace'}}>CLEAR</button>
        </div>

        <div style={{display:'flex',alignItems:'center',gap:4,flexWrap:'wrap',minWidth:isPhone?'100%':'auto'}}>
          <PresetSelect label='BASS' value={bassPreset} options={SOUND_PRESETS.bass} onChange={applyBassPreset} accent='#22d3ee' />
          <PresetSelect label='SYNTH' value={synthPreset} options={SOUND_PRESETS.synth} onChange={applySynthPreset} accent={gc_} />
          <PresetSelect label='DRUM' value={drumPreset} options={SOUND_PRESETS.drum} onChange={applyDrumPreset} accent='#ffb347' />
          <PresetSelect label='PERF' value={performancePreset} options={SOUND_PRESETS.performance} onChange={applyPerformancePreset} accent='#7ee787' />
        </div>

        {/* Transport */}
        <button onClick={togglePlay} style={{
          padding:'4px 14px',borderRadius:3,border:'none',
          background:isPlaying?'#ff2244':'#00cc66',
          color:'#000',fontSize:9,fontWeight:700,cursor:'pointer',
          letterSpacing:'0.1em',fontFamily:'Space Mono,monospace',
          boxShadow:isPlaying?'0 0 12px #ff224466':'0 0 12px #00cc6666',
          transition:'all 0.1s',flexShrink:0,
        }}>{isPlaying?'■ STOP':'▶ PLAY'}</button>

        {/* Autopilot */}
        <button onClick={()=>setAutopilot(v=>!v)} style={{
          padding:'4px 8px',borderRadius:3,border:`1px solid ${autopilot?gc_:'rgba(255,255,255,0.1)'}`,
          background:autopilot?`${gc_}22`:'rgba(255,255,255,0.04)',
          color:autopilot?gc_:'rgba(255,255,255,0.38)',
          fontSize:7.75,fontWeight:700,cursor:'pointer',letterSpacing:'0.1em',fontFamily:'Space Mono,monospace',
          boxShadow:autopilot?`0 0 10px ${gc_}55`:'none',
          transition:'all 0.12s',flexShrink:0,
        }}>{autopilot?'◈ AUTO':'○ AUTO'}</button>

        {/* View toggle */}
        <div style={{display:'flex',gap:2,flexShrink:0}}>
          {['perform','studio','song'].map(v=>(
            <button key={v} onClick={()=>setView(v)} style={{
              padding:'2px 6px',borderRadius:2,border:`1px solid ${view===v?gc_:'rgba(255,255,255,0.08)'}`,
              background:view===v?`${gc_}18`:'transparent',
              color:view===v?gc_:'rgba(255,255,255,0.94)',
              fontSize:7.75,fontWeight:700,cursor:'pointer',letterSpacing:'0.08em',fontFamily:'Space Mono,monospace',
              textTransform:'uppercase',
            }}>{v}</button>
          ))}
        </div>

        {/* Status */}
        <div style={{fontSize:7.75,color:'rgba(255,255,255,0.95)',maxWidth:isPhone?'100%':100,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',letterSpacing:'0.05em',flex:isPhone?'1 1 100%':'0 1 auto'}}>
          {recState==='recording'&&<span style={{color:'#ff2244',marginRight:3}}>●</span>}{status}
        </div>
        <div style={{width:5,height:5,borderRadius:'50%',background:midiOk?'#00ff88':'rgba(255,255,255,0.12)',flexShrink:0}}/>
      </div>

      {/* ── CONTEXT BAR — always-visible musical state ── */}
      <div style={{display:'flex',alignItems:'center',flexWrap:'wrap',gap:8,padding:isPhone?'6px 10px':'3px 10px',background:'rgba(0,0,0,0.25)',borderBottom:'1px solid rgba(255,255,255,0.04)',flexShrink:0,minHeight:isPhone?40:20,overflow:'hidden'}}>
        <span style={{fontSize:7.25,color:'rgba(255,255,255,0.92)',letterSpacing:'0.12em',textTransform:'uppercase'}}>NOW PLAYING:</span>
        <span style={{fontSize:7.75,fontWeight:700,color:gc_,letterSpacing:'0.1em',textTransform:'uppercase'}}>{genre}</span>
        <span style={{color:'rgba(255,255,255,0.15)',fontSize:6.75}}>·</span>
        <span style={{fontSize:7.75,color:'rgba(255,255,255,0.97)',letterSpacing:'0.06em'}}>{currentSectionName}</span>
        <span style={{color:'rgba(255,255,255,0.15)',fontSize:6.75}}>·</span>
        <span style={{fontSize:7.75,color:'rgba(255,255,255,0.95)',letterSpacing:'0.06em'}}>{modeName}</span>
        <span style={{color:'rgba(255,255,255,0.15)',fontSize:6.75}}>·</span>
        <span style={{fontSize:7.75,color:'rgba(255,255,255,0.95)',letterSpacing:'0.06em'}}>arp:{arpMode}</span>
        <span style={{color:'rgba(255,255,255,0.15)',fontSize:6.75}}>·</span>
        <span style={{fontSize:7.75,color:'rgba(255,255,255,0.95)',letterSpacing:'0.06em'}}>poly:{polySynth?'3v':'mono'} / bass:{bassStack?'stack':'mono'}</span>
        <span style={{color:'rgba(255,255,255,0.15)',fontSize:6.75}}>·</span>
        <span style={{fontSize:7.75,color:isPlaying?'#00ff88':'rgba(255,255,255,0.92)',letterSpacing:'0.06em'}}>{isPlaying?'▶ RUNNING':'■ STOPPED'}</span>
        {autopilot&&<><span style={{color:'rgba(255,255,255,0.15)',fontSize:6.75}}>·</span><span style={{fontSize:7.75,color:gc_,letterSpacing:'0.06em'}}>◈ AUTOPILOT ON</span></>}
        {songActive&&<><span style={{color:'rgba(255,255,255,0.15)',fontSize:6.75}}>·</span><span style={{fontSize:7.75,color:'#ffaa00',letterSpacing:'0.06em'}}>ARC {arcIdx+1}/{songArc.length}</span></>}
        <div style={{flex:1}}/>
        {['drums','bass','synth'].map(key=>(<div key={key} style={{display:'flex',gap:2,alignItems:'center'}}>{PATTERN_AUTHORITY_LEVELS.map(level=>(<button key={level} onClick={()=>setPatternAuthority(prev=>{const next={...prev,[key]:level};patternAuthorityRef.current=next;return next;})} style={{padding:'1px 4px',borderRadius:2,border:`1px solid ${patternAuthority[key]===level?(key==='drums'?'#ffb347':key==='bass'?'#22d3ee':gc_):'rgba(255,255,255,0.08)'}`,background:patternAuthority[key]===level?`${key==='drums'?'#ffb347':key==='bass'?'#22d3ee':gc_}18`:'transparent',color:patternAuthority[key]===level?(key==='drums'?'#ffb347':key==='bass'?'#22d3ee':gc_):'rgba(255,255,255,0.82)',fontSize:6.25,fontFamily:'Space Mono,monospace',textTransform:'uppercase',cursor:'pointer'}}>{key[0]}:{level[0]}</button>))}</div>))}
        {!isPhone&&<span style={{fontSize:6.75,color:'rgba(255,255,255,0.88)',letterSpacing:'0.08em'}}>SPACE=play · A=drop · S=break · D=build · F=groove · G=tension · M=mutate · R=regen · P=auto · T=tap · ESC=panic</span>}
      </div>

      {/* ── VIEWS ── */}
      {view==='perform'&&<PerformView
        genre={genre} gc={gc_} isPlaying={isPlaying}
        currentSectionName={currentSectionName} laneVU={laneVU}
        patterns={patterns} bassLine={bassLine} synthLine={synthLine}
        laneLen={laneLen} step={step} page={page} setPage={setPage}
        activeNotes={activeNotes} arpeMode={arpMode} modeName={modeName}
        autopilot={autopilot} autopilotIntensity={autopilotIntensity}
        setAutopilotIntensity={setAutopilotIntensity}
        perfActions={perfActions} regenerateSection={regenerateSection}
        setNote={setNote}
        savedScenes={savedScenes} saveScene={saveScene} loadScene={loadScene}
        master={master} setMaster={setMaster}
        space={space} setSpace={setSpace}
        tone={tone} setTone={setTone}
        drive={drive} setDrive={setDrive}
        grooveAmt={grooveAmt} setGrooveAmt={setGrooveAmt}
        swing={swing} setSwing={setSwing}
        toggleCell={toggleCell}
        songArc={songArc} arcIdx={arcIdx} songActive={songActive}
        bassPreset={bassPreset} synthPreset={synthPreset} drumPreset={drumPreset} performancePreset={performancePreset}
        applyBassPreset={applyBassPreset} applySynthPreset={applySynthPreset} applyDrumPreset={applyDrumPreset} applyPerformancePreset={applyPerformancePreset}
        laneVolume={laneVolume} setLaneVolume={setLaneVolume}
        laneProbability={laneProbability} setLaneProbability={setLaneProbability}
        synthChordChance={synthChordChance} setSynthChordChance={setSynthChordChance}
        synthHold={synthHold} setSynthHold={setSynthHold}
        synthCurve={synthCurve} setSynthCurve={setSynthCurve}
        compact={isCompact} phone={isPhone}
      />}

      {view==='studio'&&<StudioView
        genre={genre} gc={gc_} patterns={patterns} bassLine={bassLine} synthLine={synthLine}
        laneLen={laneLen} step={step} page={page} setPage={setPage}
        toggleCell={toggleCell} setNote={setNote}
        modeName={modeName} laneVU={laneVU}
        space={space} setSpace={setSpace}
        tone={tone} setTone={setTone}
        noiseMix={noiseMix} setNoiseMix={setNoiseMix}
        drive={drive} setDrive={setDrive}
        compress={compress} setCompress={setCompress}
        bassFilter={bassFilter} setBassFilter={setBassFilter}
        synthFilter={synthFilter} setSynthFilter={setSynthFilter}
        drumDecay={drumDecay} setDrumDecay={setDrumDecay}
        bassSubAmt={bassSubAmt} setBassSubAmt={setBassSubAmt}
        fmIdx={fmIdx} setFmIdx={setFmIdx}
        master={master} setMaster={setMaster}
        swing={swing} setSwing={setSwing}
        humanize={humanize} setHumanize={setHumanize}
        grooveAmt={grooveAmt} setGrooveAmt={setGrooveAmt}
        grooveProfile={grooveProfile} setGrooveProfile={v=>{setGrooveProfile(v);grooveProfileRef.current=v;}}
        regenerateSection={regenerateSection}
        currentSectionName={currentSectionName}
        undoLen={undoLen} redoLen={redoLen} undo={undo} redo={redo}
        recState={recState} startRec={startRec} stopRec={stopRec}
        recordings={recordings}
        exportJSON={exportJSON} importRef={importRef} importJSON={importJSON}
        savedScenes={savedScenes} saveScene={saveScene} loadScene={loadScene}
        projectName={projectName} setProjectName={setProjectName}
        clearPattern={clearPattern} polySynth={polySynth} setPolySynth={setPolySynth} bassStack={bassStack} setBassStack={setBassStack}
        bassPreset={bassPreset} synthPreset={synthPreset} drumPreset={drumPreset} performancePreset={performancePreset}
        applyBassPreset={applyBassPreset} applySynthPreset={applySynthPreset} applyDrumPreset={applyDrumPreset} applyPerformancePreset={applyPerformancePreset}
        laneVolume={laneVolume} setLaneVolume={setLaneVolume}
        laneProbability={laneProbability} setLaneProbability={setLaneProbability}
        synthChordChance={synthChordChance} setSynthChordChance={setSynthChordChance}
        synthHold={synthHold} setSynthHold={setSynthHold}
        synthCurve={synthCurve} setSynthCurve={setSynthCurve}
        compact={isCompact} phone={isPhone}
      />}

      {view==='song'&&<SongView
        genre={genre} gc={gc_}
        songArc={songArc} arcIdx={arcIdx} songActive={songActive}
        startSongArc={startSongArc} stopSongArc={stopSongArc} armSongArc={armSongArc}
        selectedArcIdx={selectedArcIdx} SONG_ARC_NAMES={SONG_ARC_NAMES}
        currentSectionName={currentSectionName}
        SONG_ARCS={SONG_ARCS} SECTIONS={SECTIONS}
        triggerSection={triggerSection}
        modeName={modeName} arpeMode={arpMode}
        bpm={bpm}
        compact={isCompact} phone={isPhone}
      />}

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PERFORM VIEW — full-screen live performance interface
// ─────────────────────────────────────────────────────────────────────────────
function PerformView({genre,gc,isPlaying,currentSectionName,laneVU,patterns,bassLine,synthLine,laneLen,step,page,setPage,activeNotes,arpeMode,modeName,autopilot,autopilotIntensity,setAutopilotIntensity,perfActions,regenerateSection,savedScenes,saveScene,loadScene,master,setMaster,space,setSpace,tone,setTone,drive,setDrive,grooveAmt,setGrooveAmt,swing,setSwing,toggleCell,songArc,arcIdx,songActive,setNote,bassPreset,synthPreset,drumPreset,performancePreset,applyBassPreset,applySynthPreset,applyDrumPreset,applyPerformancePreset,laneVolume,setLaneVolume,laneProbability,setLaneProbability,synthChordChance,setSynthChordChance,synthHold,setSynthHold,synthCurve,setSynthCurve,compact,phone}){
  const SECTION_COLORS={drop:'#ff2244',break:'#4488ff',build:'#ffaa00',groove:'#00cc66',tension:'#ff6622',fill:'#cc00ff',intro:'#44ffcc',outro:'#aaaaaa'};
  const sc=SECTION_COLORS[currentSectionName]||gc;
  const visibleStart=page*16,visibleEnd=Math.min(visibleStart+16,MAX_STEPS);
  const visIdx=Array.from({length:visibleEnd-visibleStart},(_,i)=>visibleStart+i);
  const SECTS=['drop','break','build','groove','tension','fill','intro','outro'];
  const shortcut={drop:'A',break:'S',build:'D',groove:'F',tension:'G',fill:'H'};

  return(
    <div style={{flex:1,display:'flex',flexDirection:compact?'column':'row',gap:6,padding:phone?'8px':'5px 7px 8px 7px',minHeight:0,overflowY:'auto',overflowX:'hidden'}}>

      {/* LEFT — Section triggers + autopilot */}
      <div style={{width:compact?'100%':118,display:'flex',flexDirection:'column',gap:3,flexShrink:0}}>
        {/* Section pads */}
        <div style={{fontSize:6.75,color:'rgba(255,255,255,0.9)',letterSpacing:'0.18em',marginBottom:1,textTransform:'uppercase'}}>SECTIONS</div>
        {SECTS.map(sec=>{
          const scl=SECTION_COLORS[sec]||'#ffffff';
          const isActive=currentSectionName===sec;
          return(
            <button key={sec} onClick={()=>perfActions[sec]?perfActions[sec]():null} style={{
              padding:'6px 6px',borderRadius:4,border:`1px solid ${isActive?scl:scl+'33'}`,
              background:isActive?`${scl}22`:`${scl}08`,
              color:isActive?scl:`${scl}88`,
              fontSize:8.5,fontWeight:700,cursor:'pointer',
              fontFamily:'Space Mono,monospace',letterSpacing:'0.1em',
              textTransform:'uppercase',transition:'all 0.08s',
              boxShadow:isActive?`0 0 8px ${scl}44`:'none',
              display:'flex',justifyContent:'space-between',alignItems:'center',
            }}>
              <span>{sec}</span>
              {shortcut[sec]&&<span style={{fontSize:6.75,opacity:0.4}}>[{shortcut[sec]}]</span>}
            </button>
          );
        })}

        {/* Actions */}
        <div style={{fontSize:6.75,color:'rgba(255,255,255,0.88)',letterSpacing:'0.18em',marginTop:3,textTransform:'uppercase'}}>ACTIONS</div>
        {[
          {label:'MUTATE',fn:perfActions.mutate,key:'M',tip:'flip drum hits'},
          {label:'THIN',fn:perfActions.thinOut,tip:'sparse out'},
          {label:'THICKEN',fn:perfActions.thicken,tip:'add hits'},
          {label:'REHARM',fn:perfActions.reharmonize,tip:'new chords'},
          {label:'ARP→',fn:perfActions.shiftArp,tip:'change pattern'},
          {label:'REGEN',fn:()=>regenerateSection(currentSectionName),key:'R',tip:'full rebuild'},
          {label:'RND SYNTH',fn:perfActions.randomizeNotes,tip:'random notes'},
          {label:'RND BASS',fn:perfActions.randomizeBass,tip:'random bass'},
          {label:'NOTES ↑',fn:perfActions.shiftNotesUp,tip:'shift up'},
          {label:'NOTES ↓',fn:perfActions.shiftNotesDown,tip:'shift down'},
          {label:'CLEAR',fn:perfActions.clear,tip:'clear all lanes'},
        ].map(({label,fn,key,tip})=>(
          <button key={label} onClick={fn} title={tip} style={{
            padding:'4px 6px',borderRadius:3,border:'1px solid rgba(255,255,255,0.08)',
            background:'rgba(255,255,255,0.02)',color:'rgba(255,255,255,0.48)',
            fontSize:7.75,fontWeight:700,cursor:'pointer',fontFamily:'Space Mono,monospace',
            letterSpacing:'0.06em',display:'flex',justifyContent:'space-between',alignItems:'center',
          }}>
            <span>{label}</span>
            {key&&<span style={{fontSize:6.75,opacity:0.35}}>[{key}]</span>}
          </button>
        ))}
      </div>

      {/* CENTER — Grid + VU */}
      <div style={{flex:1,display:'flex',flexDirection:'column',gap:4,minWidth:0,order:compact?1:2}}>

        {/* Section indicator + info bar */}
        <div style={{display:'flex',alignItems:'center',flexWrap:'wrap',gap:8,minHeight:22,flexShrink:0}}>
          <div style={{fontSize:13,fontWeight:700,color:sc,letterSpacing:'0.16em',textTransform:'uppercase',textShadow:`0 0 16px ${sc}55`}}>
            {currentSectionName.toUpperCase()}
          </div>
          <div style={{width:1,height:12,background:'rgba(255,255,255,0.08)'}}/>
          <span style={{fontSize:7.75,color:'rgba(255,255,255,0.95)',letterSpacing:'0.08em'}}>{genre} · {modeName} · arp:{arpeMode}</span>
          <div style={{flex:1}}/>
          {songArc.length>0&&(
            <div style={{display:'flex',gap:2,alignItems:'center'}}>
              {songArc.map((s,i)=>(
                <div key={i} style={{width:i===arcIdx?22:14,height:4,borderRadius:2,background:i===arcIdx?SECTION_COLORS[s]||gc:i<arcIdx?'rgba(255,255,255,0.88)':'rgba(255,255,255,0.05)',transition:'all 0.2s'}}/>
              ))}
            </div>
          )}
          <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0} style={{...navBtn,opacity:page===0?0.3:1,padding:'1px 5px',fontSize:9}}>‹</button>
          <span style={{fontSize:7.75,color:'rgba(255,255,255,0.93)',fontFamily:'Space Mono,monospace'}}>{page+1}/4</span>
          <button onClick={()=>setPage(p=>Math.min(3,p+1))} disabled={page===3} style={{...navBtn,opacity:page===3?0.3:1,padding:'1px 5px',fontSize:9}}>›</button>
        </div>

        {/* Lane rows with VU + grid */}
        {['kick','snare','hat','bass','synth'].map(lane=>{
          const lc=LANE_CLR[lane];
          const ll=laneLen[lane]||16;
          const vu=laneVU[lane]||0;
          return(
            <div key={lane} style={{flex:1,display:'flex',alignItems:'stretch',gap:5,minHeight:0}}>
              {/* Lane label + VU */}
              <div style={{width:38,flexShrink:0,display:'flex',flexDirection:'column',justifyContent:'center',gap:1}}>
                <span style={{fontSize:6.75,fontWeight:700,color:lc,letterSpacing:'0.14em',textTransform:'uppercase'}}>{lane}</span>
                <div style={{height:3,borderRadius:2,background:'rgba(255,255,255,0.05)',overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${vu*100}%`,background:lc,borderRadius:2,transition:'width 0.04s',boxShadow:`0 0 4px ${lc}`}}/>
                </div>
                {(lane==='bass'||lane==='synth')&&(
                  <span style={{fontSize:6.25,color:'rgba(255,255,255,0.92)',letterSpacing:'0.04em'}}>{activeNotes[lane]}</span>
                )}
              </div>
              {/* Step grid */}
              <div style={{flex:1,display:'grid',gridTemplateColumns:`repeat(${visIdx.length},1fr)`,gap:1.5,alignItems:'stretch'}}>
                {visIdx.map(idx=>{
                  if(idx>=ll)return<div key={idx} style={{borderRadius:2,background:'rgba(255,255,255,0.015)',opacity:0.25}}/>;
                  const sd=patterns[lane][idx];
                  const on=sd.on,isActive=step===idx&&isPlaying;
                  const isTied=sd.tied;
                  const isBeat=idx%4===0,isBar=idx%16===0;
                  return(
                    <button key={idx} onClick={()=>toggleCell(lane,idx)} style={{
                      borderRadius:isTied?'1px 2px 2px 1px':'2px',
                      borderTop:`1px solid ${isActive?lc:isBar?`${lc}44`:isBeat?'rgba(255,255,255,0.07)':'rgba(255,255,255,0.03)'}`,
                      borderRight:`1px solid ${isActive?lc:isBar?`${lc}44`:isBeat?'rgba(255,255,255,0.07)':'rgba(255,255,255,0.03)'}`,
                      borderBottom:`1px solid ${isActive?lc:isBar?`${lc}44`:isBeat?'rgba(255,255,255,0.07)':'rgba(255,255,255,0.03)'}`,
                      borderLeft:isTied?`2px solid ${lc}44`:`1px solid ${isActive?lc:isBar?`${lc}44`:isBeat?'rgba(255,255,255,0.07)':'rgba(255,255,255,0.03)'}`,
                      background:isActive?`${lc}88`:isTied?`${lc}1a`:on?`${lc}${Math.round(clamp((sd.p||1),0.3,1)*255).toString(16).padStart(2,'0')}`:'rgba(255,255,255,0.02)',
                      boxShadow:isActive?`0 0 7px ${lc}77`:on&&!isTied?`0 0 2px ${lc}22`:'none',
                      cursor:'pointer',transition:'background 0.03s',
                    }}/>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Note info row */}
        <div style={{display:'flex',gap:1.5,flexShrink:0,height:12}}>
          {visIdx.map(idx=>{
            const bn=bassLine[idx],sn=synthLine[idx];
            const hasBass=patterns.bass[idx]?.on;
            const hasSynth=patterns.synth[idx]?.on;
            return(
              <div key={idx} style={{flex:1,textAlign:'center'}}>
                {(hasBass||hasSynth)&&<span style={{fontSize:5,color:'rgba(255,255,255,0.9)',fontFamily:'Space Mono,monospace'}}>{hasBass?noteValueToDisplay(bn):noteValueToDisplay(sn)}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT — Macro knobs + scenes */}
      <div style={{width:compact?'100%':118,display:'flex',flexDirection:'column',gap:4,flexShrink:0,order:compact?3:3}}>
        {/* Main macro faders */}
        <div style={{fontSize:6.75,color:'rgba(255,255,255,0.9)',letterSpacing:'0.18em',textTransform:'uppercase',marginBottom:1}}>MACROS</div>
        {[
          {label:'MASTER',v:master,s:setMaster,c:'#ffffff'},
          {label:'SPACE',v:space,s:setSpace,c:'#44ffcc'},
          {label:'TONE',v:tone,s:setTone,c:'#22d3ee'},
          {label:'DRIVE',v:drive,s:setDrive,c:'#ff8844'},
          {label:'GROOVE',v:grooveAmt,s:setGrooveAmt,c:'#ffdd00'},
          {label:'SWING',v:swing,s:setSwing,min:0,max:0.25,c:'#aa88ff'},
          {label:'AUTO INT',v:autopilotIntensity,s:setAutopilotIntensity,c:gc},
        ].map(({label,v,s,c,min=0,max=1})=>(
          <div key={label} style={{display:'flex',flexDirection:'column',gap:1}}>
            <div style={{display:'flex',justifyContent:'space-between'}}>
              <span style={{fontSize:6.75,letterSpacing:'0.08em',color:'rgba(255,255,255,0.94)',textTransform:'uppercase'}}>{label}</span>
              <span style={{fontSize:6.75,color:c,fontFamily:'Space Mono,monospace'}}>{((v-min)/(max-min)*100).toFixed(0)}</span>
            </div>
            <input type="range" min={min} max={max} step={0.01} value={v} onChange={e=>s(Number(e.target.value))} style={{width:'100%',color:c,accentColor:c,height:12}}/>
          </div>
        ))}

        <div style={{fontSize:6.75,color:'rgba(255,255,255,0.9)',letterSpacing:'0.18em',textTransform:'uppercase',marginTop:1}}>LANES</div>
        {[
          {label:'DRUM VOL',value:laneVolume.kick,min:0,max:1.2,color:'#ffb347',onChange:v=>setLaneVolume(p=>({...p,kick:v,snare:Math.min(1.2,v*0.96),hat:Math.min(1.2,v*0.82)}))},
          {label:'BASS VOL',value:laneVolume.bass,min:0,max:1.2,color:'#22d3ee',onChange:v=>setLaneVolume(p=>({...p,bass:v}))},
          {label:'SYN VOL',value:laneVolume.synth,min:0,max:1.2,color:gc,onChange:v=>setLaneVolume(p=>({...p,synth:v}))},
          {label:'SYN PROB',value:laneProbability.synth,min:0,max:1,color:gc,onChange:v=>setLaneProbability(p=>({...p,synth:v}))},
          {label:'CHORD',value:synthChordChance,min:0,max:1,color:'#c084fc',onChange:v=>setSynthChordChance(v)},
          {label:'HOLD',value:synthHold,min:0,max:1,color:'#7dd3fc',onChange:v=>setSynthHold(v)},
        ].map(({label,value,min,max,color,onChange})=>(
          <div key={label} style={{display:'flex',flexDirection:'column',gap:1}}>
            <div style={{display:'flex',justifyContent:'space-between'}}>
              <span style={{fontSize:6.4,letterSpacing:'0.08em',color:'rgba(255,255,255,0.94)',textTransform:'uppercase'}}>{label}</span>
              <span style={{fontSize:6.4,color, fontFamily:'Space Mono,monospace'}}>{(((value-min)/(max-min||1))*100).toFixed(0)}</span>
            </div>
            <input type="range" min={min} max={max} step={0.01} value={value} onChange={e=>onChange(Number(e.target.value))} style={{width:'100%',accentColor:color,height:12}}/>
          </div>
        ))}
        <label style={{display:'flex',flexDirection:'column',gap:1}}>
          <span style={{fontSize:6.4,letterSpacing:'0.08em',color:'rgba(255,255,255,0.94)',textTransform:'uppercase'}}>SYN CURVE</span>
          <select value={synthCurve} onChange={e=>setSynthCurve(e.target.value)} style={{background:'rgba(255,255,255,0.04)',border:`1px solid ${gc}33`,color:gc,borderRadius:3,padding:'3px 5px',fontSize:7.1,fontFamily:'Space Mono,monospace'}}>
            {SYNTH_CURVES.map(cur=><option key={cur} value={cur} style={{color:'#111',background:'#f2f2f2'}}>{cur}</option>)}
          </select>
        </label>

        <div style={{flex:1}}/>

        {/* Scenes */}
        <div style={{fontSize:6.75,color:'rgba(255,255,255,0.9)',letterSpacing:'0.18em',textTransform:'uppercase',marginBottom:1}}>SCENES</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:2}}>
          {savedScenes.map((sc,i)=>(
            <div key={i} style={{display:'flex',flexDirection:'column',gap:1}}>
              <button onClick={()=>loadScene(i)} style={{
                padding:'4px 2px',borderRadius:2,border:`1px solid ${sc?gc+'44':'rgba(255,255,255,0.07)'}`,
                background:sc?`${gc}0e`:'rgba(255,255,255,0.015)',
                color:sc?gc:'rgba(255,255,255,0.9)',
                fontSize:7.75,fontWeight:700,cursor:'pointer',fontFamily:'Space Mono,monospace',
                textAlign:'center',
              }}>
                S{i+1}{sc?'◆':''}
              </button>
              <button onClick={()=>saveScene(i)} style={{padding:'1px',borderRadius:2,border:'1px solid rgba(255,255,255,0.05)',background:'rgba(255,255,255,0.015)',color:'rgba(255,255,255,0.9)',fontSize:6.25,cursor:'pointer',fontFamily:'Space Mono,monospace',textAlign:'center'}}>SAVE</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const navBtn={padding:'1px 5px',borderRadius:2,border:'1px solid rgba(255,255,255,0.09)',background:'rgba(255,255,255,0.03)',color:'rgba(255,255,255,0.97)',fontSize:9,cursor:'pointer',fontFamily:'Space Mono,monospace'};

function PresetSelect({label,value,options,onChange,accent='#ffffff',compact=false}){
  return(
    <label style={{display:'flex',flexDirection:'column',gap:2,minWidth:compact?112:124}}>
      <span style={{fontSize:6.75,color:'rgba(255,255,255,0.93)',letterSpacing:'0.12em',textTransform:'uppercase'}}>{label}</span>
      <select value={value} onChange={e=>onChange(e.target.value)} style={{background:'rgba(255,255,255,0.04)',border:`1px solid ${accent}33`,color:accent,borderRadius:4,padding:compact?'4px 6px':'5px 7px',fontSize:7.75,fontFamily:'Space Mono,monospace',outline:'none'}}>
        {Object.entries(options).map(([key,preset])=><option key={key} value={key} style={{color:'#111',background:'#f2f2f2'}}>{preset.label}</option>)}
      </select>
    </label>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STUDIO VIEW — detailed editor
// ─────────────────────────────────────────────────────────────────────────────
function StudioView({genre,gc,patterns,bassLine,synthLine,laneLen,step,page,setPage,toggleCell,setNote,modeName,laneVU,space,setSpace,tone,setTone,noiseMix,setNoiseMix,drive,setDrive,compress,setCompress,bassFilter,setBassFilter,synthFilter,setSynthFilter,drumDecay,setDrumDecay,bassSubAmt,setBassSubAmt,fmIdx,setFmIdx,master,setMaster,swing,setSwing,humanize,setHumanize,grooveAmt,setGrooveAmt,grooveProfile,setGrooveProfile,regenerateSection,currentSectionName,undoLen,redoLen,undo,redo,recState,startRec,stopRec,recordings,exportJSON,importRef,importJSON,savedScenes,saveScene,loadScene,projectName,setProjectName,clearPattern,polySynth,setPolySynth,bassStack,setBassStack,bassPreset,synthPreset,drumPreset,performancePreset,applyBassPreset,applySynthPreset,applyDrumPreset,applyPerformancePreset,laneVolume,setLaneVolume,laneProbability,setLaneProbability,synthChordChance,setSynthChordChance,synthHold,setSynthHold,synthCurve,setSynthCurve,compact,phone}){
  const [tab,setTab]=useState('mixer');
  const [noteEditLane,setNoteEditLane]=useState('bass');
  const visibleStart=page*16,visibleEnd=Math.min(visibleStart+16,MAX_STEPS);
  const visIdx=Array.from({length:visibleEnd-visibleStart},(_,i)=>visibleStart+i);
  const mode=MODES[modeName]||MODES.minor;
  const notePool=noteEditLane==='bass'?mode.b:mode.s;

  return(
    <div style={{flex:1,display:'flex',flexDirection:compact?'column':'row',gap:5,padding:phone?'8px':'5px 7px 8px 7px',minHeight:0,overflowY:'auto',overflowX:'hidden'}}>

      {/* LEFT — Grid editor */}
      <div style={{flex:1,display:'flex',flexDirection:'column',gap:3,minWidth:0}}>
        {/* Grid header */}
        <div style={{display:'flex',alignItems:'center',gap:5,height:20,flexShrink:0}}>
          <span style={{fontSize:7.75,color:'rgba(255,255,255,0.95)',letterSpacing:'0.1em'}}>{genre.toUpperCase()} · {modeName.toUpperCase()} · {currentSectionName.toUpperCase()}</span>
          <div style={{flex:1}}/>
          <button onClick={undo} disabled={undoLen===0} style={{...navBtn,opacity:undoLen>0?1:0.3,fontSize:7.75}}>↩ ({undoLen})</button>
          <button onClick={redo} disabled={redoLen===0} style={{...navBtn,opacity:redoLen>0?1:0.3,fontSize:7.75}}>↪ ({redoLen})</button>
          <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0} style={{...navBtn,opacity:page===0?0.3:1}}>‹</button>
          <span style={{fontSize:7.75,color:'rgba(255,255,255,0.92)',fontFamily:'Space Mono,monospace'}}>pg {page+1}/4</span>
          <button onClick={()=>setPage(p=>Math.min(3,p+1))} disabled={page===3} style={{...navBtn,opacity:page===3?0.3:1}}>›</button>
        </div>

        {/* Lane grids */}
        {['kick','snare','hat','bass','synth'].map(lane=>{
          const lc=LANE_CLR[lane];const ll=laneLen[lane]||16;const vu=laneVU[lane]||0;
          return(
            <div key={lane} style={{flex:1,display:'flex',alignItems:'stretch',gap:4,minHeight:0}}>
              <div style={{width:36,flexShrink:0,display:'flex',flexDirection:'column',justifyContent:'center',gap:1}}>
                <span style={{fontSize:6.75,fontWeight:700,color:lc,letterSpacing:'0.12em',textTransform:'uppercase'}}>{lane}</span>
                <div style={{height:2,borderRadius:1,background:'rgba(255,255,255,0.05)',overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${vu*100}%`,background:lc,borderRadius:1,transition:'width 0.04s'}}/>
                </div>
              </div>
              <div style={{flex:1,display:'grid',gridTemplateColumns:`repeat(${visIdx.length},1fr)`,gap:1.5,alignItems:'stretch'}}>
                {visIdx.map(idx=>{
                  if(idx>=ll)return<div key={idx} style={{borderRadius:2,background:'rgba(255,255,255,0.015)',opacity:0.4}}/>;
                  const sd=patterns[lane][idx];const on=sd.on,isActive=step===idx;
                  const isBeat=idx%4===0,isBar=idx%16===0;
                  return(
                    <button key={idx} onClick={()=>toggleCell(lane,idx)} style={{
                      borderRadius:2,border:`1px solid ${isActive?lc:isBar?`${lc}38`:isBeat?'rgba(255,255,255,0.07)':'rgba(255,255,255,0.03)'}`,
                      background:isActive?`${lc}77`:on?`${lc}66`:'rgba(255,255,255,0.02)',
                      cursor:'pointer',transition:'background 0.03s',
                    }}/>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Note editor row */}
        <div style={{flexShrink:0,borderTop:'1px solid rgba(255,255,255,0.05)',paddingTop:4}}>
          <div style={{display:'flex',gap:4,marginBottom:3,alignItems:'center'}}>
            <span style={{fontSize:7.75,color:'rgba(255,255,255,0.94)',letterSpacing:'0.12em'}}>NOTES</span>
            {['bass','synth'].map(l=>(
              <button key={l} onClick={()=>setNoteEditLane(l)} style={{...navBtn,border:`1px solid ${noteEditLane===l?LANE_CLR[l]:'rgba(255,255,255,0.1)'}`,color:noteEditLane===l?LANE_CLR[l]:'rgba(255,255,255,0.95)',fontSize:7.75}}>{l}</button>
            ))}
          </div>
          <div style={{display:'grid',gridTemplateColumns:`repeat(${visIdx.length},1fr)`,gap:1.5}}>
            {visIdx.map(idx=>{
              const lc=LANE_CLR[noteEditLane];
              const isOn=noteEditLane==='bass'?patterns.bass[idx]?.on:patterns.synth[idx]?.on;
              const curNote=noteEditLane==='bass'?bassLine[idx]:synthLine[idx];
              const curRoot=noteValueRoot(curNote);
              const cur=notePool.indexOf(curRoot);
              return(
                <div key={idx} style={{opacity:isOn?1:0.2}}>
                  <button disabled={!isOn} onClick={()=>{if(!isOn)return;const next=notePool[(cur+1)%notePool.length];setNote(noteEditLane,idx,next);}}
                    style={{width:'100%',padding:'2px 0',borderRadius:2,border:`1px solid ${isOn?lc+'44':'rgba(255,255,255,0.04)'}`,background:isOn?`${lc}1a`:'rgba(255,255,255,0.01)',color:isOn?lc:'rgba(255,255,255,0.9)',fontSize:6.75,cursor:isOn?'pointer':'default',fontFamily:'Space Mono,monospace',textAlign:'center'}}>
                    {noteValueToDisplay(curNote)||'—'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* RIGHT — Controls */}
      <div style={{width:compact?'100%':178,display:'flex',flexDirection:'column',gap:0,flexShrink:0,borderLeft:compact?'none':'1px solid rgba(255,255,255,0.05)',borderTop:compact?'1px solid rgba(255,255,255,0.05)':'none'}}>
        {/* Tabs */}
        <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:4,alignItems:'flex-end'}}>
          <PresetSelect label='BASS' value={bassPreset} options={SOUND_PRESETS.bass} onChange={applyBassPreset} accent='#22d3ee' compact />
          <PresetSelect label='SYNTH' value={synthPreset} options={SOUND_PRESETS.synth} onChange={applySynthPreset} accent={gc} compact />
          <PresetSelect label='DRUM' value={drumPreset} options={SOUND_PRESETS.drum} onChange={applyDrumPreset} accent='#ffb347' compact />
          <PresetSelect label='PERF' value={performancePreset} options={SOUND_PRESETS.performance} onChange={applyPerformancePreset} accent='#7ee787' compact />
          <button onClick={clearPattern} style={{padding:'4px 8px',borderRadius:3,border:'1px solid rgba(255,80,80,0.3)',background:'rgba(255,80,80,0.08)',color:'#ff8a8a',fontSize:7.75,cursor:'pointer',fontFamily:'Space Mono,monospace'}}>CLEAR</button><button onClick={()=>setPolySynth(v=>!v)} style={{padding:'4px 8px',borderRadius:3,border:`1px solid ${polySynth?gc:'rgba(255,255,255,0.08)'}`,background:polySynth?`${gc}18`:'rgba(255,255,255,0.03)',color:polySynth?gc:'rgba(255,255,255,0.95)',fontSize:7.75,cursor:'pointer',fontFamily:'Space Mono,monospace'}}>SYNTH POLY</button><button onClick={()=>setBassStack(v=>!v)} style={{padding:'4px 8px',borderRadius:3,border:'1px solid rgba(34,211,238,0.25)',background:bassStack?'rgba(34,211,238,0.12)':'rgba(255,255,255,0.03)',color:bassStack?'#22d3ee':'rgba(255,255,255,0.95)',fontSize:7.75,cursor:'pointer',fontFamily:'Space Mono,monospace'}}>BASS STACK</button></div><div style={{display:'flex',borderBottom:'1px solid rgba(255,255,255,0.05)',flexShrink:0}}>
          {['mixer','synth','session'].map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:'5px 0',fontSize:7.25,fontWeight:700,letterSpacing:'0.1em',border:'none',background:'transparent',color:tab===t?gc:'rgba(255,255,255,0.9)',cursor:'pointer',borderBottom:tab===t?`2px solid ${gc}`:'2px solid transparent',textTransform:'uppercase',fontFamily:'Space Mono,monospace',transition:'color 0.1s'}}>{t}</button>
          ))}
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'6px 7px',display:'flex',flexDirection:'column',gap:4}}>

          {tab==='mixer'&&<>
            {[
              {l:'MASTER',v:master,s:setMaster,c:'#ffffff'},
              {l:'SPACE',v:space,s:setSpace,c:'#44ffcc'},
              {l:'TONE',v:tone,s:setTone,c:'#22d3ee'},
              {l:'NOISE',v:noiseMix,s:setNoiseMix,c:'#aaaaaa'},
              {l:'DRIVE',v:drive,s:setDrive,c:'#ff8844'},
              {l:'COMPRESS',v:compress,s:setCompress,c:'#ffaa44'},
              {l:'BASS FILTER',v:bassFilter,s:setBassFilter,c:LANE_CLR.bass},
              {l:'SYNTH FILTER',v:synthFilter,s:setSynthFilter,c:LANE_CLR.synth},
              {l:'DRUM DECAY',v:drumDecay,s:setDrumDecay,c:LANE_CLR.kick},
              {l:'BASS SUB',v:bassSubAmt,s:setBassSubAmt,c:LANE_CLR.bass},
              {l:'SWING',v:swing,s:setSwing,min:0,max:0.25,c:'#aa88ff'},
              {l:'HUMANIZE',v:humanize,s:setHumanize,min:0,max:0.05,c:'#88aaff'},
              {l:'GROOVE AMT',v:grooveAmt,s:setGrooveAmt,c:'#ffdd00'},
              {l:'FM INDEX',v:fmIdx,s:setFmIdx,min:0,max:3,c:'#cc88ff'},
            ].map(({l,v,s,c,min=0,max=1})=>(
              <div key={l}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:0}}>
                  <span style={{fontSize:6.75,letterSpacing:'0.08em',color:'rgba(255,255,255,0.94)',textTransform:'uppercase'}}>{l}</span>
                  <span style={{fontSize:6.75,color:c,fontFamily:'Space Mono,monospace'}}>{((v-min)/(max-min)*100).toFixed(0)}</span>
                </div>
                <input type="range" min={min} max={max} step={(max-min)/200} value={v} onChange={e=>s(Number(e.target.value))} style={{width:'100%',accentColor:c,color:c,height:12}}/>
              </div>
            ))}
            <div>
              <div style={{fontSize:6.75,color:'rgba(255,255,255,0.92)',letterSpacing:'0.1em',marginBottom:2,textTransform:'uppercase'}}>LANE MIX</div>
              {[
                {l:'DRUM VOL',v:laneVolume.kick,s:v=>setLaneVolume(p=>({...p,kick:v,snare:Math.min(1.2,v*0.96),hat:Math.min(1.2,v*0.82)})),min:0,max:1.2,c:'#ffb347'},
                {l:'BASS VOL',v:laneVolume.bass,s:v=>setLaneVolume(p=>({...p,bass:v})),min:0,max:1.2,c:LANE_CLR.bass},
                {l:'SYNTH VOL',v:laneVolume.synth,s:v=>setLaneVolume(p=>({...p,synth:v})),min:0,max:1.2,c:LANE_CLR.synth},
                {l:'DRUM PROB',v:laneProbability.kick,s:v=>setLaneProbability(p=>({...p,kick:v,snare:v,hat:v})),min:0,max:1,c:'#ffb347'},
                {l:'BASS PROB',v:laneProbability.bass,s:v=>setLaneProbability(p=>({...p,bass:v})),min:0,max:1,c:LANE_CLR.bass},
                {l:'SYNTH PROB',v:laneProbability.synth,s:v=>setLaneProbability(p=>({...p,synth:v})),min:0,max:1,c:LANE_CLR.synth},
              ].map(({l,v,s,c,min=0,max=1})=>(
                <div key={l}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:0}}>
                    <span style={{fontSize:6.75,letterSpacing:'0.08em',color:'rgba(255,255,255,0.94)',textTransform:'uppercase'}}>{l}</span>
                    <span style={{fontSize:6.75,color:c,fontFamily:'Space Mono,monospace'}}>{((v-min)/(max-min)*100).toFixed(0)}</span>
                  </div>
                  <input type="range" min={min} max={max} step={0.01} value={v} onChange={e=>s(Number(e.target.value))} style={{width:'100%',accentColor:c,color:c,height:12}}/>
                </div>
              ))}
            </div>
            <div>
              <div style={{fontSize:6.75,color:'rgba(255,255,255,0.92)',letterSpacing:'0.1em',marginBottom:2,textTransform:'uppercase'}}>GROOVE PROFILE</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:2}}>
                {['steady','broken','bunker','float'].map(gp=>(
                  <button key={gp} onClick={()=>setGrooveProfile(gp)} style={{
                    padding:'3px',borderRadius:2,border:`1px solid ${grooveProfile===gp?gc:'rgba(255,255,255,0.08)'}`,
                    background:grooveProfile===gp?`${gc}18`:'rgba(255,255,255,0.02)',
                    color:grooveProfile===gp?gc:'rgba(255,255,255,0.94)',
                    fontSize:7.25,cursor:'pointer',fontFamily:'Space Mono,monospace',letterSpacing:'0.06em',textTransform:'uppercase',
                  }}>{gp}</button>
                ))}
              </div>
            </div>
          </>}

          {tab==='synth'&&<>
            <div style={{fontSize:6.75,color:'rgba(255,255,255,0.92)',letterSpacing:'0.1em',marginBottom:2,textTransform:'uppercase'}}>SECTION GENERATOR</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:2}}>
              {Object.keys(SECTIONS).map(sec=>(
                <button key={sec} onClick={()=>regenerateSection(sec)} style={{
                  padding:'5px 3px',borderRadius:2,border:`1px solid ${currentSectionName===sec?gc:'rgba(255,255,255,0.08)'}`,
                  background:currentSectionName===sec?`${gc}18`:'rgba(255,255,255,0.02)',
                  color:currentSectionName===sec?gc:'rgba(255,255,255,0.96)',
                  fontSize:7.75,cursor:'pointer',fontFamily:'Space Mono,monospace',letterSpacing:'0.05em',textTransform:'uppercase',
                }}>{sec}</button>
              ))}
            </div>
            <div style={{marginTop:3,fontSize:7.25,color:'rgba(255,255,255,0.88)',lineHeight:1.5}}>
              Click to regenerate with that section's feel.
            </div>
            <div style={{marginTop:4}}>
              <div style={{fontSize:6.75,color:'rgba(255,255,255,0.92)',letterSpacing:'0.1em',marginBottom:2,textTransform:'uppercase'}}>SYNTH EXPRESSION</div>
              {[
                {l:'CHORD CHANCE',v:synthChordChance,s:setSynthChordChance,c:'#c084fc'},
                {l:'HOLD',v:synthHold,s:setSynthHold,c:'#7dd3fc'},
              ].map(({l,v,s,c})=>(
                <div key={l}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:0}}>
                    <span style={{fontSize:6.75,letterSpacing:'0.08em',color:'rgba(255,255,255,0.94)',textTransform:'uppercase'}}>{l}</span>
                    <span style={{fontSize:6.75,color:c,fontFamily:'Space Mono,monospace'}}>{(v*100).toFixed(0)}</span>
                  </div>
                  <input type="range" min={0} max={1} step={0.01} value={v} onChange={e=>s(Number(e.target.value))} style={{width:'100%',accentColor:c,color:c,height:12}}/>
                </div>
              ))}
              <label style={{display:'flex',flexDirection:'column',gap:2,marginTop:4}}>
                <span style={{fontSize:6.75,color:'rgba(255,255,255,0.93)',letterSpacing:'0.12em',textTransform:'uppercase'}}>SYNTH CURVE</span>
                <select value={synthCurve} onChange={e=>setSynthCurve(e.target.value)} style={{background:'rgba(255,255,255,0.04)',border:`1px solid ${gc}33`,color:gc,borderRadius:4,padding:'5px 7px',fontSize:7.75,fontFamily:'Space Mono,monospace',outline:'none'}}>
                  {SYNTH_CURVES.map(cur=><option key={cur} value={cur} style={{color:'#111',background:'#f2f2f2'}}>{cur}</option>)}
                </select>
              </label>
            </div>
          </>}

          {tab==='session'&&<>
            {/* Recording */}
            <button onClick={recState==='idle'?startRec:stopRec} style={{
              padding:'7px',borderRadius:3,border:`1px solid ${recState==='recording'?'#ff2244':'rgba(255,255,255,0.12)'}`,
              background:recState==='recording'?'rgba(255,34,68,0.12)':'rgba(255,255,255,0.03)',
              color:recState==='recording'?'#ff2244':'rgba(255,255,255,0.55)',
              fontSize:8.5,fontWeight:700,cursor:'pointer',fontFamily:'Space Mono,monospace',letterSpacing:'0.1em',textAlign:'center',
            }}>{recState==='recording'?'■ STOP REC':'● REC'}</button>
            {recordings.map((r,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:3,padding:'3px 5px',borderRadius:3,background:'rgba(255,255,255,0.025)',border:'1px solid rgba(255,255,255,0.05)'}}>
                <audio src={r.url} controls style={{flex:1,height:22,filter:'invert(1)',opacity:0.65}}/>
                <a href={r.url} download={r.name} style={{color:gc,fontSize:7.25,textDecoration:'none',fontFamily:'Space Mono,monospace'}}>DL</a>
              </div>
            ))}

            <div style={{height:1,background:'rgba(255,255,255,0.06)',margin:'4px 0'}}/>

            {/* Scenes */}
            <div style={{fontSize:7.75,color:'rgba(255,255,255,0.94)',letterSpacing:'0.12em',marginBottom:2,textTransform:'uppercase'}}>SCENES (6)</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:3}}>
              {savedScenes.map((sc,i)=>(
                <div key={i} style={{display:'flex',flexDirection:'column',gap:1}}>
                  <button onClick={()=>loadScene(i)} style={{
                    padding:'5px',borderRadius:3,border:`1px solid ${sc?gc+'44':'rgba(255,255,255,0.08)'}`,
                    background:sc?`${gc}0d`:'rgba(255,255,255,0.02)',
                    color:sc?gc:'rgba(255,255,255,0.92)',
                    fontSize:8.5,cursor:'pointer',fontFamily:'Space Mono,monospace',textAlign:'center',
                  }}>S{i+1}{sc?` ◆`:''}</button>
                  <button onClick={()=>saveScene(i)} style={{padding:'2px',borderRadius:2,border:'1px solid rgba(255,255,255,0.07)',background:'rgba(255,255,255,0.02)',color:'rgba(255,255,255,0.94)',fontSize:6.75,cursor:'pointer',fontFamily:'Space Mono,monospace',textAlign:'center'}}>SAVE</button>
                </div>
              ))}
            </div>

            <div style={{height:1,background:'rgba(255,255,255,0.06)',margin:'4px 0'}}/>

            {/* Export/Import */}
            <button onClick={exportJSON} style={{padding:'7px',borderRadius:3,border:`1px solid ${gc}44`,background:`${gc}0d`,color:gc,fontSize:8.5,cursor:'pointer',fontFamily:'Space Mono,monospace',letterSpacing:'0.1em',textAlign:'center',textTransform:'uppercase'}}>EXPORT JSON</button>
            <button onClick={()=>importRef.current?.click()} style={{padding:'7px',borderRadius:3,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.03)',color:'rgba(255,255,255,0.5)',fontSize:8.5,cursor:'pointer',fontFamily:'Space Mono,monospace',letterSpacing:'0.1em',textAlign:'center',textTransform:'uppercase'}}>IMPORT JSON</button>
            <input ref={importRef} type="file" accept=".json" onChange={importJSON} style={{display:'none'}}/>

            <div style={{height:1,background:'rgba(255,255,255,0.06)',margin:'2px 0'}}/>
            <div style={{fontSize:7.25,color:'rgba(255,255,255,0.9)',lineHeight:1.7,letterSpacing:'0.06em'}}>
              SHORTCUTS<br/>
              SPACE = play/stop<br/>
              A=drop S=break D=build<br/>
              F=groove G=tension H=fill<br/>
              M=mutate R=regen P=autopilot<br/>
              T=tap tempo Z=undo · SHIFT+Z / Y=redo ESC=panic
            </div>
          </>}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SONG VIEW — arc composer and arrangement
// ─────────────────────────────────────────────────────────────────────────────
function SongView({genre,gc,songArc,arcIdx,songActive,startSongArc,stopSongArc,armSongArc,selectedArcIdx,SONG_ARC_NAMES,currentSectionName,SONG_ARCS,SECTIONS,triggerSection,modeName,arpeMode,bpm,compact,phone}){
  const SECTION_COLORS={drop:'#ff2244',break:'#4488ff',build:'#ffaa00',groove:'#00cc66',tension:'#ff6622',fill:'#cc00ff',intro:'#44ffcc',outro:'#aaaaaa'};
  const gd=GENRES[genre];

  return(
    <div style={{flex:1,display:'flex',flexDirection:compact?'column':'row',gap:8,padding:phone?'8px':'6px 12px 12px 12px',minHeight:0,overflowY:'auto',overflowX:'hidden'}}>

      {/* LEFT — Genre info + arc control */}
      <div style={{width:compact?'100%':260,display:'flex',flexDirection:'column',gap:8,flexShrink:0}}>
        {/* Genre card */}
        <div style={{padding:16,borderRadius:8,border:`1px solid ${gc}33`,background:`${gc}08`}}>
          <div style={{fontSize:18,fontWeight:700,color:gc,letterSpacing:'0.2em',textTransform:'uppercase',marginBottom:4}}>{genre}</div>
          <div style={{fontSize:9,color:'rgba(255,255,255,0.96)',letterSpacing:'0.08em',marginBottom:8}}>{gd.description}</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
            {[
              {l:'BPM',v:`${gd.bpm[0]}–${gd.bpm[1]}`},
              {l:'CURRENT',v:bpm},
              {l:'MODE',v:modeName},
              {l:'ARP',v:arpeMode},
              {l:'DENSITY',v:`${Math.round(gd.density*100)}%`},
              {l:'CHAOS',v:`${Math.round(gd.chaos*100)}%`},
              {l:'NOISE',v:gd.noiseColor},
              {l:'BASS',v:gd.bassMode},
            ].map(({l,v})=>(
              <div key={l}>
                <div style={{fontSize:6.75,color:'rgba(255,255,255,0.92)',letterSpacing:'0.12em',textTransform:'uppercase'}}>{l}</div>
                <div style={{fontSize:9,color:'rgba(255,255,255,0.7)',fontFamily:'Space Mono,monospace'}}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Arc control */}
        <button onClick={songActive?stopSongArc:startSongArc} style={{
          padding:'12px',borderRadius:6,border:`1px solid ${songActive?'#ff2244':gc}`,
          background:songActive?'rgba(255,34,68,0.12)':`${gc}18`,
          color:songActive?'#ff2244':gc,
          fontSize:10,fontWeight:700,cursor:'pointer',fontFamily:'Space Mono,monospace',
          letterSpacing:'0.15em',textTransform:'uppercase',
          boxShadow:songActive?'0 0 16px rgba(255,34,68,0.3)':`0 0 16px ${gc}33`,
        }}>{songActive?'■ STOP ARC':'▶ START ARC'}</button>

        {songActive&&(
          <div style={{padding:10,borderRadius:6,border:'1px solid rgba(255,255,255,0.08)',background:'rgba(255,255,255,0.02)'}}>
            <div style={{fontSize:7.75,color:'rgba(255,255,255,0.94)',letterSpacing:'0.12em',marginBottom:6,textTransform:'uppercase'}}>ARC PROGRESS</div>
            <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
              {songArc.map((s,i)=>{
                const sc=SECTION_COLORS[s]||'#ffffff';
                return(
                  <div key={i} style={{
                    padding:'4px 8px',borderRadius:3,
                    background:i===arcIdx?`${sc}33`:i<arcIdx?`${sc}11`:'rgba(255,255,255,0.03)',
                    border:`1px solid ${i===arcIdx?sc:i<arcIdx?`${sc}44`:'rgba(255,255,255,0.06)'}`,
                    color:i===arcIdx?sc:i<arcIdx?`${sc}88`:'rgba(255,255,255,0.92)',
                    fontSize:8.5,fontFamily:'Space Mono,monospace',fontWeight:700,
                    transition:'all 0.2s',
                  }}>{s}</div>
                );
              })}
            </div>
          </div>
        )}

        {/* Preset arcs */}
        <div style={{fontSize:7.75,color:'rgba(255,255,255,0.92)',letterSpacing:'0.15em',textTransform:'uppercase',marginTop:4}}>PRESET ARCS</div>
        {SONG_ARCS.map((arc,i)=>{
          const isSelected=selectedArcIdx===i;
          return(
            <button key={i} onClick={()=>armSongArc(i)} style={{
              padding:'8px 10px',borderRadius:4,border:`1px solid ${isSelected?gc:'rgba(255,255,255,0.08)'}`,
              background:isSelected?`${gc}12`:'rgba(255,255,255,0.02)',color:'rgba(255,255,255,0.97)',
              fontSize:7.75,cursor:'pointer',fontFamily:'Space Mono,monospace',textAlign:'left',
              letterSpacing:'0.04em',lineHeight:1.4,
              boxShadow:isSelected?`0 0 12px ${gc}22`:'none',
            }}>
              <div style={{fontSize:6.75,color:isSelected?gc:'rgba(255,255,255,0.86)',letterSpacing:'0.14em',textTransform:'uppercase',marginBottom:3}}>{SONG_ARC_NAMES[i]||`Preset ${i+1}`}</div>
              {arc.join(' → ')}
            </button>
          );
        })}
      </div>

      {/* RIGHT — Section library + direct trigger */}
      <div style={{flex:1,display:'flex',flexDirection:'column',gap:6}}>
        <div style={{fontSize:7.75,color:'rgba(255,255,255,0.92)',letterSpacing:'0.2em',textTransform:'uppercase'}}>SECTION LIBRARY — CLICK TO TRIGGER</div>
        <div style={{display:'grid',gridTemplateColumns:phone?'repeat(2,1fr)':'repeat(4,1fr)',gap:6}}>
          {Object.entries(SECTIONS).map(([name,data])=>{
            const sc=SECTION_COLORS[name]||'#ffffff';
            const isActive=currentSectionName===name;
            return(
              <button key={name} onClick={()=>triggerSection(name)} style={{
                padding:'18px 12px',borderRadius:6,border:`1px solid ${isActive?sc:sc+'33'}`,
                background:isActive?`${sc}18`:`${sc}06`,
                color:isActive?sc:`${sc}88`,
                cursor:'pointer',fontFamily:'Space Mono,monospace',
                textAlign:'left',transition:'all 0.1s',
                boxShadow:isActive?`0 0 16px ${sc}44`:'none',
              }}>
                <div style={{fontSize:13,fontWeight:700,letterSpacing:'0.14em',textTransform:'uppercase',marginBottom:6}}>{name}</div>
                <div style={{fontSize:7.75,opacity:0.7,lineHeight:1.6}}>
                  {`k:${Math.round(data.kM*100)}% h:${Math.round(data.hM*100)}%`}<br/>
                  {`b:${Math.round(data.bM*100)}% sy:${Math.round(data.syM*100)}%`}<br/>
                  {`len:${data.lb}x vel:${data.vel}`}<br/>
                  {`${data.bars} bars`}
                </div>
              </button>
            );
          })}
        </div>

        {/* Current section info */}
        <div style={{padding:12,borderRadius:6,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(255,255,255,0.02)',marginTop:4}}>
          <div style={{fontSize:7.75,color:'rgba(255,255,255,0.92)',letterSpacing:'0.15em',textTransform:'uppercase',marginBottom:6}}>CURRENT SESSION</div>
          <div style={{display:'grid',gridTemplateColumns:phone?'repeat(2,1fr)':'repeat(5,1fr)',gap:8}}>
            {[
              {l:'GENRE',v:genre},{l:'SECTION',v:currentSectionName},{l:'MODE',v:modeName},
              {l:'ARP',v:arpeMode},{l:'STATUS',v:songActive?`arc[${arcIdx+1}/${songArc.length}]`:'manual'},
            ].map(({l,v})=>(
              <div key={l}>
                <div style={{fontSize:6.75,color:'rgba(255,255,255,0.9)',letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:2}}>{l}</div>
                <div style={{fontSize:9,color:gc,fontFamily:'Space Mono,monospace',fontWeight:700}}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
