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
import { useTheme } from "../context/ThemeContext";
import { themeControl, themeSurface, themeText } from "../utils/themeStyles";
import PullToRefresh from "../components/PullToRefresh";

const TEXT = {
  roleFallback: "Роль",
  notSelected: "Не выбрано",
  loadUsersFailed: "Не удалось загрузить пользователей",
  loadUsersError: "Ошибка при загрузке пользователей",
  enterLogin: "Введите логин",
  enterEmail: "Введите email",
  chooseRole: "Выберите роль",
  enterPassword: "Введите пароль",
  chooseSupplier: "Выберите поставщика",
  chooseContractor: "Выберите подрядчика",
  supplierAndContractorConflict:
    "Пользователь не может одновременно быть поставщиком и подрядчиком",
  saveUserFailed: "Не удалось сохранить пользователя",
  userUpdated: "Пользователь успешно обновлён",
  userCreated: "Пользователь успешно создан",
  saveError: "Ошибка при сохранении",
  resetPasswordConfirm: "Сбросить пароль для",
  resetPasswordSuccess: "Пароль сброшен, письмо отправлено",
  resetPasswordFailed: "Не удалось сбросить пароль",
  resetPasswordError: "Ошибка при сбросе пароля",
  selfDeleteForbidden: "Нельзя удалить собственный аккаунт",
  deleteUserConfirm: "Удалить пользователя",
  userDeleted: "Пользователь удалён",
  deleteUserFailed: "Не удалось удалить пользователя",
  deleteUserError: "Ошибка при удалении",
  adminOnly:
    "Доступ к управлению пользователями есть только у администратора.",
  users: "Пользователи",
  newUser: "Новый",
  searchPlaceholder: "Поиск по имени, email, логину или телефону",
  allRoles: "Все роли",
  reset: "Сбросить",
  loadingUsers: "Загрузка пользователей...",
  usersNotFound: "Пользователи не найдены",
  phone: "Телефон",
  supplier: "Поставщик",
  contractor: "Подрядчик",
  createdAt: "Создан",
  delete: "Удалить",
  resetPassword: "Сбросить пароль",
  edit: "Изменить",
  editUser: "Редактирование пользователя",
  createUserTitle: "Новый пользователь",
  editUserSubtitle: "Обновление данных пользователя",
  createUserSubtitle: "Создание нового аккаунта",
  login: "Логин",
  password: "Пароль",
  firstName: "Имя",
  lastName: "Фамилия",
  middleName: "Отчество",
  role: "Роль",
  chooseRoleOption: "Выберите роль",
  chooseSupplierOption: "Выберите поставщика",
  chooseContractorOption: "Выберите подрядчика",
  cancel: "Отмена",
  saving: "Сохранение...",
  save: "Сохранить",
  create: "Создать"
};

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
  roles.find((role) => role.id === Number(roleId))?.label || `${TEXT.roleFallback} #${roleId}`;

const getEntityLabel = (items, id) =>
  items.find((item) => item.id === Number(id))?.label || TEXT.notSelected;

const normalizeLabel = (value) => (value || "").trim().toLowerCase();
const isSupplierRole = (role) =>
  normalizeLabel(role?.label).includes("постав");

const isContractorRole = (role) =>
  normalizeLabel(role?.label).includes("подряд");

function Field({ label, children, secondaryTextClass }) {
  return (
    <div>
      <div className={`mb-1 text-xs ${secondaryTextClass}`}>{label}</div>
      {children}
    </div>
  );
}

export default function Users() {
  const { user } = useContext(AuthContext);
  const { isDark } = useTheme();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dictionaries, setDictionaries] = useState({ userRoles: [], suppliers: [], contractors: [] });
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

  const pageClass = `min-h-full ${themeText.page(isDark)}`;
  const panelClass = `${themeSurface.panel(isDark)} p-4`;
  const cardClass = `${themeSurface.panel(isDark)} p-3`;
  const inputClass = themeControl.input(isDark).replace("pl-9 ", "").replace("rounded-lg ", "rounded-lg px-3 ");
  const searchInputClass = themeControl.input(isDark);
  const subtleButtonClass = themeControl.subtleButton(isDark);
  const modalClass = `${themeSurface.panel(isDark)} max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl p-4`;
  const secondaryTextClass = themeText.secondary(isDark);

  const loadUsers = async () => {
    if (!isAdmin) return;
    try {
      setLoading(true);
      const payload = { page: 1, size: 200 };
      if (search.trim()) payload.search = search.trim();
      if (roleFilter) payload.role_id = Number(roleFilter);

      const res = await postRequest("/users/search", payload);
      if (res?.success) {
        setItems(res.data || []);
      } else {
        toast.error(res?.message || TEXT.loadUsersFailed);
      }
    } catch (error) {
      console.error("Users load error", error);
      toast.error(TEXT.loadUsersError);
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

  const handleSearch = () => setSearch(inputSearch);

  const handleRoleChange = (value) => {
    const nextRole = dictionaries.userRoles.find((role) => role.id === Number(value));
    setForm((prev) => ({
      ...prev,
      role_id: value,
      supplier_id: isSupplierRole(nextRole) ? prev.supplier_id : "",
      contractor_id: isContractorRole(nextRole) ? prev.contractor_id : ""
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username.trim()) return toast.error(TEXT.enterLogin);
    if (!form.email.trim()) return toast.error(TEXT.enterEmail);
    if (!form.role_id) return toast.error(TEXT.chooseRole);
    if (!editingUser && !form.password.trim()) return toast.error(TEXT.enterPassword);
    if (showSupplierField && !form.supplier_id) return toast.error(TEXT.chooseSupplier);
    if (showContractorField && !form.contractor_id) return toast.error(TEXT.chooseContractor);
    if (form.supplier_id && form.contractor_id) return toast.error(TEXT.supplierAndContractorConflict);

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
      if (!editingUser) payload.password = form.password;

      const res = editingUser
        ? await putRequest(`/users/update/${editingUser.id}`, payload)
        : await postRequest("/users/createUser", { ...payload, password: form.password });

      if (!res?.success) {
        toast.error(res?.message || TEXT.saveUserFailed);
        return;
      }

      toast.success(editingUser ? TEXT.userUpdated : TEXT.userCreated);
      closeForm();
      await loadUsers();
    } catch (error) {
      console.error("User save error", error);
      toast.error(error?.response?.data?.message || TEXT.saveError);
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async (item) => {
    if (!window.confirm(`${TEXT.resetPasswordConfirm} ${item.username}?`)) return;
    try {
      const res = await putRequest(`/users/resetPassword/${item.id}`);
      if (res?.success) toast.success(TEXT.resetPasswordSuccess);
      else toast.error(res?.message || TEXT.resetPasswordFailed);
    } catch (error) {
      console.error("Reset password error", error);
      toast.error(error?.response?.data?.message || TEXT.resetPasswordError);
    }
  };

  const handleDelete = async (item) => {
    if (item.id === user?.id) return toast.error(TEXT.selfDeleteForbidden);
    if (!window.confirm(`${TEXT.deleteUserConfirm} ${item.username}?`)) return;
    try {
      const res = await deleteRequest(`/users/delete/${item.id}`);
      if (res?.success) {
        toast.success(TEXT.userDeleted);
        await loadUsers();
      } else {
        toast.error(res?.message || TEXT.deleteUserFailed);
      }
    } catch (error) {
      console.error("Delete user error", error);
      toast.error(error?.response?.data?.message || TEXT.deleteUserError);
    }
  };

  if (!isAdmin) {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/40 p-4 text-sm text-red-200">
        {TEXT.adminOnly}
      </div>
    );
  }

  return (
    <div className={pageClass}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <UsersIcon size={20} className="text-blue-400" />
          <h1 className="text-lg font-semibold">{TEXT.users}</h1>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-500">
          <Plus size={16} />
          {TEXT.newUser}
        </button>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className={`absolute left-3 top-3 ${secondaryTextClass}`} />
            <input value={inputSearch} onChange={(e) => setInputSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} placeholder={TEXT.searchPlaceholder} className={searchInputClass} />
          </div>
          <button onClick={handleSearch} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500">Go</button>
        </div>

        <div className="flex gap-2">
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={inputClass}>
            <option value="">{TEXT.allRoles}</option>
            {dictionaries.userRoles.map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}
          </select>
          <button onClick={() => { setInputSearch(""); setSearch(""); setRoleFilter(""); }} className={`${subtleButtonClass} flex items-center gap-2`}>
            <RefreshCcw size={16} />
            {TEXT.reset}
          </button>
        </div>
      </div>

      <PullToRefresh className="space-y-2.5" onRefresh={loadUsers} disabled={loading || formOpen}>
        {loading && <div className={`${panelClass} text-sm ${secondaryTextClass}`}>{TEXT.loadingUsers}</div>}
        {!loading && items.length === 0 && <div className={`${panelClass} text-sm ${secondaryTextClass}`}>{TEXT.usersNotFound}</div>}

        {!loading && items.map((item) => (
          <div key={item.id} className={cardClass}>
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">{[item.first_name, item.last_name].filter(Boolean).join(" ") || item.username}</div>
                <div className={`text-[11px] ${secondaryTextClass}`}>@{item.username} {"\u2022"} {item.email}</div>
              </div>
              <div className="rounded-full bg-blue-950 px-2.5 py-1 text-[10px] text-white">{getRoleLabel(dictionaries.userRoles, item.role_id)}</div>
            </div>

            <div className={`grid grid-cols-1 gap-1 text-[11px] ${secondaryTextClass}`}>
              <div>{TEXT.phone}: {item.phone || "\u2014"}</div>
              {item.supplier_id && <div>{TEXT.supplier}: {getEntityLabel(dictionaries.suppliers, item.supplier_id)}</div>}
              {item.contractor_id && <div>{TEXT.contractor}: {getEntityLabel(dictionaries.contractors, item.contractor_id)}</div>}
              <div>{TEXT.createdAt}: {formatDateTime(item.created_at)}</div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => handleDelete(item)} disabled={item.id === user?.id} className="flex items-center gap-1.5 rounded-lg bg-red-600 px-2.5 py-1.5 text-[11px] text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"><Trash2 size={14} />{TEXT.delete}</button>
              <button onClick={() => handleResetPassword(item)} className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-2.5 py-1.5 text-[11px] text-white hover:bg-amber-500"><KeyRound size={14} />{TEXT.resetPassword}</button>
              <button onClick={() => openEdit(item)} className={`${themeControl.chipButton(isDark)} flex items-center gap-1.5 px-2.5 py-1.5 text-[11px]`}><Pencil size={14} />{TEXT.edit}</button>
            </div>
          </div>
        ))}
      </PullToRefresh>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4">
          <div className={modalClass}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">{editingUser ? TEXT.editUser : TEXT.createUserTitle}</div>
                <div className={`text-xs ${secondaryTextClass}`}>{editingUser ? TEXT.editUserSubtitle : TEXT.createUserSubtitle}</div>
              </div>
              <button onClick={closeForm} className={secondaryTextClass}><X size={18} /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <Field secondaryTextClass={secondaryTextClass} label={TEXT.login}><input value={form.username} onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))} className={inputClass} /></Field>
              <Field secondaryTextClass={secondaryTextClass} label="Email"><input value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} type="email" className={inputClass} /></Field>
              {!editingUser && <Field secondaryTextClass={secondaryTextClass} label={TEXT.password}><input value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} type="password" className={inputClass} /></Field>}
              <Field secondaryTextClass={secondaryTextClass} label={TEXT.firstName}><input value={form.first_name} onChange={(e) => setForm((prev) => ({ ...prev, first_name: e.target.value }))} className={inputClass} /></Field>
              <Field secondaryTextClass={secondaryTextClass} label={TEXT.lastName}><input value={form.last_name} onChange={(e) => setForm((prev) => ({ ...prev, last_name: e.target.value }))} className={inputClass} /></Field>
              <Field secondaryTextClass={secondaryTextClass} label={TEXT.middleName}><input value={form.middle_name} onChange={(e) => setForm((prev) => ({ ...prev, middle_name: e.target.value }))} className={inputClass} /></Field>
              <Field secondaryTextClass={secondaryTextClass} label={TEXT.phone}><input value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} className={inputClass} /></Field>
              <Field secondaryTextClass={secondaryTextClass} label={TEXT.role}>
                <select value={form.role_id} onChange={(e) => handleRoleChange(e.target.value)} className={inputClass}>
                  <option value="">{TEXT.chooseRoleOption}</option>
                  {dictionaries.userRoles.map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}
                </select>
              </Field>
              {showSupplierField && <Field secondaryTextClass={secondaryTextClass} label={TEXT.supplier}><select value={form.supplier_id} onChange={(e) => setForm((prev) => ({ ...prev, supplier_id: e.target.value, contractor_id: "" }))} className={inputClass}><option value="">{TEXT.chooseSupplierOption}</option>{dictionaries.suppliers.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>}
              {showContractorField && <Field secondaryTextClass={secondaryTextClass} label={TEXT.contractor}><select value={form.contractor_id} onChange={(e) => setForm((prev) => ({ ...prev, contractor_id: e.target.value, supplier_id: "" }))} className={inputClass}><option value="">{TEXT.chooseContractorOption}</option>{dictionaries.contractors.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>}

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={closeForm} className={`flex-1 ${subtleButtonClass}`}>{TEXT.cancel}</button>
                <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-50">{saving ? TEXT.saving : editingUser ? TEXT.save : TEXT.create}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
