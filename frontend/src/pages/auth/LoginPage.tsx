import { ArrowLeft, Hospital, Loader2, ShieldCheck, Stethoscope, UserRound } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { authApi } from "../../api/authApi";
import loginBackground from "../../assets/backgrounds/hospital-login.png";
import { useAuth } from "../../hooks/useAuth";

type LoginMode = "patient" | "staff";
type BackendStatus = "warming" | "ready" | "unavailable";

export function LoginPage() {
  const { user, login, staffLogin, isAuthenticated } = useAuth();
  const [mode, setMode] = useState<LoginMode>("patient");
  const [cccd, setCccd] = useState("001204012345");
  const [fullName, setFullName] = useState("Nguyễn Văn An");
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("warming");
  const cccdValid = /^\d{9,12}$/.test(cccd);
  const fullNameValid = fullName.trim().length >= 2;
  const patientValid = cccdValid && fullNameValid;
  const staffValid = userName.trim().length > 0 && password.length > 0;
  const pending = login.isPending || staffLogin.isPending;

  useEffect(() => {
    let active = true;

    authApi.warmup()
      .then(() => {
        if (active) setBackendStatus("ready");
      })
      .catch(() => {
        if (active) setBackendStatus("unavailable");
      });

    return () => {
      active = false;
    };
  }, []);

  if (isAuthenticated && user) {
    return <Navigate to={`/${user.role.toLowerCase()}`} replace />;
  }

  const submitPatient = (event: FormEvent) => {
    event.preventDefault();
    if (patientValid) login.mutate({ cccd, fullName: fullName.trim() });
  };

  const submitStaff = (event: FormEvent) => {
    event.preventDefault();
    if (staffValid) staffLogin.mutate({ userName, password });
  };

  const handleCccdChange = (val: string) => {
    if (login.isError) login.reset();
    setCccd(val);
  };

  const handleFullNameChange = (val: string) => {
    if (login.isError) login.reset();
    setFullName(val);
  };

  const handleUserNameChange = (val: string) => {
    if (staffLogin.isError) staffLogin.reset();
    setUserName(val);
  };

  const handlePasswordChange = (val: string) => {
    if (staffLogin.isError) staffLogin.reset();
    setPassword(val);
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
                fullName={fullName}
                cccdValid={cccdValid}
                fullNameValid={fullNameValid}
                valid={patientValid}
                pending={pending}
                backendStatus={backendStatus}
                errorMessage={getLoginErrorMessage(login.error, "patient")}
                onChangeCccd={handleCccdChange}
                onChangeFullName={handleFullNameChange}
                onSubmit={submitPatient}
                onStaffMode={() => {
                  login.reset();
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
                errorMessage={getLoginErrorMessage(staffLogin.error, "staff")}
                onChangeUserName={handleUserNameChange}
                onChangePassword={handlePasswordChange}
                onSubmit={submitStaff}
                onPatientMode={() => {
                  login.reset();
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

function getLoginErrorMessage(error: unknown, role: "patient" | "staff" = "staff") {
  if (!error || typeof error !== "object") return "";

  const response = "response" in error && error.response && typeof error.response === "object" ? error.response : undefined;
  const status = response && "status" in response && typeof response.status === "number" ? response.status : undefined;
  const code = "code" in error && typeof error.code === "string" ? error.code : undefined;
  const messageStr = "message" in error && typeof error.message === "string" ? error.message : "";

  // Network error or server unreachable
  if (!response) {
    if (code === "ECONNABORTED" || messageStr.toLowerCase().includes("timeout")) {
      return "Yêu cầu đăng nhập quá thời gian phản hồi. Máy chủ Render có thể đang thức dậy từ trạng thái ngủ. Vui lòng thử lại sau 30 giây.";
    }
    return "Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng hoặc đợi máy chủ khởi động (cold start).";
  }

  // 502 / 503 / 504 gateway errors (common on Render cold start)
  if (status === 502 || status === 503 || status === 504) {
    return "Máy chủ đang khởi động lại từ trạng thái ngủ (cold start). Vui lòng đợi khoảng 30–60 giây rồi bấm 'Tiếp tục' lại.";
  }

  const data = "data" in response && response.data && typeof response.data === "object" ? response.data : undefined;
  const errorBody = data && "error" in data && data.error && typeof data.error === "object" ? data.error : undefined;
  const serverMsg = errorBody && "message" in errorBody && typeof errorBody.message === "string" ? errorBody.message : undefined;

  if (serverMsg) {
    if (serverMsg.includes("ECONNREFUSED") || serverMsg.toLowerCase().includes("database") || serverMsg.toLowerCase().includes("prisma")) {
      return "Không thể kết nối cơ sở dữ liệu. Vui lòng kiểm tra lại dịch vụ máy chủ.";
    }
    return serverMsg;
  }

  if (status === 401) {
    return role === "patient" ? "Thông tin bệnh nhân chưa hợp lệ." : "Tài khoản hoặc mật khẩu chưa đúng";
  }

  return role === "patient" ? "Đăng nhập không thành công. Vui lòng thử lại." : "Tài khoản hoặc mật khẩu chưa đúng";
}

function PatientLoginForm({
  cccd,
  fullName,
  cccdValid,
  fullNameValid,
  valid,
  pending,
  backendStatus,
  errorMessage,
  onChangeCccd,
  onChangeFullName,
  onSubmit,
  onStaffMode,
}: {
  cccd: string;
  fullName: string;
  cccdValid: boolean;
  fullNameValid: boolean;
  valid: boolean;
  pending: boolean;
  backendStatus: BackendStatus;
  errorMessage: string;
  onChangeCccd: (value: string) => void;
  onChangeFullName: (value: string) => void;
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
        {backendStatus === "warming" && !errorMessage && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800" role="status">
            Máy chủ đang khởi động. Bạn có thể nhập CCCD trong lúc chờ.
          </p>
        )}
        {backendStatus === "unavailable" && !errorMessage && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700" role="alert">
            Chưa kết nối được máy chủ. Hệ thống sẽ thử lại khi bạn đăng nhập.
          </p>
        )}

        {errorMessage && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm font-semibold text-red-700" role="alert">
            <p className="flex items-start gap-1.5">
              <span className="shrink-0">⚠️</span>
              <span>{errorMessage}</span>
            </p>
            {backendStatus === "unavailable" && (
              <p className="mt-1.5 text-xs font-normal text-red-600">
                Gợi ý: Nếu đang triển khai trên Render Free, máy chủ có thể đang trong quá trình Cold Start (30–60 giây). Vui lòng đợi một lát rồi bấm thử lại.
              </p>
            )}
          </div>
        )}

        <label className="block">
          <span className="field-label">Họ và tên</span>
          <input
            autoFocus
            autoComplete="name"
            value={fullName}
            onChange={(event) => onChangeFullName(event.target.value.slice(0, 100))}
            className="form-control"
            placeholder="Nhập họ và tên bệnh nhân"
          />
        </label>
        {fullName && !fullNameValid && (
          <p className="mt-2 text-sm font-medium text-red-600">
            Họ và tên cần có ít nhất 2 ký tự.
          </p>
        )}
        <label className="mt-5 block">
          <span className="field-label">Số căn cước công dân</span>
          <input
            inputMode="numeric"
            autoComplete="off"
            value={cccd}
            onChange={(event) => onChangeCccd(event.target.value.replace(/\D/g, "").slice(0, 12))}
            className="form-control text-lg tracking-wider"
            placeholder="Nhập 9-12 chữ số"
          />
        </label>
        {cccd && !cccdValid && (
          <p className="mt-2 text-sm font-medium text-red-600">
            CCCD cần có từ 9 đến 12 chữ số.
          </p>
        )}
        <button
          type="submit"
          disabled={!valid || pending}
          className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#176b9b] px-6 font-bold text-white transition hover:bg-[#145b84] disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {pending ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>{backendStatus === "warming" ? "Máy chủ đang khởi động..." : "Đang kiểm tra..."}</span>
            </>
          ) : (
            "Tiếp tục"
          )}
        </button>
        {!valid && (
          <p className="mt-2 text-center text-xs text-slate-500">
            {!fullName.trim()
              ? "Vui lòng nhập họ và tên bệnh nhân (tối thiểu 2 ký tự)"
              : !cccd
              ? "Vui lòng nhập số căn cước công dân"
              : !cccdValid
              ? "Số CCCD cần có từ 9 đến 12 chữ số"
              : "Vui lòng điền đầy đủ thông tin để tiếp tục"}
          </p>
        )}
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
          type="submit"
          disabled={!valid || pending}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#176b9b] px-6 font-bold text-white transition hover:bg-[#145b84] disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {pending ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Đang đăng nhập...</span>
            </>
          ) : (
            "Đăng nhập"
          )}
        </button>
      </form>

      <div className="mt-6 border-t border-slate-200 pt-5">
        <p className="mb-2 text-xs font-bold text-slate-500">Chọn nhanh tài khoản để kiểm thử phân quyền:</p>
        <div className="grid gap-2">
          <button
            type="button"
            onClick={() => {
              onChangeUserName("bs.nguyen.minh.khang@vaic.vn");
              onChangePassword("12345678");
            }}
            className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs transition hover:border-[#176b9b] hover:bg-sky-50"
          >
            <div>
              <strong className="block text-slate-900">BS. Nguyễn Minh Khang</strong>
              <span className="text-slate-500">Phòng khám Tổng quát 101</span>
            </div>
            <span className="rounded bg-sky-100 px-2 py-0.5 font-bold text-[#176b9b]">Bác sĩ khám</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onChangeUserName("ngan01@gmail.com");
              onChangePassword("12345678");
            }}
            className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs transition hover:border-emerald-600 hover:bg-emerald-50"
          >
            <div>
              <strong className="block text-slate-900">ĐD. Nguyễn Thảo Ngân</strong>
              <span className="text-slate-500">Quầy tiếp đón & phân luồng</span>
            </div>
            <span className="rounded bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800">Nhân viên tiếp nhận</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onChangeUserName("adminamind");
              onChangePassword("12345678");
            }}
            className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs transition hover:border-purple-600 hover:bg-purple-50"
          >
            <div>
              <strong className="block text-slate-900">Quản trị viên</strong>
              <span className="text-slate-500">Trung tâm điều hành</span>
            </div>
            <span className="rounded bg-purple-100 px-2 py-0.5 font-bold text-purple-800">Quản trị</span>
          </button>
        </div>
      </div>
    </>
  );
}
