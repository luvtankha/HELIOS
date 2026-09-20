export function StatusBadge({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <span className="inline-flex rounded-full border border-teal/20 bg-teal/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-teal">
      {children}
    </span>
  );
}
