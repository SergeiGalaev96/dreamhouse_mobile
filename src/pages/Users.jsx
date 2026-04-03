import { useContext, useEffect, useMemo, useState } from "react";
import {
  Search,
  Users as UsersIcon,
  Plus,
  Pencil,
  KeyRound,
  Trash2,
  RefreshCcw,
  X
} from "lucide-react";
import { toast } from "react-hot-toast";
import { AuthContext } from "../auth/AuthContext";
import { deleteRequest, postRequest, putRequest } from "../api/request";
import { loadDictionaries } from "../utils/dictionaryLoader";
import { formatDateTime } from "../utils/date";

const emptyForm = {
  username: "",
  email: "",
  password: "",
  first_name: "",
  last_name: "",
  middle_name: "",
  phone: "",
  role_id: "",
  supplier_id: "",
  contractor_id: ""
};

const getRoleLabel = (roles, roleId) =>
  roles.find((role) => role.id === Number(roleId))?.label || `Роль #${roleId}`;

const getEntityLabel = (items, id) =>
  items.find((item) => item.id === Number(id))?.label || "Не выбрано";

const normalizeLabel = (value) => (value || "").trim().toLowerCase();

const isSupplierRole = (role) => normalizeLabel(role?.label).includes("постав");

const isContractorRole = (role) => normalizeLabel(role?.label).includes("подряд");

export default function Users() {
  const { user } = useContext(AuthContext);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dictionaries, setDictionaries] = useState({
    userRoles: [],
    suppliers: [],
    contractors: []
  });

  const [inputSearch, setInputSearch] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const isAdmin = user?.role_id === 1;

  const selectedRole = useMemo(
    () => dictionaries.userRoles.find((role) => role.id === Number(form.role_id)),
    [dictionaries.userRoles, form.role_id]
  );

  const showSupplierField = isSupplierRole(selectedRole);
  const showContractorField = isContractorRole(selectedRole);

  const loadUsers = async () => {
    if (!isAdmin) return;

    try {
      setLoading(true);

      const payload = {
        page: 1,
        size: 200
      };

      if (search.trim()) {
        payload.search = search.trim();
      }

      if (roleFilter) {
        payload.role_id = Number(roleFilter);
      }

      const res = await postRequest("/users/search", payload);

      if (res?.success) {
        setItems(res.data || []);
      } else {
        toast.error(res?.message || "Не удалось загрузить пользователей");
      }
    } catch (error) {
      console.error("Users load error", error);
      toast.error("Ошибка загрузки пользователей");
    } finally {
      setLoading(false);
    }
  };

  const loadDicts = async () => {
    const data = await loadDictionaries(["userRoles", "suppliers", "contractors"]);

    setDictionaries({
      userRoles: data.userRoles || [],
      suppliers: data.suppliers || [],
      contractors: data.contractors || []
    });
  };

  useEffect(() => {
    loadDicts();
  }, []);

  useEffect(() => {
    loadUsers();
  }, [search, roleFilter, isAdmin]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingUser(null);
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
    setEditingUser(item);
    setForm({
      username: item.username || "",
      email: item.email || "",
      password: "",
      first_name: item.first_name || "",
      last_name: item.last_name || "",
      middle_name: item.middle_name || "",
      phone: item.phone || "",
      role_id: item.role_id || "",
      supplier_id: item.supplier_id || "",
      contractor_id: item.contractor_id || ""
    });
    setFormOpen(true);
  };

  const handleSearch = () => {
    setSearch(inputSearch);
  };

  const handleRoleChange = (value) => {
    const nextRole = dictionaries.userRoles.find((role) => role.id === Number(value));
    const supplierRoleSelected = isSupplierRole(nextRole);
    const contractorRoleSelected = isContractorRole(nextRole);

    setForm((prev) => ({
      ...prev,
      role_id: value,
      supplier_id: supplierRoleSelected ? prev.supplier_id : "",
      contractor_id: contractorRoleSelected ? prev.contractor_id : ""
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.username.trim()) return toast.error("Введите логин");
    if (!form.email.trim()) return toast.error("Введите email");
    if (!form.role_id) return toast.error("Выберите роль");
    if (!editingUser && !form.password.trim()) return toast.error("Введите пароль");
    if (showSupplierField && !form.supplier_id) {
      return toast.error("Выберите поставщика");
    }
    if (showContractorField && !form.contractor_id) {
      return toast.error("Выберите подрядчика");
    }
    if (form.supplier_id && form.contractor_id) {
      return toast.error("Пользователь не может быть одновременно поставщиком и подрядчиком");
    }

    try {
      setSaving(true);

      const payload = {
        username: form.username.trim(),
        email: form.email.trim(),
        first_name: form.first_name.trim() || null,
        last_name: form.last_name.trim() || null,
        middle_name: form.middle_name.trim() || null,
        phone: form.phone.trim() || null,
        role_id: Number(form.role_id),
        supplier_id: showSupplierField && form.supplier_id ? Number(form.supplier_id) : null,
        contractor_id: showContractorField && form.contractor_id ? Number(form.contractor_id) : null
      };

      if (!editingUser) {
        payload.password = form.password;
      }

      const res = editingUser
        ? await putRequest(`/users/update/${editingUser.id}`, payload)
        : await postRequest("/users/createUser", { ...payload, password: form.password });

      if (!res?.success) {
        toast.error(res?.message || "Не удалось сохранить пользователя");
        return;
      }

      toast.success(editingUser ? "Пользователь обновлён" : "Пользователь создан");
      closeForm();
      await loadUsers();
    } catch (error) {
      console.error("User save error", error);
      toast.error(error?.response?.data?.message || "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async (item) => {
    const confirmed = window.confirm(`Сбросить пароль для ${item.username}?`);
    if (!confirmed) return;

    try {
      const res = await putRequest(`/users/resetPassword/${item.id}`);

      if (res?.success) {
        toast.success("Пароль сброшен, письмо отправлено");
      } else {
        toast.error(res?.message || "Не удалось сбросить пароль");
      }
    } catch (error) {
      console.error("Reset password error", error);
      toast.error(error?.response?.data?.message || "Ошибка сброса пароля");
    }
  };

  const handleDelete = async (item) => {
    if (item.id === user?.id) {
      toast.error("Свой аккаунт удалить нельзя");
      return;
    }

    const confirmed = window.confirm(`Удалить пользователя ${item.username}?`);
    if (!confirmed) return;

    try {
      const res = await deleteRequest(`/users/delete/${item.id}`);

      if (res?.success) {
        toast.success("Пользователь удалён");
        await loadUsers();
      } else {
        toast.error(res?.message || "Не удалось удалить пользователя");
      }
    } catch (error) {
      console.error("Delete user error", error);
      toast.error(error?.response?.data?.message || "Ошибка удаления");
    }
  };

  if (!isAdmin) {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/40 p-4 text-sm text-red-200">
        Доступ к управлению пользователями есть только у администратора.
      </div>
    );
  }

  const Field = ({ label, children }) => (
    <div>
      <div className="mb-1 text-xs text-gray-400">{label}</div>
      {children}
    </div>
  );

  return (
    <div className="min-h-full text-white">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <UsersIcon size={20} className="text-blue-400" />
          <h1 className="text-lg font-semibold">Пользователи</h1>
        </div>

        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm hover:bg-blue-500"
        >
          <Plus size={16} />
          Новый
        </button>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-3 text-gray-400" />
            <input
              value={inputSearch}
              onChange={(e) => setInputSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
              }}
              placeholder="Поиск по имени, email, логину, телефону"
              className="w-full rounded-lg border border-gray-800 bg-gray-900 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <button
            onClick={handleSearch}
            className="rounded-lg bg-gray-800 px-4 py-2 text-sm hover:bg-gray-700"
          >
            Найти
          </button>
        </div>

        <div className="flex gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="flex-1 rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">Все роли</option>
            {dictionaries.userRoles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.label}
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              setInputSearch("");
              setSearch("");
              setRoleFilter("");
            }}
            className="flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-sm hover:bg-gray-700"
          >
            <RefreshCcw size={16} />
            Сброс
          </button>
        </div>
      </div>

      <div className="space-y-2.5">
        {loading && (
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 text-sm text-gray-400">
            Загрузка пользователей...
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 text-sm text-gray-400">
            Пользователи не найдены.
          </div>
        )}

        {!loading &&
          items.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-gray-800 bg-gray-900 p-3"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">
                    {[item.first_name, item.last_name].filter(Boolean).join(" ") || item.username}
                  </div>
                  <div className="text-[11px] text-gray-400">
                    @{item.username} • {item.email}
                  </div>
                </div>

                <div className="rounded-full bg-blue-950 px-2.5 py-1 text-[10px] text-blue-300">
                  {getRoleLabel(dictionaries.userRoles, item.role_id)}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-1 text-[11px] text-gray-400">
                <div>Телефон: {item.phone || "—"}</div>
                {item.supplier_id && (
                  <div>Поставщик: {getEntityLabel(dictionaries.suppliers, item.supplier_id)}</div>
                )}
                {item.contractor_id && (
                  <div>Подрядчик: {getEntityLabel(dictionaries.contractors, item.contractor_id)}</div>
                )}
                <div>Создан: {formatDateTime(item.created_at)}</div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => handleDelete(item)}
                  disabled={item.id === user?.id}
                  className="flex items-center gap-1.5 rounded-lg bg-red-600 px-2.5 py-1.5 text-[11px] hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  Удалить
                </button>

                <button
                  onClick={() => handleResetPassword(item)}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-2.5 py-1.5 text-[11px] hover:bg-amber-500"
                >
                  <KeyRound size={14} />
                  Сброс пароля
                </button>

                <button
                  onClick={() => openEdit(item)}
                  className="flex items-center gap-1.5 rounded-lg bg-gray-800 px-2.5 py-1.5 text-[11px] hover:bg-gray-700"
                >
                  <Pencil size={14} />
                  Изменить
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
                  {editingUser ? "Редактирование пользователя" : "Новый пользователь"}
                </div>
                <div className="text-xs text-gray-400">
                  {editingUser ? "Обновление данных пользователя" : "Создание нового аккаунта"}
                </div>
              </div>

              <button onClick={closeForm} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">

              <Field label="Логин">
                <input
                  value={form.username}
                  onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                  className="w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </Field>

              <Field label="Email">
                <input
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  type="email"
                  className="w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </Field>

              {!editingUser && (
                <Field label="Пароль">
                  <input
                    value={form.password}
                    onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                    type="password"
                    className="w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </Field>
              )}

              <Field label="Имя">
                <input
                  value={form.first_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, first_name: e.target.value }))}
                  className="w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </Field>

              <Field label="Фамилия">
                <input
                  value={form.last_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, last_name: e.target.value }))}
                  className="w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </Field>

              <Field label="Отчество">
                <input
                  value={form.middle_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, middle_name: e.target.value }))}
                  className="w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </Field>

              <Field label="Телефон">
                <input
                  value={form.phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                  className="w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </Field>

              <Field label="Роль">
                <select
                  value={form.role_id}
                  onChange={(e) => handleRoleChange(e.target.value)}
                  className="w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Выберите роль</option>
                  {dictionaries.userRoles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </Field>

              {showSupplierField && (
                <Field label="Поставщик">
                  <select
                    value={form.supplier_id}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        supplier_id: e.target.value,
                        contractor_id: ""
                      }))
                    }
                    className="w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Выберите поставщика</option>
                    {dictionaries.suppliers.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              {showContractorField && (
                <Field label="Подрядчик">
                  <select
                    value={form.contractor_id}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        contractor_id: e.target.value,
                        supplier_id: ""
                      }))
                    }
                    className="w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Выберите подрядчика</option>
                    {dictionaries.contractors.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

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
                  {saving ? "Сохранение..." : editingUser ? "Сохранить" : "Создать"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
