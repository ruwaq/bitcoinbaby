/**
 * BitcoinBaby Sprite - Main Character
 *
 * The cute orange Bitcoin 'B' shaped robot baby.
 * Multiple states and evolution stages.
 */

export type BabyState = 'idle' | 'happy' | 'sleeping' | 'hungry' | 'mining' | 'learning' | 'evolving';
export type BabyStage = 'egg' | 'baby' | 'teen' | 'master';

interface BabySpriteProps {
  size?: number;
  state?: BabyState;
  className?: string;
}

export function BabySprite({ size = 192, state = 'idle', className = '' }: BabySpriteProps) {
  const stateClasses: Record<BabyState, string> = {
    idle: 'animate-pixel-float',
    happy: 'animate-bounce',
    sleeping: 'baby-sleeping',
    hungry: 'animate-pixel-shake',
    mining: 'animate-pixel-glow',
    learning: '',
    evolving: 'baby-evolving',
  };

  return (
    <div className={`relative ${stateClasses[state]} ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        style={{ imageRendering: 'pixelated' }}
      >
        {/* Antenna/Horn */}
        <rect x="7" y="0" width="2" height="2" fill="#4fc3f7" />
        <rect x="8" y="0" width="1" height="1" fill="#81d4fa" />

        {/* Head - Dome */}
        <rect x="4" y="2" width="8" height="6" fill="#ffc107" />
        <rect x="3" y="3" width="1" height="4" fill="#ffc107" />
        <rect x="12" y="3" width="1" height="4" fill="#ffc107" />

        {/* Brain visible through dome */}
        <rect x="5" y="3" width="6" height="3" fill="#4fc3f7" opacity="0.6" />
        <rect x="6" y="3" width="2" height="2" fill="#8b5cf6" opacity="0.7" />
        <rect x="8" y="4" width="2" height="2" fill="#8b5cf6" opacity="0.7" />

        {/* Brain neural pattern */}
        {state === 'learning' && (
          <>
            <rect x="6" y="3" width="1" height="1" fill="#ffffff" className="animate-ping" />
            <rect x="9" y="4" width="1" height="1" fill="#ffffff" className="animate-ping" style={{ animationDelay: '200ms' }} />
          </>
        )}

        {/* Eyes */}
        {state !== 'sleeping' ? (
          <>
            <rect x="5" y="5" width="2" height="2" fill="#1f2937" />
            <rect x="9" y="5" width="2" height="2" fill="#1f2937" />
            {/* Eye shine */}
            <rect x="5" y="5" width="1" height="1" fill="#ffffff" />
            <rect x="9" y="5" width="1" height="1" fill="#ffffff" />
          </>
        ) : (
          <>
            {/* Closed eyes */}
            <rect x="5" y="6" width="2" height="1" fill="#1f2937" />
            <rect x="9" y="6" width="2" height="1" fill="#1f2937" />
          </>
        )}

        {/* Mouth */}
        {state === 'happy' || state === 'mining' ? (
          <>
            {/* Wide smile */}
            <rect x="6" y="7" width="1" height="1" fill="#1f2937" />
            <rect x="9" y="7" width="1" height="1" fill="#1f2937" />
            <rect x="7" y="8" width="2" height="1" fill="#1f2937" />
          </>
        ) : state === 'hungry' ? (
          <>
            {/* Open mouth */}
            <rect x="7" y="7" width="2" height="2" fill="#1f2937" />
          </>
        ) : (
          <>
            {/* Normal smile */}
            <rect x="7" y="7" width="2" height="1" fill="#1f2937" />
          </>
        )}

        {/* Cheeks (blush) */}
        <rect x="3" y="5" width="1" height="1" fill="#ff9999" />
        <rect x="12" y="5" width="1" height="1" fill="#ff9999" />

        {/* Body */}
        <rect x="5" y="8" width="6" height="5" fill="#f7931a" />
        <rect x="4" y="9" width="1" height="3" fill="#f7931a" />
        <rect x="11" y="9" width="1" height="3" fill="#f7931a" />

        {/* Body highlight */}
        <rect x="5" y="8" width="2" height="1" fill="#ffc107" />

        {/* Body shadow */}
        <rect x="9" y="11" width="2" height="1" fill="#e67e00" />

        {/* Bitcoin B symbol on body */}
        <rect x="7" y="9" width="2" height="3" fill="#1f2937" />
        <rect x="6" y="10" width="1" height="1" fill="#1f2937" />
        <rect x="9" y="10" width="1" height="1" fill="#1f2937" />

        {/* Arms */}
        <rect x="3" y="9" width="1" height="2" fill="#e67e00" />
        <rect x="12" y="9" width="1" height="2" fill="#e67e00" />

        {/* Lightning bolt (right hand) */}
        {(state === 'mining' || state === 'happy') && (
          <>
            <rect x="13" y="8" width="2" height="1" fill="#ffc107" />
            <rect x="12" y="9" width="2" height="1" fill="#ffc107" />
            <rect x="13" y="10" width="2" height="1" fill="#ffc107" />
          </>
        )}

        {/* Feet */}
        <rect x="5" y="13" width="2" height="1" fill="#e67e00" />
        <rect x="9" y="13" width="2" height="1" fill="#e67e00" />
      </svg>

      {/* Mining sparkles */}
      {state === 'mining' && (
        <>
          <div className="absolute -top-2 -left-2 w-2 h-2 bg-pixel-primary animate-ping" />
          <div className="absolute -top-1 -right-3 w-2 h-2 bg-pixel-secondary animate-ping" style={{ animationDelay: '100ms' }} />
          <div className="absolute -bottom-2 left-4 w-2 h-2 bg-pixel-success animate-ping" style={{ animationDelay: '200ms' }} />
        </>
      )}

      {/* Sleeping Zzz */}
      {state === 'sleeping' && (
        <div className="absolute -top-4 right-0 font-pixel text-pixel-secondary text-xs animate-pixel-float">
          Zzz
        </div>
      )}

      {/* Evolving aura */}
      {state === 'evolving' && (
        <div
          className="absolute inset-0 animate-spin"
          style={{
            background: 'conic-gradient(from 0deg, #f7931a, #4fc3f7, #8b5cf6, #4ade80, #f7931a)',
            filter: 'blur(8px)',
            opacity: 0.5,
            animationDuration: '2s',
          }}
        />
      )}
    </div>
  );
}
