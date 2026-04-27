import { useCallback, useContext, useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import { CheckCheck } from "lucide-react";
import { toast } from "react-hot-toast";
import { postRequest, putRequest } from "../api/request";
import PullToRefresh from "../components/PullToRefresh";
import { SocketContext } from "../context/socket-context";
import { useTheme } from "../context/ThemeContext";
import { formatDate } from "../utils/date";
import { themeText } from "../utils/themeStyles";

export default function Notifications() {
  const { socket } = useContext(SocketContext);
  const { isDark } = useTheme();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const loaderRef = useRef();
  const loadingRef = useRef(false);
  const itemsRef = useRef([]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const notifyCountChanged = (count) => {
    window.dispatchEvent(new CustomEvent("notifications:countChanged", {
      detail: { count }
    }));
  };

  const loadNotifications = useCallback(async (pageNum = 1, force = false) => {
    if (loadingRef.current && !force) return;

    loadingRef.current = true;
    setLoading(true);

    try {
      const res = await postRequest("/notifications/search", {
        page: pageNum,
        size: 20
      });

      if (res.success) {
        const data = res.data || [];
        setItems((prev) => (pageNum === 1 ? data : [...prev, ...data]));
        setPage(pageNum);
        setHasMore(data.length >= 20);
      }
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications(1);
  }, [loadNotifications]);

  useEffect(() => {
    const handleNewNotification = (data) => {
      if (data?.notification?.id) {
        setItems((prev) => {
          if (prev.some((item) => item.id === data.notification.id)) {
            return prev;
          }

          return [data.notification, ...prev];
        });
      }

      loadNotifications(1, true);
      setTimeout(() => loadNotifications(1, true), 500);
    };

    const handleWindowNewNotification = (event) => {
      handleNewNotification(event.detail);
    };

    const handleServerCountChanged = () => {
      loadNotifications(1, true);
      setTimeout(() => loadNotifications(1, true), 500);
    };

    window.addEventListener("notifications:new", handleWindowNewNotification);
    window.addEventListener("notifications:serverCountChanged", handleServerCountChanged);

    if (!socket) {
      return () => {
        window.removeEventListener("notifications:new", handleWindowNewNotification);
        window.removeEventListener("notifications:serverCountChanged", handleServerCountChanged);
      };
    }

    socket.on("notifications:new", handleNewNotification);

    return () => {
      window.removeEventListener("notifications:new", handleWindowNewNotification);
      window.removeEventListener("notifications:serverCountChanged", handleServerCountChanged);
      socket.off("notifications:new", handleNewNotification);
    };
  }, [loadNotifications, socket]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingRef.current) {
          const next = page + 1;
          setPage(next);
          loadNotifications(next);
        }
      },
      { threshold: 1 }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [page, hasMore, loadNotifications]);

  const grouped = items.reduce((acc, item) => {
    const dateKey = dayjs(item.created_at).format("YYYY-MM-DD");
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(item);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort(
    (a, b) => dayjs(b).valueOf() - dayjs(a).valueOf()
  );

  const markAsRead = async (id) => {
    const unreadBefore = itemsRef.current.filter((item) => !item.is_read).length;
    const optimisticCount = Math.max(unreadBefore - 1, 0);

    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, is_read: true } : item)));
    notifyCountChanged(optimisticCount);

    const res = await putRequest(`/notifications/update/${id}`);

    if (typeof res?.unread_count === "number") {
      notifyCountChanged(res.unread_count);
    }
  };

  const markAll = async () => {
    const res = await putRequest("/notifications/updateAll");

    if (res.success) {
      setItems((prev) => prev.map((item) => ({ ...item, is_read: true })));
      notifyCountChanged(0);
      toast.success("Все уведомления прочитаны");
    }
  };

  const formatDateLabel = (dateStr) => {
    const date = dayjs(dateStr).startOf("day");
    const today = dayjs().startOf("day");
    const yesterday = dayjs().subtract(1, "day").startOf("day");

    if (date.isSame(today)) return "Сегодня";
    if (date.isSame(yesterday)) return "Вчера";
    return formatDate(date);
  };

  const pageClass = `max-w-md mx-auto ${themeText.page(isDark)}`;
  const headingClass = `text-lg font-semibold ${themeText.title(isDark)}`;
  const sectionLabelClass = `mb-2 text-sm ${themeText.secondary(isDark)}`;
  const messageClass = `mt-1 text-xs ${themeText.secondary(isDark)}`;
  const timeClass = "mt-2 text-[10px] text-gray-500";
  const loaderClass = "h-10 flex items-center justify-center text-xs text-gray-500";

  return (
    <div className={pageClass}>
      <PullToRefresh onRefresh={() => loadNotifications(1, true)} disabled={loading}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className={headingClass}>Уведомления</h2>

          <button
            onClick={markAll}
            className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-400"
          >
            <CheckCheck size={16} />
            Прочитать все
          </button>
        </div>

        <div className="space-y-4">
          {sortedDates.map((date) => (
            <div key={date}>
              <div className={sectionLabelClass}>{formatDateLabel(date)}</div>

              <div className="space-y-2">
                {grouped[date].map((item) => (
                  <div
                    key={item.id}
                    onClick={() => !item.is_read && markAsRead(item.id)}
                    className={`cursor-pointer rounded-lg p-3 transition ${
                      item.is_read
                        ? isDark
                          ? "bg-gray-900"
                          : "border border-slate-200 bg-white"
                        : isDark
                          ? "border border-blue-500/40 bg-blue-900/40"
                          : "border border-blue-200 bg-blue-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-medium ${!item.is_read ? "text-blue-500" : isDark ? "text-white" : "text-black"}`}>
                        {item.title}
                      </p>

                      {!item.is_read && (
                        <span className="mt-1 h-2 w-2 rounded-full bg-blue-400" />
                      )}
                    </div>

                    {item.message && <p className={messageClass}>{item.message}</p>}
                    <div className={timeClass}>{dayjs(item.created_at).format("HH:mm")}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div ref={loaderRef} className={loaderClass}>
          {loading && "Загрузка..."}
          {!hasMore && "Больше нет"}
        </div>
      </PullToRefresh>
    </div>
  );
}
