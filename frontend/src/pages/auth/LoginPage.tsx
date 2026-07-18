import {
  Hospital,
  MonitorCheck,
  ShieldCheck,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import type { UserRole } from "../../types";
import loginBackground from "../../assets/backgrounds/hospital-login.png";

export function LoginPage() {
  const { user, login, isAuthenticated } = useAuth();
  const [role, setRole] = useState<UserRole>("PATIENT");
  const [cccd, setCccd] = useState("001204012345");
  const valid = /^\d{9,12}$/.test(cccd);
  if (isAuthenticated && user)
    return <Navigate to={`/${user.role.toLowerCase()}`} replace />;
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (valid)
      login.mutate({
        identifier:
          role === "DOCTOR"
            ? `doctor-${cccd}`
            : role === "ADMIN"
              ? `admin-${cccd}`
              : cccd,
        password: "cccd-login",
        role,
      });
  };

  return (
    <main className="min-h-screen bg-[#edf2f6] p-4 sm:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,.14)] lg:grid-cols-[.9fr_1.1fr]">
        <section
          className="relative hidden overflow-hidden bg-cover bg-center lg:block"
          style={{ backgroundImage: `url(${loginBackground})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-[#17324d]/45 via-[#17324d]/25 to-[#10283d]/85" />
          <div className="relative flex h-full flex-col justify-between p-12 text-white">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-lg bg-[#ea7a50] text-white">
                <Hospital />
              </span>
              <strong className="text-xl drop-shadow-sm">
                Bệnh viện An Tâm
              </strong>
            </div>
            <h1 className="text-5xl font-extrabold leading-[1.12] tracking-tight drop-shadow-md">
              Biết rõ nơi cần đến.
              <br />
              Chủ động thời gian chờ.
            </h1>
            <div className="flex items-center gap-2 text-sm text-white/85">
              <ShieldCheck size={18} />
              Thông tin chỉ phục vụ cho lượt khám hiện tại
            </div>
          </div>
        </section>
        <section className="grid place-items-center px-6 py-10 sm:px-12">
          <div className="w-full max-w-lg">
            <div className="mb-9 flex items-center gap-2 text-xl font-extrabold text-[#176b9b] lg:hidden">
              <Hospital />
              Bệnh viện An Tâm
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-950">
              Đăng nhập
            </h2>
            <div className="mt-6 grid grid-cols-3 gap-2">
              <Role
                active={role === "PATIENT"}
                onClick={() => setRole("PATIENT")}
                icon={<UserRound />}
                label="Bệnh nhân"
              />
              <Role
                active={role === "DOCTOR"}
                onClick={() => setRole("DOCTOR")}
                icon={<Stethoscope />}
                label="Nhân viên"
              />
              <Role
                active={role === "ADMIN"}
                onClick={() => setRole("ADMIN")}
                icon={<MonitorCheck />}
                label="Vận hành"
              />
            </div>
            <form onSubmit={submit} className="mt-8">
              <label>
                <span className="field-label">Số căn cước công dân</span>
                <input
                  inputMode="numeric"
                  autoFocus
                  value={cccd}
                  onChange={(e) =>
                    setCccd(e.target.value.replace(/\D/g, "").slice(0, 12))
                  }
                  className="form-control text-lg tracking-wider"
                  placeholder="Nhập 9–12 chữ số"
                />
              </label>
              {cccd && !valid && (
                <p className="mt-2 text-sm font-medium text-red-600">
                  CCCD cần có từ 9 đến 12 chữ số.
                </p>
              )}
              <button
                disabled={!valid || login.isPending}
                className="mt-6 h-13 w-full rounded-lg bg-[#176b9b] px-6 font-bold text-white hover:bg-[#145b84] disabled:bg-slate-300"
              >
                {login.isPending ? "Đang kiểm tra..." : "Tiếp tục"}
              </button>
            </form>
            <div className="mt-7 flex items-center justify-between border-t border-slate-200 pt-5 text-sm">
              <span className="text-slate-500">
                Máy check-in tại cửa phòng?
              </span>
              <Link
                to="/kiosk"
                className="font-bold text-[#176b9b] hover:underline"
              >
                Mở chế độ kiosk
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Role({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border text-sm font-bold transition ${active ? "border-[#176b9b] bg-sky-50 text-[#176b9b] ring-2 ring-sky-100" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"}`}
    >
      <span className="[&>svg]:h-6 [&>svg]:w-6">{icon}</span>
      {label}
    </button>
  );
}
