/**
 * On-Chain HTML Renderer for Genesis Sparks NFTs
 *
 * Self-contained HTML/JS that renders NFTs from DNA.
 * Inscribed once, referenced by all NFT metadata.
 *
 * Features:
 * - Pure SVG rendering (no external dependencies)
 * - DNA-deterministic output
 * - CSS custom properties for palette injection (var(--skin), var(--shade), etc.)
 * - SVG clipPath masks: glowing eyes visible through Rogue hoods / Warrior helmets
 * - Stroke outlines for contrast (0.5px dark border on main body)
 * - GPU drop-shadow for depth and tridimensionality
 * - Animated effects for rare NFTs (GPU-accelerated keyframes)
 * - Heritage watermark backgrounds at low opacity (0.15)
 * - Responsive sizing
 *
 * Size target: ~6KB minified + gzipped
 */

// =============================================================================
// RENDERER TEMPLATE
// =============================================================================

/**
 * Generate the on-chain renderer HTML
 */
export function generateOnChainRenderer(options: {
  libraryInscriptionId: string;
  title?: string;
  version?: number;
}): string {
  const { libraryInscriptionId, title = "Genesis Spark", version = 1 } = options;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;background:#0f0f1b;display:flex;align-items:center;justify-content:center}
#nft{image-rendering:pixelated;image-rendering:crisp-edges;overflow:visible}
/* Rarity glow classes — applied to the SVG element */
.glow-common{}
.glow-uncommon{filter:drop-shadow(0 0 2px #22c55e80)}
.glow-rare{filter:drop-shadow(0 0 3px #3b82f6) drop-shadow(0 0 6px #60a5fa80)}
.glow-epic{filter:drop-shadow(0 0 4px #8b5cf6) drop-shadow(0 0 8px #a78bfa80)}
.glow-legendary{filter:drop-shadow(0 0 5px #f59e0b) drop-shadow(0 0 10px #fcd34d80) drop-shadow(0 0 16px #fef3c740);animation:pulse 2s ease-in-out infinite}
.glow-mythic{filter:drop-shadow(0 0 4px #ef4444) drop-shadow(0 0 8px #f97316) drop-shadow(0 0 12px #eab308);animation:rainbow 3s linear infinite}
/* Depth shadow on character body (inner drop-shadow via filter on <g> layer) */
.body-shadow{filter:drop-shadow(1px 2px 1px rgba(0,0,0,0.55))}
/* GPU keyframe animations */
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.82}}
@keyframes rainbow{0%{filter:drop-shadow(0 0 8px #ef4444)}25%{filter:drop-shadow(0 0 8px #f97316)}50%{filter:drop-shadow(0 0 8px #22c55e)}75%{filter:drop-shadow(0 0 8px #3b82f6)}100%{filter:drop-shadow(0 0 8px #ef4444)}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-1.5px)}}
@keyframes spark{0%,100%{opacity:0.9;transform:scale(1)}50%{opacity:0.4;transform:scale(0.7)}}
@keyframes runePulse{0%,100%{opacity:0.6}50%{opacity:0.2}}
@keyframes shimmer{0%,100%{opacity:0.7}50%{opacity:0.3}}
.animate-float{animation:float 3s ease-in-out infinite}
.animate-spark{animation:spark 1.2s ease-in-out infinite}
.animate-rune{animation:runePulse 1.8s ease-in-out infinite}
.animate-shimmer{animation:shimmer 1.5s ease-in-out infinite}
</style>
</head>
<body>
<svg id="nft" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"></svg>
<script>
(function(){
'use strict';

// Version ${version}
const LIBRARY_ID='${libraryInscriptionId}';

// Parse URL params or data attribute for DNA
function getDNA(){
  const p=new URLSearchParams(location.search);
  if(p.has('dna'))return p.get('dna');
  const d=document.body.dataset.dna;
  if(d)return d;
  return'0'.repeat(64);
}

// Parse DNA to traits (with input sanitization)
function parseDNA(d){
  // Sanitize: remove non-hex chars, take first 64, pad if needed
  const h=d.replace(/^0x/,'').replace(/[^0-9a-fA-F]/g,'').slice(0,64).padEnd(64,'0');
  return{
    baseType:parseInt(h[0],16)%8,
    bloodline:parseInt(h[1],16)%4,
    heritage:parseInt(h[2],16)%5,
    rarity:parseInt(h[3],16),
    skin:parseInt(h[4],16),
    eyes:parseInt(h[5],16),
    mouth:parseInt(h[6],16),
    acc1:parseInt(h[7],16),
    acc2:parseInt(h[8],16),
    special:parseInt(h[9],16)
  };
}

// Get rarity tier
function getRarity(s){
  if(s>=15)return'mythic';
  if(s>=13)return'legendary';
  if(s>=10)return'epic';
  if(s>=7)return'rare';
  if(s>=4)return'uncommon';
  return'common';
}

// Base type & bloodline lookups
const TYPES=['human','animal','robot','mystic','alien','shaman','elemental','dragon'];
const BLOODS=['royal','warrior','rogue','mystic'];
const HERITAGES=['americas','africa','asia','europa','oceania'];

// Color palettes — all colors referenced via CSS vars injected at render time
// Structure: {skin, shade, shade2, pri, sec, acc, eye}
const PALETTES={
  human:{skin:'#ffcc99',shade:'#e6b380',shade2:'#111',pri:'#f7931a',sec:'#ffc107',acc:'#4fc3f7',eye:'#1f2937'},
  animal:{skin:'#d4a574',shade:'#b48554',shade2:'#111',pri:'#f97316',sec:'#fbbf24',acc:'#84cc16',eye:'#1f2937'},
  robot:{skin:'#7a8a9a',shade:'#5a6a7a',shade2:'#111',pri:'#64748b',sec:'#94a3b8',acc:'#22d3ee',eye:'#22d3ee'},
  mystic:{skin:'#ddd6fe',shade:'#c4b5fd',shade2:'#1e1b4b',pri:'#8b5cf6',sec:'#a78bfa',acc:'#f472b6',eye:'#fbbf24'},
  alien:{skin:'#a7f3d0',shade:'#6ee7b7',shade2:'#111',pri:'#10b981',sec:'#34d399',acc:'#06b6d4',eye:'#000000'},
  shaman:{skin:'#a67c52',shade:'#8a6042',shade2:'#111',pri:'#059669',sec:'#34d399',acc:'#fbbf24',eye:'#fbbf24'},
  elemental:{skin:'#fbbf24',shade:'#f59e0b',shade2:'#111',pri:'#f97316',sec:'#f7c59f',acc:'#ffd700',eye:'#1f2937'},
  dragon:{skin:'#ef4444',shade:'#b91c1c',shade2:'#111',pri:'#dc2626',sec:'#ef4444',acc:'#fbbf24',eye:'#fef08a'}
};

// Bloodline overlays — SVG paths positioned over head/body
// Using clipPath trick: eye windows are punched through hoods for "glowing eyes" effect
const BLOOD_DEFS={
  royal:'<polygon points="10,0 10,2 12,2 12,0" fill="#ffd700"/><polygon points="15,0 15,2 17,2 17,0" fill="#ffd700"/><polygon points="20,0 20,2 22,2 22,0" fill="#ffd700"/><rect x="9" y="1" width="14" height="2" fill="#b8860b"/><rect x="10" y="1" width="12" height="2" fill="#ffd700"/><rect x="11" y="2" width="1" height="1" fill="#dc143c"/><rect x="15" y="1" width="2" height="1" fill="#1e40af"/><rect x="21" y="2" width="1" height="1" fill="#dc143c"/>',
  warrior:'<rect x="7" y="2" width="18" height="4" fill="#4b5563"/><rect x="8" y="1" width="16" height="1" fill="#374151"/><rect x="14" y="0" width="4" height="2" fill="#dc2626"/><rect x="9" y="6" width="2" height="4" fill="#374151"/><rect x="21" y="6" width="2" height="4" fill="#374151"/><rect x="2" y="15" width="6" height="5" fill="#4b5563"/><rect x="24" y="15" width="6" height="5" fill="#4b5563"/><rect x="3" y="16" width="4" height="1" fill="#9ca3af"/><rect x="25" y="16" width="4" height="1" fill="#9ca3af"/><rect x="29" y="8" width="1" height="12" fill="#64748b" opacity="0.6"/>',
  rogue:'<rect x="6" y="2" width="20" height="5" fill="#1f2937"/><rect x="7" y="1" width="18" height="2" fill="#0f172a"/><rect x="8" y="3" width="16" height="4" fill="#111827" opacity="0.8"/><rect x="8" y="8" width="16" height="5" fill="#1f2937"/><rect x="3" y="16" width="3" height="14" fill="#1f2937" opacity="0.85"/><rect x="26" y="16" width="3" height="14" fill="#1f2937" opacity="0.85"/><rect x="0" y="24" width="1" height="5" fill="#94a3b8"/><rect x="31" y="23" width="1" height="5" fill="#94a3b8"/>',
  mystic:'<polygon points="16,-3 10,3 22,3" fill="#8b5cf6"/><rect x="13" y="2" width="6" height="1" fill="#6d28d9"/><circle cx="16" cy="5" r="1.5" fill="#c084fc"/><rect x="1" y="10" width="2" height="6" fill="#8b5cf6" opacity="0.4"/><rect x="29" y="10" width="2" height="6" fill="#8b5cf6" opacity="0.4"/><rect x="0" y="16" width="4" height="12" fill="#4c1d95" opacity="0.35"/><rect x="28" y="16" width="4" height="12" fill="#4c1d95" opacity="0.35"/>'
};

// Heritage watermark backgrounds — very low opacity for elegant texture
const HERITAGE_BG={
  americas:'<rect x="0" y="0" width="32" height="32" fill="#14b8a6" opacity="0.04"/><rect x="13" y="19" width="6" height="6" fill="#fbbf24" opacity="0.09"/><rect x="14" y="20" width="4" height="4" fill="#dc2626" opacity="0.07"/>',
  africa:'<rect x="0" y="0" width="32" height="32" fill="#f59e0b" opacity="0.04"/><rect x="10" y="20" width="12" height="1" fill="#fbbf24" opacity="0.1"/><rect x="10" y="23" width="12" height="1" fill="#fbbf24" opacity="0.1"/>',
  asia:'<rect x="0" y="0" width="32" height="32" fill="#dc2626" opacity="0.04"/><rect x="13" y="20" width="6" height="5" fill="#1f2937" opacity="0.07"/>',
  europa:'<rect x="0" y="0" width="32" height="32" fill="#1e40af" opacity="0.04"/><rect x="13" y="19" width="6" height="7" fill="#4b5563" opacity="0.07"/>',
  oceania:'<rect x="0" y="0" width="32" height="32" fill="#0891b2" opacity="0.04"/>'
};

// Escape HTML to prevent XSS
function esc(v){
  return String(v).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// SVG element builder (XSS-safe)
function el(tag,attrs,children){
  let s='<'+tag;
  for(let k in attrs){
    if(attrs[k]!==undefined)s+=' '+k+'="'+esc(attrs[k])+'"';
  }
  if(children!==undefined){
    s+='>'+children+'</'+tag+'>';
  }else{
    s+='/>';
  }
  return s;
}

// Build CSS custom properties string from palette
function buildCSSVars(p){
  return'--skin:'+p.skin+';--shade:'+p.shade+';--shade2:'+p.shade2+';--pri:'+p.pri+';--sec:'+p.sec+';--acc:'+p.acc+';--eye:'+p.eye;
}

// ── SVG clipPath definition for "glowing eyes through hood" effect ──
// Creates an eye-shaped transparent window at the canonical eye positions
function buildEyeMaskDefs(traits){
  const eyeY=10+traits.eyes%2;
  // Two rectangular eye windows: left (x=10..14) and right (x=18..22)
  return'<defs>'
    +'<clipPath id="eyeWindow">'
    +el('rect',{x:10,y:eyeY-1,width:4,height:3})
    +el('rect',{x:18,y:eyeY-1,width:4,height:3})
    +'</clipPath>'
    +'</defs>';
}

// Render base sprite body with CSS var fill + contrast stroke outline
function renderBase(t,traits){
  const c=PALETTES[TYPES[t]]||PALETTES.human;
  let svg='';
  const eyeY=10+traits.eyes%2;
  const mouthY=14+traits.mouth%2;
  const skin='var(--skin)';
  const shade='var(--shade)';
  const acc='var(--acc)';
  const eye='var(--eye)';
  const dark='var(--shade2,#111)';

  // ── Body (with depth shadow via filter on group) ──
  svg+='<g class="body-shadow">';

  // Body (pixel art style torso and limbs)
  svg+=el('rect',{x:10,y:17,width:12,height:9,fill:skin,stroke:dark,'stroke-width':0.5});
  svg+=el('rect',{x:9,y:18,width:14,height:7,fill:skin});
  svg+=el('rect',{x:10,y:25,width:12,height:1,fill:shade});

  // Head (pixel art style blocky head)
  svg+=el('rect',{x:9,y:5,width:14,height:11,fill:skin,stroke:dark,'stroke-width':0.5});
  svg+=el('rect',{x:8,y:7,width:16,height:7,fill:skin});
  svg+=el('rect',{x:10,y:4,width:12,height:1,fill:skin});
  svg+=el('rect',{x:9,y:15,width:14,height:1,fill:shade});

  // Forehead highlight (pixel art shine)
  svg+=el('rect',{x:12,y:6,width:3,height:1,fill:'#ffffff',opacity:0.35});

  // Eyes (rectangular 4x3 big expressive pixel art eyes)
  svg+=el('rect',{x:10,y:eyeY-1,width:4,height:3,fill:'#fff',stroke:dark,'stroke-width':0.3});
  svg+=el('rect',{x:18,y:eyeY-1,width:4,height:3,fill:'#fff',stroke:dark,'stroke-width':0.3});
  svg+=el('rect',{x:11,y:eyeY-1,width:2,height:3,fill:eye});
  svg+=el('rect',{x:19,y:eyeY-1,width:2,height:3,fill:eye});
  svg+=el('rect',{x:11,y:eyeY-1,width:1,height:1,fill:'#fff'});
  svg+=el('rect',{x:19,y:eyeY-1,width:1,height:1,fill:'#fff'});

  // Mouth (pixel art line mouth)
  svg+=el('rect',{x:14,y:mouthY,width:4,height:1,fill:shade});

  // Type-specific features (100% pixel-perfect)
  if(t===1){// Animal - triangular pixel ears, whiskers, paws
    svg+=el('rect',{x:8,y:3,width:3,height:3,fill:skin});
    svg+=el('rect',{x:7,y:4,width:1,height:2,fill:skin});
    svg+=el('rect',{x:8,y:4,width:1,height:2,fill:'#ffcccc'}); // Inner ear
    svg+=el('rect',{x:21,y:3,width:3,height:3,fill:skin});
    svg+=el('rect',{x:24,y:4,width:1,height:2,fill:skin});
    svg+=el('rect',{x:23,y:4,width:1,height:2,fill:'#ffcccc'}); // Inner ear
    // Whiskers
    svg+=el('rect',{x:5,y:12,width:3,height:1,fill:shade,opacity:0.6});
    svg+=el('rect',{x:6,y:14,width:2,height:1,fill:shade,opacity:0.6});
    svg+=el('rect',{x:24,y:12,width:3,height:1,fill:shade,opacity:0.6});
    svg+=el('rect',{x:24,y:14,width:2,height:1,fill:shade,opacity:0.6});
    // Nose
    svg+=el('rect',{x:15,y:12,width:2,height:1,fill:shade});
    // Tail
    svg+=el('rect',{x:23,y:21,width:3,height:2,fill:skin});
    svg+=el('rect',{x:25,y:18,width:2,height:4,fill:skin});
    svg+=el('rect',{x:24,y:16,width:2,height:3,fill:skin});
  }else if(t===2){// Robot - pixel antenna + LED eyes override
    svg+=el('rect',{x:15,y:2,width:2,height:4,fill:shade});
    svg+=el('rect',{x:15,y:1,width:2,height:1,fill:acc});
    // LED eye glow override
    svg+=el('rect',{x:10,y:eyeY-1,width:4,height:2,fill:acc,opacity:0.9});
    svg+=el('rect',{x:18,y:eyeY-1,width:4,height:2,fill:acc,opacity:0.9});
    svg+=el('rect',{x:11,y:eyeY-1,width:1,height:1,fill:'#fff'});
    svg+=el('rect',{x:19,y:eyeY-1,width:1,height:1,fill:'#fff'});
    // Panel lines
    svg+=el('rect',{x:12,y:14,width:8,height:1,fill:shade,opacity:0.6});
    svg+=el('rect',{x:14,y:15,width:4,height:1,fill:shade,opacity:0.5});
  }else if(t===3||t===5){// Mystic/Shaman - third eye + aura glow
    svg+=el('rect',{x:15,y:3,width:2,height:2,fill:acc,stroke:dark,'stroke-width':0.3});
    svg+=el('rect',{x:15.5,y:3.5,width:1,height:1,fill:'#fff',opacity:0.8});
  }else if(t===4){// Alien - large almond pixel eyes (pure pixel shape)
    svg+=el('rect',{x:9,y:8,width:5,height:6,fill:'#1a1a1a',stroke:dark,'stroke-width':0.4});
    svg+=el('rect',{x:18,y:8,width:5,height:6,fill:'#1a1a1a',stroke:dark,'stroke-width':0.4});
    svg+=el('rect',{x:8,y:9,width:1,height:4,fill:'#1a1a1a'});
    svg+=el('rect',{x:23,y:9,width:1,height:4,fill:'#1a1a1a'});
    svg+=el('rect',{x:10,y:9,width:2,height:2,fill:acc,opacity:0.65});
    svg+=el('rect',{x:19,y:9,width:2,height:2,fill:acc,opacity:0.65});
  }else if(t===6){// Elemental - flame crown (blocky flames)
    svg+=el('rect',{x:12,y:2,width:2,height:3,fill:'#ff6b35',opacity:0.8});
    svg+=el('rect',{x:18,y:2,width:2,height:3,fill:'#ff6b35',opacity:0.8});
    svg+=el('rect',{x:14,y:1,width:4,height:4,fill:'#ffd700',opacity:0.75});
    svg+=el('rect',{x:15,y:0,width:2,height:2,fill:'#ffcc00'});
  }else if(t===7){// Dragon - pixel horns + scales
    svg+=el('rect',{x:8,y:2,width:2,height:3,fill:acc,stroke:dark,'stroke-width':0.4});
    svg+=el('rect',{x:22,y:2,width:2,height:3,fill:acc,stroke:dark,'stroke-width':0.4});
    // Scale texture
    svg+=el('rect',{x:13,y:18,width:2,height:1,fill:'var(--pri)',opacity:0.5});
    svg+=el('rect',{x:17,y:18,width:2,height:1,fill:'var(--pri)',opacity:0.5});
    svg+=el('rect',{x:15,y:19,width:2,height:1,fill:'var(--sec)',opacity:0.5});
  }

  svg+='</g>'; // end body-shadow group
  return svg;
}

// Render bloodline overlay with eye-mask (glowing eyes through hood)
function renderBloodline(b,traits){
  const name=BLOODS[b];
  const defs=BLOOD_DEFS[name];
  if(!defs)return'';

  // For rogue (hood) and warrior (helm), apply eye-window clipPath overlay
  // to allow the base eyes to "glow through" dark accessories
  if(name==='rogue'||name==='warrior'){
    const eyeY=10+traits.eyes%2;
    // Render the bloodline overlay
    let out='<g>'+defs+'</g>';
    // Punch the eye windows back: render the eye layer again OVER the bloodline,
    // clipped to the eye-window area, for the "glowing eyes" effect
    const eyeColor=name==='rogue'?'#ef4444':'var(--acc)';
    out+='<g clip-path="url(#eyeWindow)">';
    out+=el('circle',{cx:12,cy:eyeY,r:1.8,fill:eyeColor,opacity:0.9});
    out+=el('circle',{cx:20,cy:eyeY,r:1.8,fill:eyeColor,opacity:0.9});
    out+=el('circle',{cx:11.5,cy:eyeY-0.5,r:0.45,fill:'#fff',opacity:0.9});
    out+=el('circle',{cx:19.5,cy:eyeY-0.5,r:0.45,fill:'#fff',opacity:0.9});
    out+='</g>';
    return out;
  }

  return'<g>'+defs+'</g>';
}

// Render heritage watermark background (very subtle, opacity 0.04–0.12)
function renderHeritageBg(h){
  const name=HERITAGES[h];
  return HERITAGE_BG[name]||'';
}

// Render rarity effects — particles at corners, no full-canvas auras
function renderRarity(r){
  if(r==='common')return'';
  let svg='';

  if(r==='uncommon'){
    svg+=el('rect',{x:2,y:2,width:1,height:1,fill:'#22c55e',opacity:0.55,class:'animate-spark'});
    svg+=el('rect',{x:29,y:3,width:1,height:1,fill:'#4ade80',opacity:0.45,class:'animate-spark',style:'animation-delay:0.5s'});
    svg+=el('rect',{x:3,y:28,width:1,height:1,fill:'#4ade80',opacity:0.4,class:'animate-spark',style:'animation-delay:1s'});
  }else if(r==='rare'){
    svg+=el('rect',{x:1,y:3,width:1,height:2,fill:'#3b82f6',opacity:0.7,class:'animate-shimmer'});
    svg+=el('rect',{x:30,y:2,width:1,height:2,fill:'#60a5fa',opacity:0.6,class:'animate-shimmer',style:'animation-delay:0.3s'});
    svg+=el('rect',{x:2,y:27,width:1,height:2,fill:'#3b82f6',opacity:0.5,class:'animate-shimmer',style:'animation-delay:0.6s'});
    svg+=el('rect',{x:29,y:28,width:1,height:2,fill:'#67e8f9',opacity:0.6,class:'animate-shimmer',style:'animation-delay:0.9s'});
  }else if(r==='epic'){
    svg+=el('rect',{x:1,y:1,width:1,height:3,fill:'#c084fc',opacity:0.6,class:'animate-rune'});
    svg+=el('rect',{x:2,y:2,width:2,height:1,fill:'#8b5cf6',opacity:0.5,class:'animate-rune'});
    svg+=el('rect',{x:30,y:1,width:1,height:3,fill:'#c084fc',opacity:0.6,class:'animate-rune',style:'animation-delay:0.4s'});
    svg+=el('rect',{x:28,y:2,width:2,height:1,fill:'#a78bfa',opacity:0.5,class:'animate-rune',style:'animation-delay:0.4s'});
    svg+=el('rect',{x:1,y:28,width:1,height:3,fill:'#a78bfa',opacity:0.5,class:'animate-rune',style:'animation-delay:0.8s'});
    svg+=el('rect',{x:30,y:28,width:1,height:3,fill:'#a78bfa',opacity:0.5,class:'animate-rune',style:'animation-delay:1.2s'});
  }else if(r==='legendary'){
    // Golden corner stars + center top beam
    svg+=el('rect',{x:2,y:1,width:1,height:1,fill:'#fff',opacity:0.8,class:'animate-spark'});
    svg+=el('rect',{x:15,y:0,width:2,height:1,fill:'#fbbf24',opacity:0.7,class:'animate-spark',style:'animation-delay:0.2s'});
    svg+=el('rect',{x:29,y:1,width:1,height:1,fill:'#fff',opacity:0.8,class:'animate-spark',style:'animation-delay:0.4s'});
    svg+=el('rect',{x:0,y:15,width:1,height:1,fill:'#fcd34d',opacity:0.5,class:'animate-spark',style:'animation-delay:0.6s'});
    svg+=el('rect',{x:31,y:16,width:1,height:1,fill:'#fcd34d',opacity:0.5,class:'animate-spark',style:'animation-delay:0.8s'});
    svg+=el('rect',{x:3,y:30,width:1,height:1,fill:'#fbbf24',opacity:0.6,class:'animate-spark',style:'animation-delay:1s'});
    svg+=el('rect',{x:28,y:30,width:1,height:1,fill:'#fbbf24',opacity:0.6,class:'animate-spark',style:'animation-delay:1.2s'});
    // Radial aura — minimal, using a gradient circle
    svg+='<defs><radialGradient id="legAura" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#fbbf24" stop-opacity="0.18"/><stop offset="100%" stop-color="transparent"/></radialGradient></defs>';
    svg+=el('circle',{cx:16,cy:16,r:14,fill:'url(#legAura)'});
  }else if(r==='mythic'){
    // Rainbow corner sparks
    const mythicColors=['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ffffff'];
    const corners=[[1,1],[29,1],[1,30],[29,30]];
    corners.forEach((pos,i)=>{
      svg+=el('rect',{x:pos[0],y:pos[1],width:2,height:1,fill:mythicColors[i%7],opacity:0.75,class:'animate-spark',style:'animation-delay:'+(i*0.35)+'s'});
      svg+=el('rect',{x:pos[0]+(i%2?-1:1),y:pos[1]+1,width:1,height:1,fill:mythicColors[(i+1)%7],opacity:0.6,class:'animate-spark',style:'animation-delay:'+(i*0.35+0.2)+'s'});
    });
    svg+=el('rect',{x:15,y:0,width:2,height:1,fill:'#fff',opacity:0.6,class:'animate-spark',style:'animation-delay:1.6s'});
    // Mythic radial pulse
    svg+='<defs><radialGradient id="mythAura" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#f97316" stop-opacity="0.14"/><stop offset="60%" stop-color="#8b5cf6" stop-opacity="0.08"/><stop offset="100%" stop-color="transparent"/></radialGradient></defs>';
    svg+=el('circle',{cx:16,cy:16,r:14,fill:'url(#mythAura)'});
  }

  return svg;
}

// Main render function
function render(lib){
  const dna=getDNA();
  const traits=parseDNA(dna);
  const rarity=getRarity(traits.rarity);
  const typeName=TYPES[traits.baseType]||'human';

  let palette;
  if(lib && lib.palettes){
    const lp=lib.palettes.find(function(p){return p.id===typeName;});
    if(lp){
      const c=lp.colors;
      palette={
        skin: c.skin||c.fur||c.metal||c.aura||c.scales||'#ffcc99',
        shade: c.skinShade||c.furShade||c.metalShade||c.auraShade||c.scalesShade||'#e6b380',
        shade2: '#111',
        pri: c.primary||'#f7931a',
        sec: c.secondary||'#ffc107',
        acc: c.accent||'#4fc3f7',
        eye: c.eye||c.led||c.rune||c.spirit||'#1f2937'
      };
    }
  }
  if(!palette){
    palette=PALETTES[typeName]||PALETTES.human;
  }

  // Assemble SVG in z-order layers
  let svg='';

  if(lib && lib.components){
    const compMap={};
    lib.components.forEach(function(c){
      compMap[c.id]=c;
    });

    const rarityId='rarity_'+rarity;
    const baseId='base_'+typeName;
    const bloodlineId='bloodline_'+BLOODS[traits.bloodline];
    const heritageId='heritage_'+HERITAGES[traits.heritage];

    const rarityComp=compMap[rarityId];
    const baseComp=compMap[baseId];
    const bloodlineComp=compMap[bloodlineId];
    const heritageComp=compMap[heritageId];

    const compsToRender=[];
    if(rarityComp) compsToRender.push(rarityComp);
    if(baseComp) compsToRender.push(baseComp);
    if(bloodlineComp) compsToRender.push(bloodlineComp);
    if(heritageComp) compsToRender.push(heritageComp);

    // Sort by zIndex
    compsToRender.sort(function(a,b){return a.zIndex-b.zIndex;});

    // Layer 2: clipPath defs for glowing-eyes-through-hood
    svg+=buildEyeMaskDefs(traits);

    compsToRender.forEach(function(c){
      let pathData=c.pathData;

      if(c.category==='heritage'){
        svg+='<g opacity="0.15">'+pathData+'</g>';
      } else if(c.category==='bloodline' && (c.subtype==='rogue' || c.subtype==='warrior')){
        const eyeY=10+traits.eyes%2;
        let out='<g class="body-shadow">'+pathData+'</g>';
        const eyeColor=c.subtype==='rogue'?'#ef4444':'var(--acc)';
        out+='<g clip-path="url(#eyeWindow)">';
        out+=el('circle',{cx:12,cy:eyeY,r:1.8,fill:eyeColor,opacity:0.9});
        out+=el('circle',{cx:20,cy:eyeY,r:1.8,fill:eyeColor,opacity:0.9});
        out+=el('circle',{cx:11.5,cy:eyeY-0.5,r:0.45,fill:'#fff',opacity:0.9});
        out+=el('circle',{cx:19.5,cy:eyeY-0.5,r:0.45,fill:'#fff',opacity:0.9});
        out+='</g>';
        svg+=out;
      } else if(c.category==='base'){
        svg+='<g class="body-shadow">'+pathData+'</g>';
      } else {
        svg+=pathData;
      }
    });

  } else {
    // Layer 0: Heritage watermark background (opacity ~0.15)
    svg+=renderHeritageBg(traits.heritage);

    // Layer 1: Rarity background aura (only for legendary/mythic, very subtle)
    if(rarity==='legendary'||rarity==='mythic'){
      svg+=renderRarity(rarity);
    }

    // Layer 2: clipPath defs for glowing-eyes-through-hood
    svg+=buildEyeMaskDefs(traits);

    // Layer 3: Base sprite (body + head + type features) with drop-shadow
    svg+=renderBase(traits.baseType,traits);

    // Layer 4: Bloodline overlay (crown/helm/hood/aura) with eye-window mask
    svg+=renderBloodline(traits.bloodline,traits);

    // Layer 5: Rarity particles (corners, no full aura for rare/epic)
    if(rarity!=='legendary'&&rarity!=='mythic'){
      svg+=renderRarity(rarity);
    }
  }

  // SECURITY: Defense-in-depth — reject any SVG containing script injection patterns
  const DANGEROUS = /(<script|javascript:|on[a-z]+\\s*=|href\\s*=\\s*['"]?\\s*(?:javascript:|data:)|<animate|<set|<handler|<discard|<iframe|<object|<embed|<foreignObject)/i;
  if(DANGEROUS.test(svg)){throw new Error('SVG contains dangerous content');}

  // Inject CSS palette vars + apply to SVG
  const nft=document.getElementById('nft');
  nft.innerHTML=svg;
  nft.setAttribute('style','--skin:'+palette.skin+';--shade:'+palette.shade+';--shade2:'+palette.shade2+';--pri:'+palette.pri+';--sec:'+palette.sec+';--acc:'+palette.acc+';--eye:'+palette.eye);
  nft.className='glow-'+rarity+(rarity!=='common'?' animate-float':'');

  // Responsive sizing
  const s=Math.min(window.innerWidth,window.innerHeight)*0.9;
  nft.style.width=s+'px';
  nft.style.height=s+'px';
}

function init(){
  fetch('/content/'+LIBRARY_ID)
    .then(function(r){
      if(!r.ok) throw new Error();
      return r.json();
    })
    .then(function(lib){
      render(lib);
    })
    .catch(function(err){
      render(null);
    });
}

// Initialize
document.addEventListener('DOMContentLoaded',init);
window.addEventListener('resize',function(){
  const nft=document.getElementById('nft');
  const s=Math.min(window.innerWidth,window.innerHeight)*0.9;
  nft.style.width=s+'px';
  nft.style.height=s+'px';
});

})();
</script>
</body>
</html>`;
}

/**
 * Minify the renderer HTML for inscription
 */
export function minifyRenderer(html: string): string {
  return (
    html
      // Remove comments
      .replace(/<!--[\s\S]*?-->/g, "")
      // Collapse whitespace
      .replace(/\s+/g, " ")
      // Remove space around tags
      .replace(/>\s+</g, "><")
      // Trim
      .trim()
  );
}

/**
 * Generate renderer inscription data
 */
export function generateRendererInscription(options: {
  libraryInscriptionId: string;
  minify?: boolean;
}): {
  contentType: string;
  content: string;
  size: number;
} {
  let html = generateOnChainRenderer(options);

  if (options.minify !== false) {
    html = minifyRenderer(html);
  }

  return {
    contentType: "text/html",
    content: html,
    size: new TextEncoder().encode(html).length,
  };
}

// =============================================================================
// NFT METADATA RENDERER
// =============================================================================

/**
 * Generate NFT metadata that references the renderer
 */
export function generateNFTMetadata(params: {
  tokenId: number;
  dna: string;
  rendererInscriptionId: string;
  name?: string;
  description?: string;
  attributes?: Array<{ trait_type: string; value: string }>;
}): string {
  const {
    tokenId,
    dna,
    rendererInscriptionId,
    name = `Genesis Spark #${tokenId}`,
    description = "A unique Genesis Spark on Bitcoin",
    attributes = [],
  } = params;

  const metadata = {
    name,
    description,
    image: `/content/${rendererInscriptionId}?dna=${dna}`,
    attributes,
    properties: {
      dna,
      tokenId,
      collection: "Genesis Sparks",
      standard: "ordinals",
    },
  };

  return JSON.stringify(metadata);
}

/**
 * Generate minimal DNA-only inscription for maximum efficiency
 * Size: ~50 bytes per NFT
 */
export function generateMinimalNFTInscription(params: {
  tokenId: number;
  dna: string;
  rendererInscriptionId: string;
}): {
  contentType: string;
  content: string;
  size: number;
} {
  // Minimal format: just reference renderer + DNA
  // The renderer will parse DNA from query string
  const content = `<meta http-equiv=refresh content="0;url=/content/${params.rendererInscriptionId}?dna=${params.dna}&id=${params.tokenId}">`;

  return {
    contentType: "text/html",
    content,
    size: new TextEncoder().encode(content).length,
  };
}
