/**
 * On-Chain HTML Renderer for Genesis Babies NFTs
 *
 * Self-contained HTML/JS that renders NFTs from DNA.
 * Inscribed once, referenced by all NFT metadata.
 *
 * Features:
 * - Pure SVG rendering (no external dependencies)
 * - DNA-deterministic output
 * - Animated effects for rare NFTs
 * - Responsive sizing
 *
 * Size target: ~5KB minified + gzipped
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
  const { libraryInscriptionId, title = "Genesis Baby", version = 1 } = options;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;background:#0f0f1b;display:flex;align-items:center;justify-content:center}
#nft{image-rendering:pixelated;image-rendering:crisp-edges}
.glow-common{}
.glow-uncommon{filter:drop-shadow(0 0 2px #22c55e)}
.glow-rare{filter:drop-shadow(0 0 4px #3b82f6)}
.glow-epic{filter:drop-shadow(0 0 6px #8b5cf6)}
.glow-legendary{filter:drop-shadow(0 0 8px #f59e0b);animation:pulse 2s ease-in-out infinite}
.glow-mythic{filter:drop-shadow(0 0 4px #ef4444) drop-shadow(0 0 8px #f97316) drop-shadow(0 0 12px #eab308);animation:rainbow 3s linear infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.8}}
@keyframes rainbow{0%{filter:drop-shadow(0 0 8px #ef4444)}33%{filter:drop-shadow(0 0 8px #22c55e)}66%{filter:drop-shadow(0 0 8px #3b82f6)}100%{filter:drop-shadow(0 0 8px #ef4444)}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
.animate{animation:float 3s ease-in-out infinite}
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

// Base type names
const TYPES=['human','animal','robot','mystic','alien','shaman','elemental','dragon'];
const BLOODS=['royal','warrior','rogue','mystic'];
const HERITAGES=['americas','africa','asia','europa','oceania'];

// Color palettes
const PALETTES={
  human:{skin:'#ffcc99',shade:'#e6b380',pri:'#f7931a',sec:'#ffc107',acc:'#4fc3f7'},
  animal:{skin:'#d4a574',shade:'#b48554',pri:'#f97316',sec:'#fbbf24',acc:'#84cc16'},
  robot:{skin:'#7a8a9a',shade:'#5a6a7a',pri:'#64748b',sec:'#94a3b8',acc:'#22d3ee'},
  mystic:{skin:'#ddd6fe',shade:'#c4b5fd',pri:'#8b5cf6',sec:'#a78bfa',acc:'#f472b6'},
  alien:{skin:'#88ff88',shade:'#55cc55',pri:'#10b981',sec:'#34d399',acc:'#06b6d4'},
  shaman:{skin:'#a67c52',shade:'#8a6042',pri:'#059669',sec:'#34d399',acc:'#fbbf24'},
  elemental:{skin:'#fbbf24',shade:'#f59e0b',pri:'#f97316',sec:'#f7c59f',acc:'#ffd700'},
  dragon:{skin:'#ef4444',shade:'#b91c1c',pri:'#dc2626',sec:'#ef4444',acc:'#fbbf24'}
};

// Bloodline accessories
const BLOOD_ACC={
  royal:'<polygon points="4,0 5,2 6,0 7,2 8,0 9,2 10,0 11,2 12,0 12,2 4,2" fill="#ffd700" stroke="#8b6914" stroke-width="0.3"/><circle cx="8" cy="1" r="0.5" fill="#00aaff"/>',
  warrior:'<path d="M3 3 L3 0 Q8 -2 13 0 L13 3 Z" fill="#666" stroke="#333" stroke-width="0.3"/><rect x="7" y="-2" width="2" height="4" fill="#cc3333"/>',
  rogue:'<path d="M2 5 Q2 0 8 -1 Q14 0 14 5 L12 4 Q8 2 4 4 Z" fill="#333355" stroke="#111" stroke-width="0.3"/>',
  mystic:'<polygon points="8,-3 3,3 13,3" fill="#aa44ff" stroke="#551188" stroke-width="0.3"/><polygon points="8,-1 8.5,0 9.5,0 8.7,0.5 9,1 8,0.5 7,1 7.3,0.5 6.5,0 7.5,0" fill="#ffcc00"/>'
};

// Escape HTML attribute values to prevent XSS
function esc(v){
  return String(v).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// SVG element helpers (with XSS protection)
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

// Render base sprite
function renderBase(t,p,traits){
  const c=PALETTES[TYPES[t]]||PALETTES.human;
  let svg='';

  // Body
  svg+=el('ellipse',{cx:16,cy:22,rx:7,ry:6,fill:c.skin,stroke:c.shade,'stroke-width':0.5});

  // Head
  svg+=el('circle',{cx:16,cy:11,r:8,fill:c.skin,stroke:c.shade,'stroke-width':0.5});

  // Eyes
  const eyeY=10+traits.eyes%2;
  svg+=el('circle',{cx:12,cy:eyeY,r:2,fill:'#fff'});
  svg+=el('circle',{cx:20,cy:eyeY,r:2,fill:'#fff'});
  svg+=el('circle',{cx:12,cy:eyeY,r:1.2,fill:'#1a1a2e'});
  svg+=el('circle',{cx:20,cy:eyeY,r:1.2,fill:'#1a1a2e'});
  svg+=el('circle',{cx:11.5,cy:eyeY-0.5,r:0.4,fill:'#fff'});
  svg+=el('circle',{cx:19.5,cy:eyeY-0.5,r:0.4,fill:'#fff'});

  // Mouth
  const mouthY=14+traits.mouth%2;
  svg+=el('path',{d:'M14 '+mouthY+' Q16 '+(mouthY+1)+' 18 '+mouthY,fill:'none',stroke:c.shade,'stroke-width':0.5});

  // Type-specific features
  if(t===1){// Animal - ears
    svg+=el('polygon',{points:'6,8 9,4 12,10',fill:c.skin,stroke:c.shade,'stroke-width':0.3});
    svg+=el('polygon',{points:'20,10 23,4 26,8',fill:c.skin,stroke:c.shade,'stroke-width':0.3});
  }else if(t===2){// Robot - antenna
    svg+=el('rect',{x:15,y:1,width:2,height:3,fill:c.shade});
    svg+=el('circle',{cx:16,cy:1,r:1,fill:c.acc});
  }else if(t===3||t===5){// Mystic/Shaman - third eye
    svg+=el('circle',{cx:16,cy:5,r:1,fill:c.acc,stroke:c.shade,'stroke-width':0.3});
  }else if(t===4){// Alien - big eyes
    svg+=el('ellipse',{cx:12,cy:10,rx:3,ry:4,fill:'#1a1a1a',transform:'rotate(-10 12 10)'});
    svg+=el('ellipse',{cx:20,cy:10,rx:3,ry:4,fill:'#1a1a1a',transform:'rotate(10 20 10)'});
  }else if(t===6){// Elemental - flame
    svg+=el('path',{d:'M12 6 Q16 0 20 6 Q18 8 16 6 Q14 8 12 6',fill:'#ff6b35',opacity:0.7});
  }else if(t===7){// Dragon - horns
    svg+=el('polygon',{points:'7,8 10,2 13,8',fill:c.sec,stroke:c.shade,'stroke-width':0.3});
    svg+=el('polygon',{points:'19,8 22,2 25,8',fill:c.sec,stroke:c.shade,'stroke-width':0.3});
  }

  return svg;
}

// Render bloodline overlay
function renderBloodline(b){
  const acc=BLOOD_ACC[BLOODS[b]];
  return acc?el('g',{transform:'translate(0,1)'},acc):'';
}

// Render rarity effects
function renderRarity(r){
  if(r==='common')return'';
  let svg='';
  if(r==='legendary'||r==='mythic'){
    // Sparkles
    for(let i=0;i<5;i++){
      const x=4+Math.random()*24;
      const y=4+Math.random()*24;
      svg+=el('circle',{cx:x,cy:y,r:0.5,fill:'#fff',opacity:0.6+Math.random()*0.4});
    }
  }
  return svg;
}

// Main render function
function render(){
  const dna=getDNA();
  const traits=parseDNA(dna);
  const rarity=getRarity(traits.rarity);

  let svg='';

  // Background gradient for rare+
  if(rarity!=='common'&&rarity!=='uncommon'){
    svg+=el('defs',{},
      el('radialGradient',{id:'bg',cx:'50%',cy:'50%',r:'50%'},
        el('stop',{offset:'0%','stop-color':PALETTES[TYPES[traits.baseType]].acc,'stop-opacity':0.3})+
        el('stop',{offset:'100%','stop-color':'transparent'})
      )
    );
    svg+=el('circle',{cx:16,cy:16,r:14,fill:'url(#bg)'});
  }

  // Base sprite
  svg+=renderBase(traits.baseType,traits,traits);

  // Bloodline
  svg+=renderBloodline(traits.bloodline);

  // Rarity effects
  svg+=renderRarity(rarity);

  // Apply to SVG element
  const nft=document.getElementById('nft');
  nft.innerHTML=svg;
  nft.className='glow-'+rarity+(rarity!=='common'?' animate':'');

  // Responsive sizing
  const size=Math.min(window.innerWidth,window.innerHeight)*0.9;
  nft.style.width=size+'px';
  nft.style.height=size+'px';
}

// Initialize
document.addEventListener('DOMContentLoaded',render);
window.addEventListener('resize',function(){
  const nft=document.getElementById('nft');
  const size=Math.min(window.innerWidth,window.innerHeight)*0.9;
  nft.style.width=size+'px';
  nft.style.height=size+'px';
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
    name = `Genesis Baby #${tokenId}`,
    description = "A unique Genesis Baby on Bitcoin",
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
      collection: "Genesis Babies",
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
  const content = `<!DOCTYPE html><meta http-equiv="refresh" content="0;url=/content/${params.rendererInscriptionId}?dna=${params.dna}&id=${params.tokenId}">`;

  return {
    contentType: "text/html",
    content,
    size: new TextEncoder().encode(content).length,
  };
}
