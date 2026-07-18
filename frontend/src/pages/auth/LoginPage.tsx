import { ArrowLeft, Hospital, ShieldCheck, Stethoscope, UserRound } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import loginBackground from "../../assets/backgrounds/hospital-login.png";
import { useAuth } from "../../hooks/useAuth";

type LoginMode = "patient" | "staff";

export function LoginPage() {
  const { user, login, staffLogin, isAuthenticated } = useAuth();
  const [mode, setMode] = useState<LoginMode>("patient");
  const [cccd, setCccd] = useState("001204012345");
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const cccdValid = /^\d{9,12}$/.test(cccd);
  const staffValid = userName.trim().length > 0 && password.length > 0;
  const pending = login.isPending || staffLogin.isPending;

  if (isAuthenticated && user) {
    return <Navigate to={`/${user.role.toLowerCase()}`} replace />;
  }

  const submitPatient = (event: FormEvent) => {
    event.preventDefault();
    if (cccdValid) login.mutate({ cccd });
  };

  const submitStaff = (event: FormEvent) => {
    event.preventDefault();
    if (staffValid) staffLogin.mutate({ userName, password });
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
              <strong className="text-xl drop-shadow-sm">Bệnh viện An Tâm</strong>
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

            {mode === "patient" ? (
              <PatientLoginForm
                cccd={cccd}
                valid={cccdValid}
                pending={pending}
                onChangeCccd={setCccd}
                onSubmit={submitPatient}
                onStaffMode={() => {
                  staffLogin.reset();
                  setMode("staff");
                }}
              />
            ) : (
              <StaffLoginForm
                userName={userName}
                password={password}
                valid={staffValid}
                pending={pending}
                errorMessage={getLoginErrorMessage(staffLogin.error)}
                onChangeUserName={setUserName}
                onChangePassword={setPassword}
                onSubmit={submitStaff}
                onPatientMode={() => {
                  staffLogin.reset();
                  setMode("patient");
                }}
              />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function getLoginErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") return "";
  const response = "response" in error ? error.response : undefined;

  if (!response || typeof response !== "object") return "Tài khoản hoặc mật khẩu chưa đúng";
  const data = "data" in response ? response.data : undefined;

  if (!data || typeof data !== "object") return "Tài khoản hoặc mật khẩu chưa đúng";
  const errorBody = "error" in data ? data.error : undefined;

  if (!errorBody || typeof errorBody !== "object") return "Tài khoản hoặc mật khẩu chưa đúng";
  const message = "message" in errorBody ? errorBody.message : undefined;

  return typeof message === "string" && message ? message : "Tài khoản hoặc mật khẩu chưa đúng";
}

function PatientLoginForm({
  cccd,
  valid,
  pending,
  onChangeCccd,
  onSubmit,
  onStaffMode,
}: {
  cccd: string;
  valid: boolean;
  pending: boolean;
  onChangeCccd: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onStaffMode: () => void;
}) {
  return (
    <>
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-lg bg-sky-50 text-[#176b9b]">
          <UserRound size={22} />
        </span>
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-950">Đăng nhập</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">Cổng bệnh nhân</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-8">
        <label>
          <span className="field-label">Số căn cước công dân</span>
          <input
            inputMode="numeric"
            autoFocus
            value={cccd}
            onChange={(event) => onChangeCccd(event.target.value.replace(/\D/g, "").slice(0, 12))}
            className="form-control text-lg tracking-wider"
            placeholder="Nhập 9-12 chữ số"
          />
        </label>
        {cccd && !valid && (
          <p className="mt-2 text-sm font-medium text-red-600">
            CCCD cần có từ 9 đến 12 chữ số.
          </p>
        )}
        <button
          disabled={!valid || pending}
          className="mt-6 h-12 w-full rounded-lg bg-[#176b9b] px-6 font-bold text-white hover:bg-[#145b84] disabled:bg-slate-300"
        >
          {pending ? "Đang kiểm tra..." : "Tiếp tục"}
        </button>
      </form>

      <div className="mt-7 grid gap-3 border-t border-slate-200 pt-5 text-sm">
        <button
          type="button"
          onClick={onStaffMode}
          className="flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white font-bold text-[#176b9b] transition hover:border-sky-200 hover:bg-sky-50"
        >
          <Stethoscope size={18} />
          Đăng nhập nhân viên
        </button>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Máy check-in tại cửa phòng?</span>
          <Link to="/kiosk" className="font-bold text-[#176b9b] hover:underline">
            Mở chế độ kiosk
          </Link>
        </div>
      </div>
    </>
  );
}

function StaffLoginForm({
  userName,
  password,
  valid,
  pending,
  errorMessage,
  onChangeUserName,
  onChangePassword,
  onSubmit,
  onPatientMode,
}: {
  userName: string;
  password: string;
  valid: boolean;
  pending: boolean;
  errorMessage: string;
  onChangeUserName: (value: string) => void;
  onChangePassword: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onPatientMode: () => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onPatientMode}
        className="mb-7 flex h-10 items-center gap-2 rounded-lg px-2 text-sm font-bold text-slate-500 transition hover:bg-slate-100 hover:text-[#176b9b]"
      >
        <ArrowLeft size={18} />
        Quay lại cổng bệnh nhân
      </button>

      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-lg bg-sky-50 text-[#176b9b]">
          <Stethoscope size={22} />
        </span>
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-950">
            Đăng nhập nhân viên
          </h2>
          <p className="mt-1 text-sm font-medium text-slate-500">Tài khoản và mật khẩu nội bộ</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-8 grid gap-5">
        <label>
          <span className="field-label">Tài khoản</span>
          <input
            autoFocus
            value={userName}
            onChange={(event) => onChangeUserName(event.target.value)}
            className="form-control"
            placeholder="Nhập tài khoản"
          />
        </label>
        <label>
          <span className="field-label">Mật khẩu</span>
          <input
            type="password"
            value={password}
            onChange={(event) => onChangePassword(event.target.value)}
            className="form-control"
            placeholder="Nhập mật khẩu"
          />
        </label>
        {errorMessage && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {errorMessage}
          </p>
        )}
        <button
          disabled={!valid || pending}
          className="h-12 w-full rounded-lg bg-[#176b9b] px-6 font-bold text-white hover:bg-[#145b84] disabled:bg-slate-300"
        >
          {pending ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </form>
    </>
  );
}
