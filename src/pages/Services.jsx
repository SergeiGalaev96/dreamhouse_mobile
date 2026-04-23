import { useContext, useEffect, useMemo, useState } from "react";
import { Briefcase, ListTree, Search, Plus, Pencil, Trash2, RefreshCcw, X, Clock } from "lucide-react";
import toast from "react-hot-toast";
import PullToRefresh from "../components/PullToRefresh";
import { AuthContext } from "../auth/AuthContext";
import { deleteRequest, postRequest, putRequest } from "../api/request";
import { useTheme } from "../context/ThemeContext";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { formatDateTime } from "../utils/date";
import { themeControl, themeSurface, themeText } from "../utils/themeStyles";
import AuditLogModal from "./AuditLogModal";

const SERVICE_MANAGER_ROLE_IDS = [1, 10, 11, 4];

const EMPTY_TYPE_FORM = { name: "" };
const EMPTY_SERVICE_FORM = {
  name: "",
  service_type: "",
  unit_of_measure: ""
};

export default function Services() {
  const { user } = useContext(AuthContext);
  const { isDark } = useTheme();

  const [activeTab, setActiveTab] = useState("services");
  const [items, setItems] = useState([]);
  const [dictionaries, setDictionaries] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inputSearch, setInputSearch] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    pages: 1,
    hasNext: false,
    hasPrev: false
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [typeForm, setTypeForm] = useState(EMPTY_TYPE_FORM);
  const [serviceForm, setServiceForm] = useState(EMPTY_SERVICE_FORM);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyId, setHistoryId] = useState(null);

  const canManage = SERVICE_MANAGER_ROLE_IDS.includes(Number(user?.role_id));
  const canDelete = Number(user?.role_id) === 1;

  const pageClass = `min-h-full ${themeText.page(isDark)}`;
  const panelClass = `${themeSurface.panel(isDark)} p-4`;
  const cardClass = `${themeSurface.panel(isDark)} p-3`;
  const modalClass = `${themeSurface.panel(isDark)} max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl p-4`;
  const inputClass = themeControl.input(isDark).replace("pl-9 ", "").replace("rounded-lg ", "rounded-lg px-3 ");
  const searchInputClass = themeControl.input(isDark);
  const subtleButtonClass = themeControl.subtleButton(isDark);
  const chipButtonClass = themeControl.chipButton(isDark);
  const secondaryTextClass = themeText.secondary(isDark);

  const serviceTypes = dictionaries.serviceTypes || [];
  const unitsOfMeasure = dictionaries.unitsOfMeasure || [];

  useEffect(() => {
    loadDicts();
  }, []);

  useEffect(() => {
    loadItems();
  }, [activeTab, search, page]);

  useEffect(() => {
    setPage(1);
  }, [activeTab]);

  const loadDicts = async () => {
    const dicts = await loadDictionaries(["serviceTypes", "unitsOfMeasure"]);
    setDictionaries(dicts);
  };

  const loadItems = async () => {
    try {
      setLoading(true);

      const res = activeTab === "services"
        ? await postRequest("/services/search", {
          search: search || undefined,
          page,
          size: 20
        })
        : await postRequest("/serviceTypes/search", {
          search: search || undefined,
          page,
          size: 20
        });

      if (!res?.success) {
        toast.error(res?.message || "Не удалось загрузить данные");
        return;
      }

      setItems(res.data || []);
      setPagination(
        res.pagination || {
          total: 0,
          pages: 1,
          hasNext: false,
          hasPrev: false
        }
      );
    } catch (error) {
      console.error("Services load error", error);
      toast.error(activeTab === "services" ? "Ошибка загрузки услуг" : "Ошибка загрузки типов услуг");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    await Promise.all([loadDicts(), loadItems()]);
  };

  const handleSearch = () => {
    setPage(1);
    setSearch(inputSearch.trim());
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingItem(null);
    setTypeForm(EMPTY_TYPE_FORM);
    setServiceForm(EMPTY_SERVICE_FORM);
  };

  const openCreate = () => {
    setEditingItem(null);
    setTypeForm(EMPTY_TYPE_FORM);
    setServiceForm(EMPTY_SERVICE_FORM);
    setModalOpen(true);
  };

  const openHistory = (id) => {
    setHistoryId(id);
    setHistoryOpen(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);

    if (activeTab === "services") {
      setServiceForm({
        name: item.name || "",
        service_type: item.service_type ? String(item.service_type) : "",
        unit_of_measure: item.unit_of_measure ? String(item.unit_of_measure) : ""
      });
    } else {
      setTypeForm({ name: item.name || "" });
    }

    setModalOpen(true);
  };

  const getTypeName = (typeId) => serviceTypes.find((item) => Number(item.id) === Number(typeId))?.label || "-";
  const getUnitName = (unitId) => unitsOfMeasure.find((item) => Number(item.id) === Number(unitId))?.label || "-";

  const handleDelete = async (item) => {
    const label = activeTab === "services" ? "услугу" : "тип услуги";
    if (!window.confirm(`Удалить ${label} ${item.name}?`)) return;

    try {
      const res = activeTab === "services"
        ? await deleteRequest(`/services/delete/${item.id}`)
        : await deleteRequest(`/serviceTypes/delete/${item.id}`);

      if (!res?.success) {
        toast.error(res?.message || "Не удалось удалить");
        return;
      }

      toast.success(activeTab === "services" ? "Услуга удалена" : "Тип удален");
      if (items.length === 1 && page > 1) {
        setPage((prev) => Math.max(prev - 1, 1));
      }
      await loadItems();
      await loadDicts();
    } catch (error) {
      console.error("Services delete error", error);
      toast.error(error?.response?.data?.message || "Ошибка удаления");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setSaving(true);

      let res;

      if (activeTab === "services") {
        if (!serviceForm.name.trim()) return toast.error("Введите название услуги");
        if (!serviceForm.service_type) return toast.error("Выберите тип услуги");
        if (!serviceForm.unit_of_measure) return toast.error("Выберите ед. изм.");

        const payload = {
          name: serviceForm.name.trim(),
          service_type: Number(serviceForm.service_type),
          unit_of_measure: Number(serviceForm.unit_of_measure)
        };

        res = editingItem
          ? await putRequest(`/services/update/${editingItem.id}`, payload)
          : await postRequest("/services/create", payload);
      } else {
        if (!typeForm.name.trim()) return toast.error("Введите название типа");

        const payload = {
          name: typeForm.name.trim()
        };

        res = editingItem
          ? await putRequest(`/serviceTypes/update/${editingItem.id}`, payload)
          : await postRequest("/serviceTypes/create", payload);
      }

      if (!res?.success) {
        toast.error(res?.message || "Не удалось сохранить");
        return;
      }

      toast.success(
        activeTab === "services"
          ? editingItem ? "Услуга обновлена" : "Услуга создана"
          : editingItem ? "Тип обновлен" : "Тип создан"
      );

      closeModal();
      await handleRefresh();
    } catch (error) {
      console.error("Services save error", error);
      toast.error(error?.response?.data?.message || "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const tabButtonClass = useMemo(
    () => (tab) => {
      const isActive = activeTab === tab;
      return isActive
        ? "flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white"
        : `${chipButtonClass} flex-1 py-2`;
    },
    [activeTab, chipButtonClass]
  );

  if (!canManage) {
    return (
      <div className={pageClass}>
        <div className={`${panelClass} text-sm ${secondaryTextClass}`}>
          Доступ к управлению услугами закрыт.
        </div>
      </div>
    );
  }

  return (
    <div className={pageClass}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Briefcase size={20} className="text-blue-400" />
          <h1 className="text-lg font-semibold">Услуги</h1>
        </div>

        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-500"
        >
          <Plus size={16} />
          {activeTab === "services" ? "Услуга" : "Тип"}
        </button>
      </div>

      <div className="mb-4 flex gap-2">
        <button onClick={() => setActiveTab("services")} className={tabButtonClass("services")}>
          Услуги
        </button>
        <button onClick={() => setActiveTab("types")} className={tabButtonClass("types")}>
          Типы
        </button>
      </div>

      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className={`absolute left-3 top-3 ${secondaryTextClass}`} />
          <input
            value={inputSearch}
            onChange={(e) => setInputSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder={activeTab === "services" ? "Поиск услуг..." : "Поиск типов услуг..."}
            className={searchInputClass}
          />
        </div>
        <button onClick={handleSearch} className={subtleButtonClass}>Go</button>
        <button
          onClick={() => {
            setInputSearch("");
            setSearch("");
          }}
          className={`${subtleButtonClass} flex items-center gap-2`}
        >
          <RefreshCcw size={16} />
        </button>
      </div>

      <PullToRefresh onRefresh={handleRefresh} disabled={loading || modalOpen}>
        {loading && (
          <div className={`${panelClass} text-sm ${secondaryTextClass}`}>Загрузка...</div>
        )}

        {!loading && items.length === 0 && (
          <div className={`${panelClass} text-sm ${secondaryTextClass}`}>
            {activeTab === "services" ? "Услуги не найдены." : "Типы услуг не найдены."}
          </div>
        )}

        {!loading && items.map((item) => (
          <div key={item.id} className={`${cardClass} mb-px last:mb-0`}>
            <div className="mb-1.5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold leading-tight">
                  {activeTab === "services" ? <Briefcase size={15} className="text-blue-400" /> : <ListTree size={15} className="text-blue-400" />}
                  <span className="break-words whitespace-normal">{item.name}</span>
                </div>
              </div>

              {activeTab === "services" && (
                <button
                  onClick={() => openHistory(item.id)}
                  className={themeControl.actionTilePadded(isDark)}
                >
                  <Clock size={14} />
                </button>
              )}
            </div>

            <div className={`grid grid-cols-1 gap-1 text-[11px] leading-tight ${secondaryTextClass}`}>
              {activeTab === "services" ? (
                <>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>Группа: {getTypeName(item.service_type)}</span>
                    <span>Создан: {formatDateTime(item.created_at)}</span>
                  </div>
                  <div>Ед. изм.: {getUnitName(item.unit_of_measure)}</div>
                </>
              ) : (
                <>
                  <div>Создан: {formatDateTime(item.created_at)}</div>
                </>
              )}
            </div>

            <div className="mt-3 flex flex-wrap justify-end gap-2">
              {canDelete && (
                <button
                  onClick={() => handleDelete(item)}
                  className="flex items-center gap-1.5 rounded-lg bg-red-600 px-2 py-1 text-[11px] text-white hover:bg-red-500"
                >
                  <Trash2 size={14} />
                  Удалить
                </button>
              )}
              <button
                onClick={() => openEdit(item)}
                className={`${chipButtonClass} flex items-center gap-1.5 px-2 py-1 text-[11px]`}
              >
                <Pencil size={14} />
                Изменить
              </button>
            </div>
          </div>
        ))}
      </PullToRefresh>

      <div className="flex items-center justify-center gap-3 pt-1">
        <button
          onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
          disabled={!pagination.hasPrev}
          className={subtleButtonClass}
        >
          Назад
        </button>

        <div className="text-sm">
          {page} / {pagination.pages || 1}
        </div>

        <button
          onClick={() => setPage((prev) => prev + 1)}
          disabled={!pagination.hasNext}
          className={subtleButtonClass}
        >
          Далее
        </button>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4">
          <div className={modalClass}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">
                  {editingItem
                    ? activeTab === "services" ? "Редактировать услугу" : "Редактировать тип"
                    : activeTab === "services" ? "Новая услуга" : "Новый тип"}
                </div>
                <div className={`text-xs ${secondaryTextClass}`}>
                  {activeTab === "services" ? "Управление услугами" : "Управление типами услуг"}
                </div>
              </div>
              <button onClick={closeModal} className={secondaryTextClass}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {activeTab === "services" ? (
                <>
                  <input
                    value={serviceForm.name}
                    onChange={(e) => setServiceForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Название услуги"
                    className={inputClass}
                  />

                  <select
                    value={serviceForm.service_type}
                    onChange={(e) => setServiceForm((prev) => ({ ...prev, service_type: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="">Тип услуги</option>
                    {serviceTypes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={serviceForm.unit_of_measure}
                    onChange={(e) => setServiceForm((prev) => ({ ...prev, unit_of_measure: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="">Ед. изм.</option>
                    {unitsOfMeasure.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <input
                  value={typeForm.name}
                  onChange={(e) => setTypeForm({ name: e.target.value })}
                  placeholder="Название типа услуги"
                  className={inputClass}
                />
              )}

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={closeModal} className={`flex-1 ${subtleButtonClass}`}>
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {saving ? "Сохранение..." : editingItem ? "Сохранить" : "Создать"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AuditLogModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        entity="service"
        entityId={historyId}
        valueMaps={{
          service_type: Object.fromEntries((serviceTypes || []).map((item) => [item.id, item.label])),
          unit_of_measure: Object.fromEntries((unitsOfMeasure || []).map((item) => [item.id, item.label]))
        }}
      />
    </div>
  );
}
