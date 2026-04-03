import { useContext, useEffect, useState } from "react";
import {
  Search,
  Truck,
  Plus,
  Pencil,
  Trash2,
  RefreshCcw,
  Star,
  MessageSquarePlus,
  X
} from "lucide-react";
import { toast } from "react-hot-toast";
import { AuthContext } from "../auth/AuthContext";
import { deleteRequest, postRequest, putRequest } from "../api/request";
import { formatDateTime } from "../utils/date";

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

const SUPPLIER_DELETE_ROLE_IDS = [1, 10, 11];

const emptyRatingForm = {
  supplier_id: "",
  quality: "5",
  time: "5",
  price: "5",
  comment: ""
};

const toDisplayValue = (value) => {
  if (value === null || value === undefined || value === "") return null;

  const num = Number(value);

  if (Number.isNaN(num)) return value;

  return num.toFixed(2);
};

function RatingStars({ label, value, onChange }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-3">
      <div className="mb-2 text-xs font-medium text-gray-300">{label}</div>

      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((starValue) => {
          const active = starValue <= Number(value);

          return (
            <button
              key={starValue}
              type="button"
              onClick={() => onChange(String(starValue))}
              className="transition hover:scale-110"
            >
              <Star
                size={22}
                className={active ? "fill-amber-400 text-amber-400" : "text-gray-600"}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Suppliers() {
  const { user } = useContext(AuthContext);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [inputSearch, setInputSearch] = useState("");
  const [search, setSearch] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [ratingSaving, setRatingSaving] = useState(false);
  const [ratingTarget, setRatingTarget] = useState(null);
  const [ratingForm, setRatingForm] = useState(emptyRatingForm);

  const canDelete = SUPPLIER_DELETE_ROLE_IDS.includes(user?.role_id);

  const loadSuppliers = async () => {
    try {
      setLoading(true);

      const res = await postRequest("/suppliers/search", {
        search: search.trim(),
        page: 1,
        size: 200
      });

      if (res?.success) {
        setItems(res.data || []);
      } else {
        toast.error(res?.message || "Не удалось загрузить поставщиков");
      }
    } catch (error) {
      console.error("Suppliers load error", error);
      toast.error("Ошибка загрузки поставщиков");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, [search]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingItem(null);
  };

  const closeForm = () => {
    resetForm();
    setFormOpen(false);
  };

  const closeRatingForm = () => {
    setRatingOpen(false);
    setRatingTarget(null);
    setRatingForm(emptyRatingForm);
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

  const openRatingForm = (item) => {
    setRatingTarget(item);
    setRatingForm({
      supplier_id: item.id,
      quality: "5",
      time: "5",
      price: "5",
      comment: ""
    });
    setRatingOpen(true);
  };

  const handleSearch = () => {
    setSearch(inputSearch);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name.trim()) return toast.error("Введите название поставщика");
    if (!form.email.trim()) return toast.error("Введите email");

    try {
      setSaving(true);

      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        contact_person: form.contact_person.trim() || null,
        inn: form.inn.trim() || null,
        kpp: form.kpp.trim() || null,
        ogrn: form.ogrn.trim() || null
      };

      const res = editingItem
        ? await putRequest(`/suppliers/update/${editingItem.id}`, payload)
        : await postRequest("/suppliers/create", payload);

      if (!res?.success) {
        toast.error(res?.message || "Не удалось сохранить поставщика");
        return;
      }

      toast.success(editingItem ? "Поставщик обновлён" : "Поставщик создан");
      closeForm();
      await loadSuppliers();
    } catch (error) {
      console.error("Supplier save error", error);
      toast.error(error?.response?.data?.message || "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!canDelete) {
      toast.error("Недостаточно прав для удаления");
      return;
    }

    const confirmed = window.confirm(`Удалить поставщика ${item.name}?`);
    if (!confirmed) return;

    try {
      const res = await deleteRequest(`/suppliers/delete/${item.id}`);

      if (res?.success) {
        toast.success("Поставщик удалён");
        await loadSuppliers();
      } else {
        toast.error(res?.message || "Не удалось удалить поставщика");
      }
    } catch (error) {
      console.error("Supplier delete error", error);
      toast.error(error?.response?.data?.message || "Ошибка удаления");
    }
  };

  const handleCreateRating = async (e) => {
    e.preventDefault();

    if (!ratingForm.supplier_id) return toast.error("Поставщик не выбран");

    try {
      setRatingSaving(true);

      const payload = {
        supplier_id: Number(ratingForm.supplier_id),
        quality: Number(ratingForm.quality),
        time: Number(ratingForm.time),
        price: Number(ratingForm.price),
        comment: ratingForm.comment.trim() || null
      };

      const res = await postRequest("/supplierRating/create", payload);

      if (!res?.success) {
        toast.error(res?.message || "Не удалось добавить отзыв");
        return;
      }

      toast.success("Отзыв добавлен");
      closeRatingForm();
      await loadSuppliers();
    } catch (error) {
      console.error("Supplier rating create error", error);
      toast.error(error?.response?.data?.message || "Ошибка сохранения отзыва");
    } finally {
      setRatingSaving(false);
    }
  };

  return (
    <div className="min-h-full text-white">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Truck size={20} className="text-blue-400" />
          <h1 className="text-lg font-semibold">Поставщики</h1>
        </div>

        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm hover:bg-blue-500"
        >
          <Plus size={16} />
          Новый
        </button>
      </div>

      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-3 text-gray-400" />
          <input
            value={inputSearch}
            onChange={(e) => setInputSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            placeholder="Поиск по названию, INN, email, телефону"
            className="w-full rounded-lg border border-gray-800 bg-gray-900 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <button
          onClick={handleSearch}
          className="rounded-lg bg-gray-800 px-4 py-2 text-sm hover:bg-gray-700"
        >
          Найти
        </button>

        <button
          onClick={() => {
            setInputSearch("");
            setSearch("");
          }}
          className="flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-sm hover:bg-gray-700"
        >
          <RefreshCcw size={16} />
          Сброс
        </button>
      </div>

      <div className="space-y-2.5">
        {loading && (
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 text-sm text-gray-400">
            Загрузка поставщиков...
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 text-sm text-gray-400">
            Поставщики не найдены.
          </div>
        )}

        {!loading &&
          items.map((item) => (
            <div
              key={item.id}
              className="min-h-[212px] rounded-lg border border-gray-800 bg-gray-900 p-4"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{item.name}</div>
                  <div className="mt-1 text-[11px] text-gray-400">{item.email}</div>
                </div>

                {item.avg_rating && (
                  <div className="flex items-center gap-1 rounded-full bg-amber-950 px-3 py-1.5 text-[10px] text-amber-300">
                    <Star size={12} />
                    {toDisplayValue(item.avg_rating)}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-1.5 text-[11px] text-gray-400">
                {item.contact_person && <div>Контакт: {item.contact_person}</div>}
                {item.phone && <div>Телефон: {item.phone}</div>}
                {item.address && <div>Адрес: {item.address}</div>}
                {item.inn && <div>ИНН: {item.inn}</div>}
                {item.kpp && <div>КПП: {item.kpp}</div>}
                {item.ogrn && <div>ОГРН: {item.ogrn}</div>}
                <div>Создан: {formatDateTime(item.created_at)}</div>
                {item.ratings_count ? <div>Оценок: {item.ratings_count}</div> : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => openEdit(item)}
                  className="flex items-center gap-1.5 rounded-lg bg-gray-800 px-2.5 py-1.5 text-[11px] hover:bg-gray-700"
                >
                  <Pencil size={14} />
                  Изменить
                </button>

                <button
                  onClick={() => openRatingForm(item)}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11px] hover:bg-blue-500"
                >
                  <MessageSquarePlus size={14} />
                  Отзыв
                </button>

                <button
                  onClick={() => handleDelete(item)}
                  disabled={!canDelete}
                  className="flex items-center gap-1.5 rounded-lg bg-red-600 px-2.5 py-1.5 text-[11px] hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  Удалить
                </button>
              </div>
            </div>
          ))}
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4">
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-gray-800 bg-gray-950 p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">
                  {editingItem ? "Редактирование поставщика" : "Новый поставщик"}
                </div>
                <div className="text-xs text-gray-400">
                  {editingItem ? "Обновление данных поставщика" : "Создание нового поставщика"}
                </div>
              </div>

              <button onClick={closeForm} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Название"
                className="w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />

              <input
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="Email"
                type="email"
                className="w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />

              <input
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="Телефон"
                className="w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />

              <input
                value={form.contact_person}
                onChange={(e) => setForm((prev) => ({ ...prev, contact_person: e.target.value }))}
                placeholder="Контактное лицо"
                className="w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />

              <textarea
                value={form.address}
                onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                placeholder="Адрес"
                rows={3}
                className="w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />

              <input
                value={form.inn}
                onChange={(e) => setForm((prev) => ({ ...prev, inn: e.target.value }))}
                placeholder="ИНН"
                className="w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />

              <input
                value={form.kpp}
                onChange={(e) => setForm((prev) => ({ ...prev, kpp: e.target.value }))}
                placeholder="КПП"
                className="w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />

              <input
                value={form.ogrn}
                onChange={(e) => setForm((prev) => ({ ...prev, ogrn: e.target.value }))}
                placeholder="ОГРН"
                className="w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex-1 rounded-lg bg-gray-800 px-4 py-2 text-sm hover:bg-gray-700"
                >
                  Отмена
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm hover:bg-blue-500 disabled:opacity-50"
                >
                  {saving ? "Сохранение..." : editingItem ? "Сохранить" : "Создать"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {ratingOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4">
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-gray-800 bg-gray-950 p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">Новый отзыв</div>
                <div className="text-xs text-gray-400">
                  {ratingTarget?.name || "Поставщик"}
                </div>
              </div>

              <button onClick={closeRatingForm} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateRating} className="space-y-3">
              <div className="grid grid-cols-1 gap-3">
                <RatingStars
                  label="Качество"
                  value={ratingForm.quality}
                  onChange={(nextValue) =>
                    setRatingForm((prev) => ({ ...prev, quality: nextValue }))
                  }
                />

                <RatingStars
                  label="Сроки"
                  value={ratingForm.time}
                  onChange={(nextValue) =>
                    setRatingForm((prev) => ({ ...prev, time: nextValue }))
                  }
                />

                <RatingStars
                  label="Цена"
                  value={ratingForm.price}
                  onChange={(nextValue) =>
                    setRatingForm((prev) => ({ ...prev, price: nextValue }))
                  }
                />
              </div>

              <textarea
                value={ratingForm.comment}
                onChange={(e) => setRatingForm((prev) => ({ ...prev, comment: e.target.value }))}
                placeholder="Комментарий к отзыву"
                rows={4}
                className="w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeRatingForm}
                  className="flex-1 rounded-lg bg-gray-800 px-4 py-2 text-sm hover:bg-gray-700"
                >
                  Отмена
                </button>

                <button
                  type="submit"
                  disabled={ratingSaving}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm hover:bg-blue-500 disabled:opacity-50"
                >
                  {ratingSaving ? "Сохранение..." : "Сохранить отзыв"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
