export const themeText = {
  page: (isDark) => (isDark ? "text-white" : "text-black"),
  title: (isDark) => (isDark ? "text-white" : "text-black"),
  primary: (isDark) => (isDark ? "text-gray-300" : "text-gray-800"),
  secondary: (isDark) => (isDark ? "text-gray-400" : "text-gray-600"),
  muted: (isDark) => (isDark ? "text-gray-500" : "text-gray-500")
};

export const themeSurface = {
  page: (isDark) => (isDark ? "bg-gray-950 text-white" : "bg-slate-50 text-black"),
  header: (isDark) => (isDark ? "border-b border-gray-800 bg-gray-950" : "border-b border-gray-300 bg-white"),
  nav: (isDark) => (isDark ? "border-t border-gray-800 bg-gray-900" : "border-t border-gray-300 bg-white"),
  sticky: (isDark) =>
    isDark
      ? "sticky z-30 -mx-4 border-b border-gray-900 bg-gray-950 px-4 pb-2 pt-0"
      : "sticky z-30 -mx-4 border-b border-gray-300 bg-white px-4 pb-2 pt-0",
  card: (isDark) =>
    isDark
      ? "rounded-lg border border-gray-800 bg-gray-900"
      : "rounded-lg border border-slate-200 bg-white shadow-sm",
  cardHover: (isDark) =>
    isDark
      ? "rounded-xl border border-gray-800 bg-gray-900 transition hover:border-blue-500"
      : "rounded-xl border border-slate-300 bg-white transition hover:border-blue-500",
  panel: (isDark) =>
    isDark
      ? "rounded-lg border border-gray-800 bg-gray-900"
      : "rounded-lg border border-slate-200 bg-white shadow-sm",
  panelMuted: (isDark) => (isDark ? "bg-gray-800" : "bg-slate-100"),
  menu: (isDark) => (isDark ? "border-gray-800 bg-gray-900 text-white" : "border-gray-300 bg-white text-black"),
  menuPopup: (isDark) =>
    isDark
      ? "absolute right-0 top-8 z-20 w-32 overflow-hidden rounded-lg border border-gray-700 bg-gray-900 shadow-xl"
      : "absolute right-0 top-8 z-20 w-32 overflow-hidden rounded-lg border border-slate-300 bg-white shadow-xl"
};

export const themeControl = {
  input: (isDark) =>
    isDark
      ? "w-full rounded-lg border border-gray-800 bg-gray-900 py-2 pl-9 pr-3 text-sm text-white focus:border-blue-500 focus:outline-none"
      : "w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-black focus:border-blue-500 focus:outline-none",
  modalInput: (isDark) =>
    isDark
      ? "w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
      : "w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-black",
  subtleButton: (isDark) =>
    isDark
      ? "rounded bg-gray-800 px-3 py-1 text-white disabled:opacity-50"
      : "rounded border border-slate-300 bg-white px-3 py-1 text-black disabled:opacity-50",
  chipButton: (isDark) =>
    isDark
      ? "rounded-lg bg-gray-800 px-4 text-sm text-white hover:bg-gray-700"
      : "rounded-lg border border-slate-300 bg-white px-4 text-sm text-black hover:bg-slate-100",
  actionTile: (isDark) =>
    isDark
      ? "cursor-pointer rounded bg-gray-800 px-2 py-2 text-center hover:bg-gray-700"
      : "cursor-pointer rounded bg-slate-100 px-2 py-2 text-center text-black hover:bg-slate-200",
  actionTilePadded: (isDark) =>
    isDark
      ? "cursor-pointer rounded bg-gray-800 p-2 text-center hover:bg-gray-700"
      : "cursor-pointer rounded bg-slate-100 p-2 text-center text-black hover:bg-slate-200"
};

export const themeBorder = {
  divider: (isDark) => (isDark ? "border-gray-800" : "border-slate-200"),
  soft: (isDark) => (isDark ? "border-gray-700" : "border-slate-300")
};

export const themeMisc = {
  progressTrack: (isDark) => (isDark ? "h-2 w-full overflow-hidden rounded-full bg-gray-800" : "h-2 w-full overflow-hidden rounded-full bg-gray-200"),
  menuButton: (isDark) => (isDark ? "bg-gray-800 hover:bg-gray-700 text-white" : "bg-gray-100 hover:bg-gray-200 text-black"),
  navInactive: (isDark) => (isDark ? "text-gray-500" : "text-black"),
  bellButton: (isDark) => (isDark ? "relative text-gray-400 transition hover:text-white" : "relative text-black transition hover:text-black"),
  menuTrigger: (isDark) => (isDark ? "flex flex-col items-center text-xs text-gray-500 hover:text-white" : "flex flex-col items-center text-xs text-black hover:text-black")
};
