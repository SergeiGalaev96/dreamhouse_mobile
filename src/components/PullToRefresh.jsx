import { useRef, useState } from "react";
import toast from "react-hot-toast";

export default function PullToRefresh({
  children,
  onRefresh,
  disabled = false,
  topOnly = true,
  className = "",
  contentClassName = ""
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);

  const touchStartYRef = useRef(0);
  const isPullingRef = useRef(false);

  const resetPull = () => {
    isPullingRef.current = false;
    touchStartYRef.current = 0;
    setPullDistance(0);
  };

  const handleTouchStart = (e) => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    if (disabled || refreshing || (topOnly && scrollTop > 0)) return;

    touchStartYRef.current = e.touches[0].clientY;
    isPullingRef.current = true;
  };

  const handleTouchMove = (e) => {
    if (!isPullingRef.current) return;

    const delta = e.touches[0].clientY - touchStartYRef.current;

    if (delta <= 0) {
      setPullDistance(0);
      return;
    }

    e.preventDefault();
    setPullDistance(Math.min(72, delta * 0.4));
  };

  const handleTouchEnd = async () => {
    if (!isPullingRef.current) return;

    const shouldRefresh = pullDistance >= 44;
    resetPull();

    if (!shouldRefresh || !onRefresh) return;

    try {
      setRefreshing(true);
      await onRefresh();
      toast.success("Список обновлен");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div
      className={className}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="overflow-hidden transition-all duration-200"
        style={{ height: pullDistance > 0 || refreshing ? 36 : 0 }}
      >
        <div className="flex h-9 items-center justify-center text-xs text-gray-400">
          {refreshing
            ? "Обновление..."
            : pullDistance >= 44
              ? "Отпустите для обновления"
              : "Потяните вниз для обновления"}
        </div>
      </div>

      <div
        className={`transition-transform duration-200 ${contentClassName}`.trim()}
        style={{ transform: `translateY(${refreshing ? 8 : pullDistance}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
