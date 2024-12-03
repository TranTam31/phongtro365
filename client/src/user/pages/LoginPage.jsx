import { Link, Navigate } from "react-router-dom";
import { useContext, useState } from "react";
import axios from "axios";
import { UserContext } from "../components/UserContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [redirect, setRedirect] = useState(false);
  const { setUser } = useContext(UserContext);
  const [isBlacklisted, setIsBlacklisted] = useState(false); // Trạng thái BLACKLISTED
  const [blacklistedMessage, setBlacklistedMessage] = useState(""); // Thông báo cho BLACKLISTED

  async function handleLoginSubmit(ev) {
    ev.preventDefault();
    try {
        const { data } = await axios.post("/auth/login", { email, password });

        if (data.user.status === "BLACKLISTED") {
            setIsBlacklisted(true); // Hiển thị popup thông báo
            setBlacklistedMessage("Tài khoản của bạn đã bị khóa vĩnh viễn.");
        } else {
            setUser(data.user);
            alert("Đăng nhập thành công");
            setRedirect(true);
        }
    } catch (error) {
        if (error.response) {
            const { status, data } = error.response;

            if (status === 403 && data.status === "BLACKLISTED") {
                setIsBlacklisted(true); // Hiển thị popup nếu BLACKLISTED
                setBlacklistedMessage(data.error);
            } else {
                alert(data.error || "Đăng nhập thất bại. Vui lòng thử lại.");
            }
        } else {
            alert("Có lỗi xảy ra. Vui lòng thử lại.");
        }
    }
}

  async function handleLogout() {
    window.location.reload()
  }

  if (redirect) {
    return <Navigate to="/" />;
  }

  return (
    <div className="mt-4 grow flex items-center justify-around">
      <div className="mb-64">
        <h1 className="text-4xl text-center mb-4">Login</h1>
        <form className="max-w-md mx-auto" onSubmit={handleLoginSubmit}>
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
          />
          <input
            type="password"
            placeholder="password"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
          />
          <button className="primary">Login</button>
          <div className="text-center py-2 text-gray-500">
            Don't have an account yet?{" "}
            <Link className="underline text-black" to={"/register"}>
              Register now
            </Link>
          </div>
        </form>
      </div>

      {/* Popup hiển thị nếu tài khoản bị khóa */}
      {isBlacklisted && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-md w-96">
            <h2 className="text-xl font-semibold text-red-500 mb-4">Thông báo</h2>
            <p className="mb-4">{blacklistedMessage}</p>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}