import { useEffect, useState } from "react";
import { getRequest } from "../api/request";
import { formatDate, formatDateTime } from "../utils/date";

export default function AuditLogModal({ open, onClose, entity, entityId, fieldsMap = {} }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    const load = async () => {
      setLoading(true);
      try {
        const res = await getRequest(
          `/auditLog?entity_type=${entity}&entity_id=${entityId}&page=1&size=20`
        );

        if (res?.success) setLogs(res.data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [open, entity, entityId]);

  if (!open) return null;

  const renderChanges = (oldVals = {}, newVals = {}) => {
    return Object.keys(newVals).map((key) => {
      if (JSON.stringify(oldVals[key]) === JSON.stringify(newVals[key])) return null;

      return (
        <div key={key} className="text-xs text-gray-300">
          <span className="text-gray-500">
            {fieldsMap[key] || key}:
          </span>{" "}
          <span className="line-through text-red-400">
            {String(oldVals[key])}
          </span>{" "}
          →{" "}
          <span className="text-green-400">
            {String(newVals[key])}
          </span>
        </div>
      );
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg max-h-[80vh] overflow-hidden rounded-2xl border border-gray-800 bg-gray-950 flex flex-col">

        {/* HEADER */}
        <div className="flex justify-between items-center p-4 border-b border-gray-800">
          <div className="font-semibold">История изменений</div>
          <button onClick={onClose}>✕</button>
        </div>

        {/* BODY */}
        <div className="overflow-y-auto p-4 space-y-3">

          {loading && <div className="text-gray-400 text-sm">Загрузка...</div>}

          {!loading && logs.length === 0 && (
            <div className="text-gray-400 text-sm">История пуста</div>
          )}

          {logs.map((log) => (
            <div key={log.id} className="rounded-xl border border-gray-800 p-3 bg-gray-900">

              <div className="text-[11px] text-gray-500 mb-2">
                {formatDateTime(log.created_at)}
              </div>

              <div className="space-y-1">
                {renderChanges(log.old_values, log.new_values)}
              </div>

            </div>
          ))}

        </div>
      </div>
    </div>
  );
}