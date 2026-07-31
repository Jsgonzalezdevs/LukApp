import React from 'react';
import { SECTIONS, sectionLabel } from '../sections';
import type { SectionId } from '../sections';
import { BrandMark } from './BrandMark';

interface FinanzasShellProps {
  section: SectionId;
  onSectionChange: (section: SectionId) => void;
  /** Rendered to the right of the title in the desktop header. */
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Two genuinely different layouts, not one layout that merely reflows:
 *
 * - Under 1024px it is a phone app — content fills the width and navigation is a
 *   fixed bottom tab bar, where the thumb already is. A sidebar would eat a
 *   third of a 390px screen.
 * - At 1024px and up it is a desktop dashboard — a persistent left sidebar
 *   (navigation should not cost a tap when there is room for it) and a content
 *   column that widens to a multi-column grid.
 *
 * The breakpoint is Tailwind's `lg`. Both trees are always mounted and CSS
 * decides which is visible, so there is no layout flash on load and no
 * window-width listener to keep in sync.
 */
export const FinanzasShell: React.FC<FinanzasShellProps> = ({
  section,
  onSectionChange,
  toolbar,
  children,
}) => (
  <div className="fin-root min-h-[100dvh] bg-[#fbf9f6] text-[#1c1917] antialiased lg:flex">
    {/* ---------- Desktop: persistent sidebar ---------- */}
    <aside className="hidden lg:flex lg:h-[100dvh] lg:w-60 lg:shrink-0 lg:flex-col lg:justify-between lg:border-r lg:border-[#ede9e3] lg:bg-white lg:px-4 lg:py-6 lg:sticky lg:top-0">
      <div>
        <div className="flex items-center gap-2.5 px-2">
          <BrandMark className="h-6 w-6" />
          <span className="text-base font-extrabold tracking-tight">Finanzas</span>
        </div>

        <nav className="mt-8 flex flex-col gap-1" aria-label="Secciones">
          {SECTIONS.map((item) => {
            const active = item.id === section;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSectionChange(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition-colors ${
                  active
                    ? 'bg-[#1c1917] text-white'
                    : 'text-[#78716c] hover:bg-[#f5f3f0] hover:text-[#1c1917]'
                }`}
              >
                <span className="fin-emoji text-base" aria-hidden="true">
                  {item.emoji}
                </span>
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      <p className="px-3 text-[11px] leading-relaxed text-[#a8a29e]">
        Privado · solo para ti
      </p>
    </aside>

    {/* ---------- Content ---------- */}
    <div className="flex min-w-0 flex-1 flex-col">
      {/* Mobile header. Hidden on desktop, where the sidebar carries the brand. */}
      <header className="sticky top-0 z-20 flex items-center gap-2.5 border-b border-[#ede9e3] bg-[#fbf9f6]/85 px-4 pt-[calc(env(safe-area-inset-top)+0.875rem)] pb-3.5 backdrop-blur-md lg:hidden">
        <BrandMark className="h-5 w-5" />
        <h1 className="text-sm font-extrabold tracking-tight">Finanzas</h1>
      </header>

      {/* Desktop header: section title + whatever the view wants in the toolbar. */}
      <header className="hidden lg:flex lg:items-center lg:justify-between lg:gap-4 lg:border-b lg:border-[#ede9e3] lg:px-8 lg:py-5">
        <h1 className="text-xl font-extrabold tracking-tight">{sectionLabel(section)}</h1>
        {toolbar}
      </header>

      {/* `pb-24` on mobile clears the fixed tab bar; the safe-area inset covers
          the iPhone home indicator on top of that. */}
      <main className="flex-1 px-4 pt-5 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] lg:px-8 lg:py-7 lg:pb-10">
        {children}
      </main>
    </div>

    {/* ---------- Mobile: fixed bottom tab bar ---------- */}
    <nav
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-[#ede9e3] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      aria-label="Secciones"
    >
      {SECTIONS.map((item) => {
        const active = item.id === section;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSectionChange(item.id)}
            aria-current={active ? 'page' : undefined}
            className="flex flex-col items-center gap-0.5 py-2.5"
          >
            {/* The active pill is the second channel: the label also changes
                weight and colour, so it never relies on colour alone. */}
            <span
              className={`fin-emoji rounded-full px-3 py-1 text-lg transition-colors ${
                active ? 'bg-[#f5f3f0]' : ''
              }`}
              aria-hidden="true"
            >
              {item.emoji}
            </span>
            <span
              className={`text-[10px] transition-colors ${
                active ? 'font-extrabold text-[#1c1917]' : 'font-semibold text-[#a8a29e]'
              }`}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  </div>
);
