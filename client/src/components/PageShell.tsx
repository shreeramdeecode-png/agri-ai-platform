import type { ReactNode } from "react";

export function PageShell({
  title,
  subtitle,
  children,
  testId,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <div className="max-w-5xl mx-auto space-y-4 md:space-y-6 pb-20 md:pb-0">
      <div>
        <h1
          className="text-2xl md:text-3xl font-bold text-white mb-1 md:mb-2"
          data-testid={testId}
        >
          {title}
        </h1>
        <p className="text-sm md:text-base text-gray-400">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

export function DarkPanel({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-[#2a3749] border border-[#3a4759] rounded-xl p-4 md:p-6 ${className}`}
    >
      {title && (
        <h2 className="text-base md:text-lg font-semibold text-white mb-4">{title}</h2>
      )}
      {children}
    </div>
  );
}
