import { useEffect, useState, useRef } from "react";
import { getRequest, postRequest, putRequest } from "../api/request";
import dayjs from "dayjs";
import { formatDateTime, formatDate, formatTime } from "../utils/date";
import { CheckCheck } from "lucide-react";
import { toast } from "react-hot-toast";

export default function Notifications() {

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const loaderRef = useRef();

  /* ---------------- LOAD ---------------- */
  const loadNotifications = async (pageNum = 1) => {
    if (loading) return;

    setLoading(true);

    const res = await postRequest("/notifications/search", {
      page: pageNum,
      size: 20
    });

    if (res.success) {
      const data = res.data || [];

      setItems(prev => pageNum === 1 ? data : [...prev, ...data]);

      if (data.length < 20) {
        setHasMore(false);
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    loadNotifications(1);
  }, []);

  /* ---------------- INFINITE SCROLL ---------------- */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
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
  }, [page, hasMore]);

  /* ---------------- GROUP BY DATE ---------------- */
  const grouped = items.reduce((acc, item) => {
    const dateKey = dayjs(item.created_at).format("YYYY-MM-DD");

    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(item);

    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort(
    (a, b) => dayjs(b).valueOf() - dayjs(a).valueOf()
  );

  /* ---------------- MARK ONE ---------------- */
  const markAsRead = async (id) => {
    await putRequest(`/notifications/update/${id}`);

    setItems(prev =>
      prev.map(n =>
        n.id === id ? { ...n, is_read: true } : n
      )
    );
  };

  /* ---------------- MARK ALL ---------------- */
  const markAll = async () => {
    const res = await putRequest("/notifications/updateAll");

    if (res.success) {
      setItems(prev => prev.map(n => ({ ...n, is_read: true })));
      toast.success("Все уведомления прочитаны");
    }
  };

  /* ---------------- DATE FORMAT ---------------- */
  const formatDateLabel = (dateStr) => {
    const date = dayjs(dateStr).startOf("day");
    const today = dayjs().startOf("day");
    const yesterday = dayjs().subtract(1, "day").startOf("day");

    if (date.isSame(today)) return "Сегодня";
    if (date.isSame(yesterday)) return "Вчера";

    return formatDate(date);
  };

  return (
    <div className="max-w-md mx-auto text-white">

      {/* HEADER */}
      <div className="flex justify-between items-center mb-4">

        <h2 className="text-lg font-semibold">
          Уведомления
        </h2>

        <button
          onClick={markAll}
          className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
        >
          <CheckCheck size={16} />
          Прочитать все
        </button>

      </div>

      {/* LIST */}
      <div className="space-y-4">

        {sortedDates.map(date => (
          <div key={date}>

            {/* DATE */}
            <div className="text-sb text-gray-400 mb-2">
              {formatDateLabel(date)}
            </div>

            <div className="space-y-2">

              {grouped[date].map(item => (
                <div
                  key={item.id}
                  onClick={() => !item.is_read && markAsRead(item.id)}
                  className={`
                    p-3 rounded-lg cursor-pointer transition
                    ${item.is_read
                      ? "bg-gray-900"
                      : "bg-blue-900/40 border border-blue-500/40"}
                  `}
                >

                  {/* TITLE */}
                  <div className="flex justify-between items-start">

                    <p className={`text-sm font-medium ${!item.is_read && "text-blue-300"}`}>
                      {item.title}
                    </p>

                    {!item.is_read && (
                      <span className="w-2 h-2 bg-blue-400 rounded-full mt-1" />
                    )}

                  </div>

                  {/* MESSAGE */}
                  {item.message && (
                    <p className="text-xs text-gray-400 mt-1">
                      {item.message}
                    </p>
                  )}

                  {/* TIME */}
                  <div className="text-[10px] text-gray-500 mt-2">
                    {formatTime(item.created_at)}
                  </div>

                </div>
              ))}

            </div>

          </div>
        ))}

      </div>

      {/* LOADER */}
      <div ref={loaderRef} className="h-10 flex items-center justify-center text-gray-500 text-xs">
        {loading && "Загрузка..."}
        {!hasMore && "Больше нет"}
      </div>

    </div>
  );
}
