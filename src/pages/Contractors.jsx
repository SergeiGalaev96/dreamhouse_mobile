import { useContext, useEffect, useState } from "react";
import {
  Search,
  Wrench,
  Plus,
  Pencil,
  Trash2,
  RefreshCcw,
  X
} from "lucide-react";
import { toast } from "react-hot-toast";
import { AuthContext } from "../auth/AuthContext";
import { deleteRequest, postRequest, putRequest } from "../api/request";
import { formatDateTime } from "../utils/date";
import { useTheme } from "../context/ThemeContext";
import { themeControl, themeSurface, themeText } from "../utils/themeStyles";
import PullToRefresh from "../components/PullToRefresh";

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  address: "",
  contact_person: "",
  inn: "",
  kpp: "",
  ogrn: ""
};

export default function Contractors() {
  const { user } = useContext(AuthContext);
  const { isDark } = useTheme();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inputSearch, setInputSearch] = useState("");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const canDelete = Boolean(user);
  const pageClass = `min-h-full ${themeText.page(isDark)}`;
  const panelClass = `${themeSurface.panel(isDark)} p-4`;
  const cardClass = `${themeSurface.panel(isDark)} min-h-[188px] p-4`;
  const inputClass = themeControl.input(isDark).replace("pl-9 ", "").replace("rounded-lg ", "rounded-lg px-3 ");
  const searchInputClass = themeControl.input(isDark);
  const subtleButtonClass = themeControl.subtleButton(isDark);
  const modalClass = `${themeSurface.panel(isDark)} max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl p-4`;
  const secondaryTextClass = themeText.secondary(isDark);

  const loadContractors = async () => {
    try {
      setLoading(true);
      const res = await postRequest("/contractors/search", {
        search: search.trim(),
        page: 1,
        size: 200
      });
      if (res?.success) setItems(res.data || []);
      else toast.error(res?.message || "Не удалось загрузить подрядчиков");
    } catch (error) {
      console.error("Contractors load error", error);
      toast.error("Ошибка загрузки подрядчиков");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContractors();
  }, [search]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingItem(null);
  };

  const closeForm = () => {
    resetForm();
    setFormOpen(false);
  };

  const openCreate = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setForm({
      name: item.name || "",
      email: item.email || "",
      phone: item.phone || "",
      address: item.address || "",
      contact_person: item.contact_person || "",
      inn: item.inn || "",
      kpp: item.kpp || "",
      ogrn: item.ogrn || ""
    });
    setFormOpen(true);
  };

  const handleSearch = () => setSearch(inputSearch);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Введите название подрядчика");
    if (!form.inn.trim()) return toast.error("Введите ИНН");

    try {
      setSaving(true);
      const payload = {
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        contact_person: form.contact_person.trim() || null,
        inn: form.inn.trim(),
        kpp: form.kpp.trim() || null,
        ogrn: form.ogrn.trim() || null
      };

      const res = editingItem
        ? await putRequest(`/contractors/update/${editingItem.id}`, payload)
        : await postRequest("/contractors/create", payload);

      if (!res?.success) {
        toast.error(res?.message || "Не удалось сохранить подрядчика");
        return;
      }

      toast.success(editingItem ? "Подрядчик обновлен" : "Подрядчик создан");
      closeForm();
      await loadContractors();
    } catch (error) {
      console.error("Contractor save error", error);
      toast.error(error?.response?.data?.message || "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!canDelete) return toast.error("Недостаточно прав для удаления");
    if (!window.confirm(`Удалить подрядчика ${item.name}?`)) return;

    try {
      const res = await deleteRequest(`/contractors/delete/${item.id}`);
      if (res?.success) {
        toast.success("Подрядчик удален");
        await loadContractors();
      } else {
        toast.error(res?.message || "Не удалось удалить подрядчика");
      }
    } catch (error) {
      console.error("Contractor delete error", error);
      toast.error(error?.response?.data?.message || "Ошибка удаления");
    }
  };

  return (
    <div className={pageClass}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Wrench size={20} className="text-blue-400" />
          <h1 className="text-lg font-semibold">Подрядчики</h1>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-500">
          <Plus size={16} />
          Новый
        </button>
      </div>

      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className={`absolute left-3 top-3 ${secondaryTextClass}`} />
          <input value={inputSearch} onChange={(e) => setInputSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} placeholder="Поиск по названию, ИНН, email, телефону" className={searchInputClass} />
        </div>
        <button onClick={handleSearch} className={subtleButtonClass}>Найти</button>
        <button onClick={() => { setInputSearch(""); setSearch(""); }} className={`${subtleButtonClass} flex items-center gap-2`}><RefreshCcw size={16} />Сброс</button>
      </div>

      <PullToRefresh className="space-y-2.5" onRefresh={loadContractors} disabled={loading || formOpen}>
        {loading && <div className={`${panelClass} text-sm ${secondaryTextClass}`}>Загрузка подрядчиков...</div>}
        {!loading && items.length === 0 && <div className={`${panelClass} text-sm ${secondaryTextClass}`}>Подрядчики не найдены.</div>}

        {!loading && items.map((item) => (
          <div key={item.id} className={cardClass}>
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">{item.name}</div>
                {item.email && <div className={`mt-1 text-[11px] ${secondaryTextClass}`}>{item.email}</div>}
              </div>
            </div>

            <div className={`grid grid-cols-1 gap-1.5 text-[11px] ${secondaryTextClass}`}>
              {item.contact_person && <div>Контакт: {item.contact_person}</div>}
              {item.phone && <div>Телефон: {item.phone}</div>}
              {item.address && <div>Адрес: {item.address}</div>}
              {item.inn && <div>ИНН: {item.inn}</div>}
              {item.kpp && <div>КПП: {item.kpp}</div>}
              {item.ogrn && <div>ОГРН: {item.ogrn}</div>}
              <div>Создан: {formatDateTime(item.created_at)}</div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => openEdit(item)} className={`${themeControl.chipButton(isDark)} flex items-center gap-1.5 px-2.5 py-1.5 text-[11px]`}><Pencil size={14} />Изменить</button>
              <button onClick={() => handleDelete(item)} disabled={!canDelete} className="flex items-center gap-1.5 rounded-lg bg-red-600 px-2.5 py-1.5 text-[11px] text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"><Trash2 size={14} />Удалить</button>
            </div>
          </div>
        ))}
      </PullToRefresh>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4">
          <div className={modalClass}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">{editingItem ? "Редактирование подрядчика" : "Новый подрядчик"}</div>
                <div className={`text-xs ${secondaryTextClass}`}>{editingItem ? "Обновление данных подрядчика" : "Создание нового подрядчика"}</div>
              </div>
              <button onClick={closeForm} className={secondaryTextClass}><X size={18} /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Название" className={inputClass} />
              <input value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="Email" type="email" className={inputClass} />
              <input value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} placeholder="Телефон" className={inputClass} />
              <input value={form.contact_person} onChange={(e) => setForm((prev) => ({ ...prev, contact_person: e.target.value }))} placeholder="Контактное лицо" className={inputClass} />
              <textarea value={form.address} onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))} placeholder="Адрес" rows={3} className={inputClass} />
              <input value={form.inn} onChange={(e) => setForm((prev) => ({ ...prev, inn: e.target.value }))} placeholder="ИНН" className={inputClass} />
              <input value={form.kpp} onChange={(e) => setForm((prev) => ({ ...prev, kpp: e.target.value }))} placeholder="КПП" className={inputClass} />
              <input value={form.ogrn} onChange={(e) => setForm((prev) => ({ ...prev, ogrn: e.target.value }))} placeholder="ОГРН" className={inputClass} />

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={closeForm} className={`flex-1 ${subtleButtonClass}`}>Отмена</button>
                <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-50">{saving ? "Сохранение..." : editingItem ? "Сохранить" : "Создать"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
