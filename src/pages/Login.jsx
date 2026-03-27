import { useState, useContext } from "react";
import { AuthContext } from "../auth/AuthContext";
import { useNavigate } from "react-router-dom";
import { postRequest, putRequest } from "../api/request";
import toast from "react-hot-toast";
import { Eye, EyeOff } from "lucide-react";

export default function Login() {

  const { login: setAuth } = useContext(AuthContext);
  const navigate = useNavigate();

  const [username, setUsername] = useState("dev");
  const [password, setPassword] = useState("123");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [showResetModal, setShowResetModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");

  const handleLogin = async () => {

    if (!username.trim()) return toast.error("Введите логин");
    if (!password.trim()) return toast.error("Введите пароль");

    setLoading(true);

    try {

      const res = await postRequest("/auth/login", {
        username,
        password
      });

      if (res.success) {

        // console.log("LOGIN", res)

        localStorage.setItem("token", res.token);

        // 🔥 если требуется смена пароля
        if (res.data?.required_action === "RESET_PASSWORD") {
          setShowResetModal(true);
          return;
        }

        setAuth(res.data, res.token);
        navigate("/projects");

      } else {
        toast.error(res.message || "Ошибка авторизации");
      }

    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка сервера");
    }

    setLoading(false);
  };

  /* ---------------- RESET PASSWORD ---------------- */

  const handleResetPassword = async () => {

    if (!newPassword.trim()) {
      toast.error("Введите новый пароль");
      return;
    }

    if (newPassword !== repeatPassword) {
      toast.error("Пароли не совпадают");
      return;
    }

    try {
      console.log("P", password)

      const res = await putRequest("/users/changeOwnPassword", {
        oldPassword: password,
        newPassword: newPassword
      });

      if (res.success) {

        toast.success("Пароль обновлен");

        // 🔥 сразу логиним
        const loginRes = await postRequest("/auth/login", {
          username,
          password: newPassword
        });

        if (loginRes.success) {
          setAuth(loginRes.data, loginRes.token);
          navigate("/projects");
        }

      } else {
        toast.error(res.message || "Ошибка смены пароля");
      }

    } catch (e) {
      toast.error(e?.response?.data?.message || "Ошибка сервера");
    }

  };

  return (

    <div className="min-h-screen flex items-center justify-center bg-gray-900">

      <div className="w-full max-w-sm bg-gray-800 p-8 rounded-2xl shadow-lg">

        <h1 className="text-2xl font-bold text-white mb-6 text-center">
          DreamHouse
        </h1>

        <input
          className="w-full mb-4 p-3 rounded-lg bg-gray-700 text-white"
          placeholder="Username"
          onChange={(e) => setUsername(e.target.value)}
          defaultValue={username}
        />

        <div className="relative mb-6">

          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 pr-12 rounded-lg bg-gray-700 text-white"
            placeholder="Password"
          />

          <div
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-0 top-0 h-full w-12 flex items-center justify-center text-gray-400"
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </div>

        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg"
        >
          {loading ? "Загрузка..." : "Вход"}
        </button>

      </div>

      {/* 🔥 RESET PASSWORD MODAL */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">

          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-[350px] space-y-4">

            <h2 className="text-lg font-semibold text-white">
              Смена пароля
            </h2>

            <input
              type="password"
              placeholder="Новый пароль"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full p-3 pr-12 rounded-lg bg-gray-700 text-white"
            />

            <input
              type="password"
              placeholder="Повторите пароль"
              value={repeatPassword}
              onChange={(e) => setRepeatPassword(e.target.value)}
              className="w-full p-3 pr-12 rounded-lg bg-gray-700 text-white"
            />

            <button
              onClick={handleResetPassword}
              className="w-full bg-green-600 hover:bg-green-500 p-3 rounded text-white"
            >
              Сохранить
            </button>

          </div>

        </div>
      )}

    </div>

  );

}