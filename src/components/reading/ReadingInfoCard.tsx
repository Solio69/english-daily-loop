import { Info } from "lucide-react";
import React from "react";

export const ReadingInfoCard: React.FC = () => (
  <section className="glass-card rounded-[20px] p-3">
    <div className="flex items-start gap-3">
      <div className="glass-control grid size-12 shrink-0 place-items-center rounded-full text-[var(--primary)]">
        <Info size={22} />
      </div>
      <div className="min-w-0">
        <h2 className="font-heading text-base font-semibold text-[var(--primary)]">
          Как это работает
        </h2>
        <ul className="mt-2 space-y-1.5 text-sm leading-5 text-[var(--text-secondary)]">
          <li className="flex gap-2">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
            <span>Каждый день доступен один новый текст.</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
            <span>После чтения откроется прогресс за день.</span>
          </li>
        </ul>
      </div>
    </div>
  </section>
);
