import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { getRequest } from "../api/request";
import { formatDate, formatDateTime } from "../utils/date";
import { AUDIT_ENTITY_META } from "../config/auditMetadata";

const normalizeFieldMeta = (fieldsMap = {}) =>
  Object.fromEntries(
    Object.entries(fieldsMap).map(([key, value]) => [
      key,
      typeof value === "string" ? { label: value } : value
    ])
  );

export default function AuditLogModal({
  open,
  onClose,
  entity,
  entityId,
  fieldsMap = {},
  valueMaps = {}
}) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const entityMeta = useMemo(() => AUDIT_ENTITY_META[entity] || {}, [entity]);
  const mergedFields = useMemo(
    () => ({
      ...(entityMeta.fields || {}),
      ...normalizeFieldMeta(fieldsMap)
    }),
    [entityMeta.fields, fieldsMap]
  );
  const hiddenFields = entityMeta.hiddenFields || [];

  useEffect(() => {
    if (!open || !entity || !entityId) return;

    const load = async () => {
      setLoading(true);
      try {
        const res = await getRequest(`/auditLog?entity_type=${entity}&entity_id=${entityId}&page=1&size=20`);
        if (res?.success) setLogs(res.data || []);
      } catch (error) {
        console.error("Audit log load error", error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [open, entity, entityId]);

  if (!open) return null;

  const formatValue = (key, value) => {
    const meta = mergedFields[key] || {};
    const type = meta.type;

    if (value === null || value === undefined || value === "") return "—";

    if (type === "mapped") {
      return valueMaps[key]?.[value] || valueMaps[key]?.[String(value)] || String(value);
    }

    if (type === "money") {
      const num = Number(value);
      return Number.isFinite(num) ? `${num.toLocaleString("ru-RU")} сом` : String(value);
    }

    if (type === "date") {
      return formatDate(value);
    }

    if (type === "datetime") {
      return formatDateTime(value);
    }

    if (type === "list") {
      if (Array.isArray(value)) {
        return value
          .map((item) => valueMaps[key]?.[item] || valueMaps[key]?.[String(item)] || String(item))
          .join(", ") || "—";
      }
      return String(value);
    }

    if (typeof value === "boolean") {
      return value ? "Да" : "Нет";
    }

    if (Array.isArray(value)) {
      return value.join(", ");
    }

    if (typeof value === "object") {
      return JSON.stringify(value);
    }

    return String(value);
  };

  const renderChanges = (oldVals = {}, newVals = {}) =>
    Object.keys(newVals).map((key) => {
      if (hiddenFields.includes(key)) return null;
      if (JSON.stringify(oldVals[key]) === JSON.stringify(newVals[key])) return null;

      return (
        <div key={key} className="text-xs text-gray-300">
          <span className="text-gray-500">{mergedFields[key]?.label || key}:</span>{" "}
          <span className="line-through text-red-400">{formatValue(key, oldVals[key])}</span>{" "}
          →{" "}
          <span className="text-green-400">{formatValue(key, newVals[key])}</span>
        </div>
      );
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-gray-800 bg-gray-950">
        <div className="flex items-center justify-between border-b border-gray-800 p-4">
          <div className="font-semibold">{entityMeta.title || "История изменений"}</div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto p-4">
          {loading && <div className="text-sm text-gray-400">Загрузка...</div>}

          {!loading && logs.length === 0 && (
            <div className="text-sm text-gray-400">История пуста</div>
          )}

          {logs.map((log) => (
            <div key={log.id} className="rounded-xl border border-gray-800 bg-gray-900 p-3">
              <div className="mb-2 text-[11px] text-gray-500">{formatDateTime(log.created_at)}</div>
              <div className="space-y-1">{renderChanges(log.old_values, log.new_values)}</div>
              {log.comment && (
                <div className="mt-2 rounded-lg bg-gray-950 px-2 py-1 text-[11px] text-gray-400">
                  Комментарий: {log.comment}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
