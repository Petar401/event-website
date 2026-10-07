import { cx } from "@/components/ui";

const PALETTE = ["bg-accent-soft text-accent", "bg-ai-soft text-ai", "bg-ok-soft text-ok", "bg-warn-soft text-warn", "bg-bad-soft text-bad"];

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = Array.from(parts[0])[0] ?? "?";
  const last = parts.length > 1 ? (Array.from(parts[parts.length - 1])[0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function CustomerAvatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      aria-hidden
      className={cx("grid shrink-0 place-items-center rounded-full font-bold", PALETTE[h % PALETTE.length], size === "lg" ? "size-16 text-xl" : "size-11 text-sm")}
    >
      {initials(name)}
    </span>
  );
}
