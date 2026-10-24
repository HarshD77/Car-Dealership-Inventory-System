export function Brand({ light = false }: { light?: boolean }) {
  return <div className={`brand ${light ? 'brand-light' : ''}`}>
    <span className="brand-mark" aria-hidden="true">M<span /></span>
    <span>MOTORLINE<small>CAR DEALERSHIP</small></span>
  </div>;
}

export function CarOutline({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 600 230" fill="none" aria-hidden="true">
    <path d="M51 154h25l48-57c10-12 22-18 39-20l176-12c32-2 50 2 74 19l62 45 57 13c14 3 24 15 24 29v15h-42m-90 0H201m-88 0H67c-14 0-22-7-22-20v-5c0-4 2-7 6-7Z" stroke="currentColor" strokeWidth="4" />
    <path d="m137 115 30-25 116-8v44H128m172-45 38-1c24 0 43 5 61 18l38 28H300V81ZM458 148l55 10M82 146l30-4m190 0h22" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    <circle cx="157" cy="180" r="42" stroke="currentColor" strokeWidth="4" /><circle cx="157" cy="180" r="22" stroke="currentColor" strokeWidth="3" />
    <circle cx="468" cy="180" r="42" stroke="currentColor" strokeWidth="4" /><circle cx="468" cy="180" r="22" stroke="currentColor" strokeWidth="3" />
    <path d="M10 225h580" stroke="currentColor" opacity=".3" />
  </svg>;
}
